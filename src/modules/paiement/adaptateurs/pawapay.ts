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

// Adaptateur PawaPay (mobile money seulement), story 5.7. Construit sur la documentation publique résumée dans docs/references/paiements/pawapay.md
// (hors dépôt) : API « Merchant API V2 », dépôts (deposits). Chaque choix renvoie à une section de ce résumé. Ce que la documentation ne dit pas est listé
// dans QUESTIONS_OUVERTES : tant qu'il en reste, l'adaptateur n'est pas activable (règle 15). Un adaptateur n'accède jamais à la base (AD-5) :
// la configuration est injectée.

const BASE_SANDBOX = "https://api.sandbox.pawapay.io";
const BASE_PRODUCTION = "https://api.pawapay.io";
// Délai maximal de chaque appel : sans lui, un PawaPay muet bloquerait la route.
const DELAI_APPEL_MS = 10_000;

export type ConfigPawaPay = { jeton: string; production: boolean };

// Points que la documentation de PawaPay ne tranche pas, ou qui dépendent du compte de Jonathan. Tant qu'il en reste, PawaPay n'est pas activable.
// Décisions de Jonathan (2026-11-10) : pays hors RDC et Zimbabwe non couverts (aucune conversion depuis l'USD) ; un échec sans cause précise
// (UNSPECIFIED_FAILURE, UNKNOWN_ERROR) est un échec du prestataire ; rappels signés RFC 9421 non vérifiés pour l'instant (la consultation de statut fait foi, règle 2).
export const QUESTIONS_OUVERTES: readonly string[] = [
  "Devises activées sur le compte : la documentation donne le dollar américain (USD) pour la RDC (Vodacom M-Pesa, Airtel, Orange) et le Zimbabwe (EcoCash), mais seule la configuration active du compte (active-conf) dit ce qui est réellement ouvert sur le compte du site.",
  "Adresse de rappel : elle se règle dans le tableau de bord de PawaPay (une adresse pour tout le compte), pas à chaque paiement. À déclarer par Jonathan.",
  "Le rappel (callback) porte-t-il bien notre clientReferenceId ? La documentation ne le montre que dans la consultation de statut ; à vérifier dans le bac à sable. Sans lui, la réconciliation (chaque minute) rattrape de toute façon le paiement.",
];

// Opérateurs documentés avec le dollar américain (documentation « Providers ») : le reste n'est pas deviné.
const PROVIDERS_USD: ReadonlyArray<{ pays: string; mot: RegExp; provider: string }> = [
  { pays: "CD", mot: /vodacom|m-?pesa/i, provider: "VODACOM_MPESA_COD" },
  { pays: "CD", mot: /airtel/i, provider: "AIRTEL_COD" },
  { pays: "CD", mot: /orange/i, provider: "ORANGE_COD" },
  { pays: "ZW", mot: /ecocash/i, provider: "ECOCASH_ZWE" },
];

export function providerPawaPay(pays: string | null, operateur: string | null): string | null {
  const p = (pays ?? "").toUpperCase();
  const o = operateur ?? "";
  return PROVIDERS_USD.find((x) => x.pays === p && x.mot.test(o))?.provider ?? null;
}

type Corps = Record<string, unknown>;

function enObjet(valeur: unknown): Corps | null {
  return valeur !== null && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Corps) : null;
}

function texte(valeur: unknown): string | null {
  if (typeof valeur === "string" && valeur.trim() !== "") return valeur.trim();
  if (typeof valeur === "number" && Number.isFinite(valeur)) return String(valeur);
  return null;
}

// PawaPay exige un identifiant de dépôt au format UUID, alors que notre référence interne n'en est pas un. L'identifiant est dérivé de la référence
// (SHA-256, mise en forme UUID v4) : le même à l'initiation et à chaque consultation, sans rien stocker. Notre référence part aussi en clientReferenceId.
export async function identifiantDepot(referenceInterne: string): Promise<string> {
  const empreinte = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`depot-pawapay:${referenceInterne}`)));
  const o = empreinte.slice(0, 16);
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = Array.from(o, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function montantTexte(cents: number): string {
  const entier = Math.floor(cents / 100);
  const reste = cents % 100;
  return reste === 0 ? String(entier) : `${entier}.${String(reste).padStart(2, "0")}`.replace(/0$/, "");
}

// Échecs de transaction imputables au client (documentation « Failure codes »).
const ECHECS_CLIENT = new Set(["PAYMENT_NOT_APPROVED", "INSUFFICIENT_BALANCE", "PAYER_NOT_FOUND", "PAYMENT_IN_PROGRESS", "WALLET_LIMIT_REACHED", "PAYER_LIMIT_REACHED"]);

export function creerAdaptateurPawaPay(lireConfig: () => ConfigPawaPay | null, appeler: typeof fetch = fetch): PrestatairePaiement {
  async function demander(methode: "GET" | "POST", chemin: string, config: ConfigPawaPay, corps?: Corps): Promise<{ http: number; json: Corps | null }> {
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

  const adaptateur: PrestatairePaiement = {
    code: "pawapay",
    get questionsOuvertes() {
      return lireConfig() ? QUESTIONS_OUVERTES : ["Jeton d'API de PawaPay absent de l'environnement.", ...QUESTIONS_OUVERTES];
    },

    // Dépôt : POST /v2/deposits. Le montant est en USD (seule devise documentée pour la RDC et le Zimbabwe) ; sans opérateur documenté, aucune tentative.
    async initier(t: DonneesTentative): Promise<ResultatInitiation> {
      const config = lireConfig();
      if (!config) throw new Error("configuration PawaPay absente");
      if (t.moyen !== "mobile_money") return { statut: "refuse", cause: "prestataire" };
      const provider = providerPawaPay(t.pays, t.operateur);
      if (!provider || !t.contact.telephone) return { statut: "refuse", cause: "prestataire" };
      const { http, json } = await demander(
        "POST",
        "/v2/deposits",
        config,
        {
          depositId: await identifiantDepot(t.referenceInterne),
          amount: montantTexte(t.montantAttenduCents),
          currency: "USD",
          payer: { type: "MMO", accountDetails: { phoneNumber: t.contact.telephone.replace(/^\+/, ""), provider } },
          clientReferenceId: t.referenceInterne,
        },
      );
      const statut = texte(json?.status);
      // ACCEPTED : pris en charge. DUPLICATE_IGNORED : déjà reçu (même identifiant) ; la Tentative reste en cours, la consultation dira la suite.
      if (json && (statut === "ACCEPTED" || statut === "DUPLICATE_IGNORED")) {
        return { statut: "initie", referenceTransaction: texte(json.depositId), redirection: null }; // identifiant de dépôt : la référence suivie partout
      }
      // Refus explicite et lisible (code d'échec de la documentation) : un autre Agrégateur peut être proposé.
      if (json && statut === "REJECTED" && http >= 200 && http < 300) return { statut: "refuse", cause: "prestataire" };
      // Authentification ou entrée refusées (4xx) : défaut de configuration, pas un paiement du client.
      if (json && http >= 400 && http < 500) return { statut: "refuse", cause: "prestataire" };
      // Réponse illisible, 5xx, coupure : la Tentative reste en cours et la réconciliation interroge PawaPay (UNKNOWN_ERROR : vérifier le statut).
      throw new Error("réponse d'initiation inattendue");
    },

    // Le rappel peut ne pas être signé (signature facultative, RFC 9421, clé publique à récupérer) : il n'est jamais cru. On n'en retient que notre
    // référence, puis la consultation de statut (appel authentifié) fait foi (règle 2).
    async verifierNotification(requete: RequeteNotification): Promise<NotificationVerifiee | null> {
      let corps: Corps | null = null;
      try {
        corps = enObjet(JSON.parse(requete.corps));
      } catch {
        corps = null;
      }
      const referenceInterne = texte(corps?.clientReferenceId);
      if (!referenceInterne) return null;
      const resultat = await adaptateur.consulterStatut({ referenceInterne, referenceTransaction: texte(corps?.depositId) });
      if (resultat.referenceTransaction === null && resultat.statut === "inconnu") return null;
      return { idNotification: `${texte(corps?.depositId) ?? referenceInterne}:${(texte(corps?.status) ?? "").toUpperCase().slice(0, 30)}`, referenceInterne, resultat };
    },

    // Consultation : GET /v2/deposits/{depositId}. Réponse { status: FOUND | NOT_FOUND, data: {...} }.
    async consulterStatut(references: ReferencesTentative): Promise<ResultatAdaptateur> {
      const inconnu: ResultatAdaptateur = { statut: "inconnu", referenceTransaction: null, montantRecu: null, deviseRecue: null };
      const config = lireConfig();
      if (!config) throw new Error("configuration PawaPay absente");
      const id = await identifiantDepot(references.referenceInterne);
      const { http, json } = await demander("GET", `/v2/deposits/${id}`, config);
      if (http < 200 || http >= 300 || !json || texte(json.status) !== "FOUND") return inconnu;
      const data = enObjet(json.data);
      // La réponse doit porter NOTRE dépôt et NOTRE référence : jamais le statut d'un autre paiement.
      if (!data || texte(data.depositId) !== id) return inconnu;
      const reference = texte(data.clientReferenceId);
      if (reference !== null && reference !== references.referenceInterne) return inconnu;
      const statut = (texte(data.status) ?? "").toUpperCase();
      if (statut === "COMPLETED") {
        const devise = texte(data.currency)?.toUpperCase() ?? null;
        return { statut: "succes", referenceTransaction: id, montantRecu: texte(data.amount), deviseRecue: devise && /^[A-Z]{3}$/.test(devise) ? devise : null };
      }
      if (statut === "FAILED") {
        const code = texte(enObjet(data.failureReason)?.failureCode) ?? "";
        return { statut: ECHECS_CLIENT.has(code) ? "echec_client" : "echec_prestataire", referenceTransaction: id, montantRecu: null, deviseRecue: null };
      }
      // ACCEPTED, PROCESSING, IN_RECONCILIATION (« aucune action »), autre : la Tentative reste en cours.
      return { statut: "inconnu", referenceTransaction: id, montantRecu: null, deviseRecue: null };
    },

    // Le montant demandé est celui encaissé ; les frais sont déduits après coup, côté PawaPay (documentation « Deposits »). Comparaison exacte en USD.
    comparerMontant(attenduCents: number, montantRecu: string, deviseRecue: string): ComparaisonMontant {
      if (deviseRecue.toUpperCase() !== "USD") return "indetermine";
      if (!/^\d+(\.\d{1,8})?$/.test(montantRecu.trim())) return "indetermine";
      const recu = Math.round(Number(montantRecu) * 100);
      return recu === attenduCents ? "egal" : recu < attenduCents ? "inferieur" : "superieur";
    },
  };
  return adaptateur;
}
