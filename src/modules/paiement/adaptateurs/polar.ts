import type {
  ComparaisonMontant,
  DonneesTentative,
  NotificationVerifiee,
  PrestatairePaiement,
  ReferencesTentative,
  RequeteNotification,
  ResultatAdaptateur,
  ResultatInitiation,
} from "../types";

// Adaptateur Polar (carte, paniers 100 % numériques seulement), story 4.7. Construit sur la documentation publique résumée dans
// docs/references/paiements/polar.md (hors dépôt) : API REST « Checkouts » et « Orders », webhooks Standard Webhooks. Ce que la documentation ne dit pas est
// listé dans QUESTIONS_OUVERTES : tant qu'il en reste, l'adaptateur n'est pas activable (règle 15). Un adaptateur n'accède jamais à la base (AD-5) :
// la configuration est injectée.
//
// Règle 10 : Polar n'encaisse jamais un Produit physique ni un Pass. Le routage (aiguillage) l'interdit déjà ; l'adaptateur le refuse AUSSI de lui-même,
// avant tout appel réseau : aucun paiement Polar n'est créé pour une Commande qui n'est pas uniquement faite de Kits.

const BASE_SANDBOX = "https://sandbox-api.polar.sh";
const BASE_PRODUCTION = "https://api.polar.sh";
const DELAI_APPEL_MS = 10_000;
// Tolérance de l'horodatage des webhooks : la documentation de Polar renvoie à la spécification Standard Webhooks sans donner de valeur (question ouverte) ;
// 5 minutes est la valeur de la spécification.
const TOLERANCE_SECONDES = 300;

export type ConfigPolar = {
  // Organization Access Token (production et sandbox sont distincts).
  jeton: string;
  production: boolean;
  // Secret de signature des webhooks (« whsec_… », Standard Webhooks).
  secretWebhook: string;
  // Identifiant d'un produit numérique de l'organisation Polar, qui porte les prix ad hoc de chaque paiement (un seul produit sert à toutes les sessions).
  produitId: string;
};

export const QUESTIONS_OUVERTES: readonly string[] = [
  "Forme exacte du message de webhook (type, data) : la documentation de Polar ne la montre pas. L'adaptateur ne croit jamais le corps : après la signature, il contre-vérifie auprès de l'API de Polar (règle 2). À confirmer dans le bac à sable (essai d'un vrai paiement de test).",
  "Tolérance d'horodatage de la signature : non documentée, 5 minutes retenues (spécification Standard Webhooks). Les secrets créés avant le 8 septembre 2026 (« Polar HMAC ») ne sont pas pris en charge : créer le secret de webhook après cette date.",
  "Prix ad hoc fixe sur le produit de l'organisation (POLAR_PRODUCT_ID) : la documentation montre l'exemple mais ne dit pas si un produit sans avantage ou d'un autre type de prix l'accepte. À valider dans le bac à sable.",
  "Taxes : Polar est marchand officiel et peut ajouter des taxes selon le pays (taxe en sus aux États-Unis, au Canada et en Inde). Le montant payé (total_amount) peut alors dépasser le montant demandé et serait signalé en Trop-perçu ; à décider avec Jonathan (comportement fiscal du prix) avant l'activation.",
  "Restriction du paiement à la carte : non documentée (portefeuilles et moyens locaux proposés par défaut). Devise de présentation : sans adresse IP du client, Polar peut se baser sur l'IP du serveur.",
  "Politique d'utilisation acceptable de Polar : les « eBooks » sont classés en revue renforcée ; faire confirmer par Polar que les Kits (PDF, SVG, STL, vidéo) sont acceptés avant d'activer le paiement.",
];

type Corps = Record<string, unknown>;

function enObjet(valeur: unknown): Corps | null {
  return valeur !== null && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Corps) : null;
}

function texte(valeur: unknown): string | null {
  if (typeof valeur === "string" && valeur.trim() !== "") return valeur.trim();
  return null;
}

function entier(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= 0 ? valeur : null;
}

// Montants de Polar en centimes (« Amount in cents ») ; rendus en dollars décimaux, comme les autres adaptateurs.
function dollars(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

// Seule une page de paiement de Polar (https, polar.sh ou un sous-domaine) est acceptée comme destination : jamais une adresse arbitraire.
function adressePolarValide(valeur: string | null): string | null {
  if (!valeur) return null;
  try {
    const u = new URL(valeur);
    return u.protocol === "https:" && (u.hostname === "polar.sh" || u.hostname.endsWith(".polar.sh")) ? u.toString() : null;
  } catch {
    return null;
  }
}

// Le panier ne doit contenir que des Kits : ni Produit physique, ni Pass, ni panier vide ou inconnu.
export function panierNumerique(t: Pick<DonneesTentative, "achat">): boolean {
  return !t.achat.estPass && t.achat.familles.length > 0 && t.achat.familles.every((f) => f === "kit");
}

function enOctets(base64: string): Uint8Array | null {
  try {
    const binaire = atob(base64);
    return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function egauxEnTempsConstant(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Standard Webhooks : HMAC-SHA256 de « {webhook-id}.{webhook-timestamp}.{corps} », clé = secret « whsec_ » décodé de base64, signature « v1,{base64} »
// (plusieurs signatures possibles, séparées par des espaces).
export async function signatureWebhookValide(secret: string, enTetes: Readonly<Record<string, string>>, corps: string, maintenantSecondes: number = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const id = enTetes["webhook-id"];
  const horodatage = enTetes["webhook-timestamp"];
  const signatures = enTetes["webhook-signature"];
  if (!id || !horodatage || !signatures || !/^[0-9]{1,12}$/.test(horodatage)) return false;
  if (Math.abs(maintenantSecondes - Number(horodatage)) > TOLERANCE_SECONDES) return false;
  if (!secret.startsWith("whsec_")) return false;
  const cle = enOctets(secret.slice("whsec_".length));
  if (!cle || cle.length === 0) return false;
  const clef = await crypto.subtle.importKey("raw", cle as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const attendue = new Uint8Array(await crypto.subtle.sign("HMAC", clef, new TextEncoder().encode(`${id}.${horodatage}.${corps}`)));
  for (const candidate of signatures.split(" ")) {
    const [version, valeur] = candidate.split(",");
    if (version !== "v1" || !valeur) continue;
    const octets = enOctets(valeur);
    if (octets && egauxEnTempsConstant(octets, attendue)) return true;
  }
  return false;
}

export function creerAdaptateurPolar(lireConfig: () => ConfigPolar | null, appeler: typeof fetch = fetch): PrestatairePaiement {
  async function demander(methode: "GET" | "POST", chemin: string, config: ConfigPolar, corps?: Corps): Promise<{ http: number; json: Corps | null }> {
    const reponse = await appeler(`${config.production ? BASE_PRODUCTION : BASE_SANDBOX}${chemin}`, {
      method: methode,
      headers: { Authorization: `Bearer ${config.jeton}`, Accept: "application/json", ...(corps ? { "Content-Type": "application/json" } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
      signal: AbortSignal.timeout(DELAI_APPEL_MS),
      cache: "no-store",
    });
    let json: Corps | null = null;
    try {
      json = enObjet(await reponse.json());
    } catch {
      json = null;
    }
    return { http: reponse.status, json };
  }

  const inconnu: ResultatAdaptateur = { statut: "inconnu", referenceTransaction: null, montantRecu: null, deviseRecue: null };

  const adaptateur: PrestatairePaiement = {
    code: "polar",
    get questionsOuvertes() {
      const config = lireConfig();
      return config ? QUESTIONS_OUVERTES : ["Clés de Polar absentes de l'environnement (POLAR_ACCESS_TOKEN, POLAR_SERVER, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_ID).", ...QUESTIONS_OUVERTES];
    },

    // Session de paiement : POST /v1/checkouts/ avec un prix ad hoc fixe (documenté : « amount_type: fixed », « price_amount » en centimes) sur le produit numérique de
    // l'organisation. Notre référence part dans metadata (recopiée sur la commande Polar) ; le client est envoyé sur l'adresse de paiement renvoyée.
    async initier(t: DonneesTentative): Promise<ResultatInitiation> {
      // Règle 10, avant tout : aucun appel à Polar pour autre chose qu'un panier de Kits payé par carte.
      if (t.moyen !== "carte" || !panierNumerique(t)) return { statut: "refuse", cause: "prestataire" };
      const config = lireConfig();
      if (!config) throw new Error("configuration Polar absente");
      const { http, json } = await demander("POST", "/v1/checkouts/", config, {
        products: [config.produitId],
        prices: { [config.produitId]: [{ amount_type: "fixed", price_amount: t.montantAttenduCents, price_currency: "usd" }] },
        success_url: t.adresseRetour,
        metadata: { reference_interne: t.referenceInterne },
        ...(t.contact.email ? { customer_email: t.contact.email } : {}),
        ...(t.contact.nom ? { customer_name: t.contact.nom } : {}),
      });
      if (json && http === 201) {
        const id = texte(json.id);
        const url = adressePolarValide(texte(json.url));
        if (id && url) return { statut: "initie", referenceTransaction: id, redirection: url };
        // Réponse sans identifiant ou vers une adresse qui n'est pas Polar : jamais suivie.
        return { statut: "refuse", cause: "prestataire" };
      }
      // Entrée ou authentification refusées (4xx, dont 422) : défaut de configuration, pas un paiement du client.
      if (json && http >= 400 && http < 500 && http !== 429) return { statut: "refuse", cause: "prestataire" };
      // 429, 5xx, réponse illisible, coupure : la Tentative reste en cours et la réconciliation interroge Polar.
      throw new Error("réponse d'initiation inattendue");
    },

    // Signature Standard Webhooks vérifiée, puis jamais de confiance dans le corps : le statut est relu auprès de l'API (règle 2). Un événement validement signé
    // qui ne se rattache à aucune de nos Tentatives rend un résultat « inconnu » sans référence : la route répond 200 (Polar ne rejoue pas et ne désactive pas l'adresse).
    async verifierNotification(requete: RequeteNotification): Promise<NotificationVerifiee | null> {
      const config = lireConfig();
      if (!config || requete.methode !== "POST") return null;
      if (!(await signatureWebhookValide(config.secretWebhook, requete.en_tetes, requete.corps))) return null;
      const idNotification = texte(requete.en_tetes["webhook-id"]);
      if (!idNotification) return null;
      let enveloppe: Corps | null = null;
      try {
        enveloppe = enObjet(JSON.parse(requete.corps));
      } catch {
        enveloppe = null;
      }
      const type = texte(enveloppe?.type) ?? "";
      const data = enObjet(enveloppe?.data);
      const metadata = enObjet(data?.metadata);
      const referenceInterne = texte(metadata?.reference_interne);
      // Identifiant du checkout : celui de la commande (order.*), ou l'objet lui-même (checkout.*). Chemins non documentés : contre-vérifiés ci-dessous.
      const checkoutId = type.startsWith("checkout.") ? texte(data?.id) : texte(data?.checkout_id);
      if (!referenceInterne || !checkoutId || !(type.startsWith("checkout.") || type === "order.paid" || type === "order.created")) {
        return { idNotification, referenceInterne: null, resultat: inconnu };
      }
      const resultat = await adaptateur.consulterStatut({ referenceInterne, referenceTransaction: checkoutId });
      return { idNotification, referenceInterne, resultat };
    },

    // Consultation : GET /v1/checkouts/{id} (statuts open, expired, confirmed, succeeded, failed). Sans identifiant de checkout, recherche des commandes par metadata
    // (GET /v1/orders/?metadata[reference_interne]=…, statut « paid »). La réponse doit porter NOTRE référence : jamais le statut d'un autre paiement.
    async consulterStatut(references: ReferencesTentative): Promise<ResultatAdaptateur> {
      const config = lireConfig();
      if (!config) throw new Error("configuration Polar absente");
      if (references.referenceTransaction) {
        const { http, json } = await demander("GET", `/v1/checkouts/${encodeURIComponent(references.referenceTransaction)}`, config);
        if (http < 200 || http >= 300 || !json || texte(json.id) !== references.referenceTransaction) return inconnu;
        if (texte(enObjet(json.metadata)?.reference_interne) !== references.referenceInterne) return inconnu;
        const statut = texte(json.status);
        const id = references.referenceTransaction;
        if (statut === "succeeded") {
          const total = entier(json.total_amount);
          const devise = texte(json.currency)?.toUpperCase() ?? null;
          return { statut: "succes", referenceTransaction: id, montantRecu: total === null ? null : dollars(total), deviseRecue: devise && /^[A-Z]{3}$/.test(devise) ? devise : null };
        }
        if (statut === "expired") return { statut: "echec_client", referenceTransaction: id, montantRecu: null, deviseRecue: null };
        if (statut === "failed") return { statut: "echec_prestataire", referenceTransaction: id, montantRecu: null, deviseRecue: null };
        // open, confirmed (« pas un signe de réussite ») ou inconnu : la Tentative reste en cours.
        return { statut: "inconnu", referenceTransaction: id, montantRecu: null, deviseRecue: null };
      }
      const { http, json } = await demander("GET", `/v1/orders/?metadata[reference_interne]=${encodeURIComponent(references.referenceInterne)}&limit=5`, config);
      if (http < 200 || http >= 300 || !json || !Array.isArray(json.items)) return inconnu;
      for (const element of json.items) {
        const commande = enObjet(element);
        if (!commande || texte(enObjet(commande.metadata)?.reference_interne) !== references.referenceInterne || texte(commande.status) !== "paid") continue;
        const total = entier(commande.total_amount);
        const devise = texte(commande.currency)?.toUpperCase() ?? null;
        return {
          statut: "succes",
          referenceTransaction: texte(commande.checkout_id),
          montantRecu: total === null ? null : dollars(total),
          deviseRecue: devise && /^[A-Z]{3}$/.test(devise) ? devise : null,
        };
      }
      return inconnu;
    },

    // Comparaison exacte en USD, aucune tolérance inventée (AD-8) : le montant payé (total_amount, après remises et taxes) est comparé au montant figé.
    comparerMontant(attenduCents: number, montantRecu: string, deviseRecue: string): ComparaisonMontant {
      if (deviseRecue.toUpperCase() !== "USD") return "indetermine";
      if (!/^\d+(\.\d{1,2})?$/.test(montantRecu.trim())) return "indetermine";
      const recu = Math.round(Number(montantRecu) * 100);
      return recu === attenduCents ? "egal" : recu < attenduCents ? "inferieur" : "superieur";
    },
  };
  return adaptateur;
}
