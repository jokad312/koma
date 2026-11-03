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

// Adaptateur MaishaPay (mobile money et carte), stories 5.6 et 5.9. Construit sur la documentation provisoire résumée dans
// docs/references/paiements/maishapay.md (hors dépôt) : API REST « Collection v2 » mobile money, « Card collection v2 », « Transaction Lookup ».
// Chaque choix renvoie à une section de ce résumé. Ce que la documentation ne dit pas est listé dans QUESTIONS_OUVERTES : tant qu'il en reste, l'adaptateur
// n'est pas activable (règle 15) et `comparerMontant` ne valide jamais rien. Un adaptateur n'accède jamais à la base (AD-5) : la configuration est injectée.

const BASE = "https://marchand.maishapay.online/api";
// Délai maximal de chaque appel : sans lui, un MaishaPay muet bloquerait la route (dette notée à la story 5.2).
const DELAI_APPEL_MS = 10_000;

export type ConfigMaishaPay = { clePublique: string; cleSecrete: string; mode: 0 | 1 };

// Documentation « Introduction » et « Collection » : tout point que la documentation ne tranche pas reste écrit ici.
// Décisions de Jonathan (2026-11-03) : KOMA SHOP absorbe les frais éventuels, la comparaison porte sur « amount » (hors frais) ; tout FAILED est un échec
// du client sans repli ; carte : le client choisit Visa ou Mastercard, nom et téléphone du payeur sont collectés au paiement par carte seulement.
export const QUESTIONS_OUVERTES: readonly string[] = [
  "Devise réellement débitée : la documentation ne dit pas si le montant envoyé en USD est débité en USD ou converti (CDF, XAF…) ; question posée à MaishaPay. Tant que la consultation ne renvoie pas USD, la comparaison reste indéterminée.",
  "Couverture réelle pays-opérateur de l'application du site chez MaishaPay (la documentation décrit la plateforme, pas notre contrat). Question posée à MaishaPay.",
  "Noms du paramètre provider : seuls AIRTEL, ORANGE, MTN sont documentés pour la version 2 ; M-Pesa RDC n'est documenté qu'en version 1 (réponse synchrone, sans rappel) ; Moov, Wave, Free, T-money, Africell : non documentés. Question posée à MaishaPay.",
  "Carte : la version 3 de la documentation se contredit sur les champs de facturation. Question posée à MaishaPay.",
  "Durée de vie d'un paiement en attente (PENDING) et valeurs possibles de transactionStatus à la consultation. Question posée à MaishaPay.",
];

// Opérateurs documentés pour la version 2 du mobile money (valeur du paramètre provider). Le reste n'est pas deviné.
export function providerMobileMoney(operateur: string | null): "AIRTEL" | "ORANGE" | "MTN" | null {
  const n = (operateur ?? "").toLowerCase();
  if (n.includes("airtel")) return "AIRTEL";
  if (n.includes("orange")) return "ORANGE";
  if (n.includes("mtn")) return "MTN";
  return null;
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

function montantEnCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function creerAdaptateurMaishaPay(lireConfig: () => ConfigMaishaPay | null, appeler: typeof fetch = fetch): PrestatairePaiement {
  async function poster(chemin: string, corps: Corps, config: ConfigMaishaPay): Promise<{ http: number; json: Corps | null }> {
    const reponse = await appeler(`${BASE}${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...corps, gatewayMode: config.mode, publicApiKey: config.clePublique, secretApiKey: config.cleSecrete }),
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
    code: "maishapay",
    get questionsOuvertes() {
      return lireConfig() ? QUESTIONS_OUVERTES : ["Clés de l'application du site absentes de l'environnement.", ...QUESTIONS_OUVERTES];
    },

    // Mobile money : « Collection version 2.0 » (POST /collect/v2/store/mobileMoney). Carte : « Card collection v2 » (POST /collect/v2/store/card).
    async initier(t: DonneesTentative): Promise<ResultatInitiation> {
      const config = lireConfig();
      if (!config) throw new Error("configuration MaishaPay absente");
      const montant = montantEnCents(t.montantAttenduCents);
      if (t.moyen === "mobile_money") {
        const provider = providerMobileMoney(t.operateur);
        // Un opérateur que la documentation ne couvre pas en version 2 n'est pas tenté : un autre Agrégateur peut être proposé.
        if (!provider || !t.contact.telephone) return { statut: "refuse", cause: "prestataire" };
        const { http, json } = await poster(
          "/collect/v2/store/mobileMoney",
          {
            transactionReference: t.referenceInterne,
            order: { amount: montant, currency: "USD", ...(t.contact.email ? { customerEmailAdress: t.contact.email } : {}) },
            paymentChannel: { channel: "MOBILEMONEY", provider, walletID: t.contact.telephone, callbackUrl: t.adresseNotification },
          },
          config,
        );
        return lireInitiation(http, json, false);
      }
      // Carte : la version 2 exige le nom complet, le téléphone et l'email du payeur, et le réseau. Jamais inventés : sans eux, la carte n'est pas tentée.
      if (!t.contact.nom || !t.contact.telephone || !t.contact.email || !t.reseauCarte) return { statut: "refuse", cause: "client" };
      const { http, json } = await poster(
        "/collect/v2/store/card",
        {
          transactionReference: t.referenceInterne,
          order: { amount: montant, currency: "USD", customerFullName: t.contact.nom.slice(0, 100), customerPhoneNumber: t.contact.telephone, customerEmailAdress: t.contact.email },
          paymentChannel: { channel: "CARD", provider: t.reseauCarte, callbackUrl: t.adresseNotification },
        },
        config,
      );
      return lireInitiation(http, json, true);
    },

    // Aucune signature n'est documentée (ni en-tête, ni secret partagé) : le rappel (POST du mobile money, GET de la carte) n'est qu'un SIGNAL.
    // On n'en retient que notre référence, puis la consultation par référence marchand fait foi (règle 2 ; recommandation de la documentation).
    async verifierNotification(requete: RequeteNotification): Promise<NotificationVerifiee | null> {
      let referenceInterne: string | null = null;
      let idExterne: string | null = null;
      let statutAnnonce: string | null = null;
      if (requete.methode === "GET") {
        const q = new URLSearchParams(requete.requete);
        referenceInterne = texte(q.get("transactionRefId"));
        idExterne = texte(q.get("operatorRefId"));
        statutAnnonce = texte(q.get("description"));
      } else {
        let corps: Corps | null = null;
        try {
          corps = enObjet(JSON.parse(requete.corps));
        } catch {
          corps = null;
        }
        referenceInterne = texte(corps?.originatingTransactionId);
        idExterne = texte(corps?.transactionId);
        statutAnnonce = texte(corps?.transactionStatus);
      }
      if (!referenceInterne) return null;
      const resultat = await adaptateur.consulterStatut({ referenceInterne, referenceTransaction: idExterne });
      // Rien de retrouvé chez MaishaPay pour cette référence : une fausse notification ne valide rien (401).
      if (resultat.referenceTransaction === null && resultat.statut === "inconnu") return null;
      return { idNotification: `${idExterne ?? referenceInterne}:${(statutAnnonce ?? "").toUpperCase().slice(0, 30)}`, referenceInterne, resultat };
    },

    // « Transaction Lookup » : POST /transaction/rest/v2/check?useRef=1, transactionId = notre référence marchand.
    async consulterStatut(references: ReferencesTentative): Promise<ResultatAdaptateur> {
      const inconnu: ResultatAdaptateur = { statut: "inconnu", referenceTransaction: null, montantRecu: null, deviseRecue: null };
      const config = lireConfig();
      if (!config) throw new Error("configuration MaishaPay absente");
      const { http, json } = await poster("/transaction/rest/v2/check?useRef=1", { transactionId: references.referenceInterne }, config);
      if (http < 200 || http >= 300 || !json) return inconnu;
      // La réponse doit porter NOTRE référence et décrire une collecte : jamais le statut d'une autre transaction.
      if (texte(json.originatingTransactionId) !== references.referenceInterne) return inconnu;
      const type = texte(json.transaction_type);
      if (type !== null && !/collect/i.test(type)) return inconnu;
      const id = texte(json.transactionId);
      const statut = (texte(json.transactionStatus) ?? "").toUpperCase();
      const base = { referenceTransaction: id, montantRecu: null, deviseRecue: null };
      if (statut === "SUCCESS") {
        // Montant « amount » de order.cost (règle de comparaison non tranchée : voir QUESTIONS_OUVERTES). La comparaison reste indéterminée.
        const cout = enObjet(enObjet(json.order)?.cost);
        const devise = texte(cout?.currency)?.toUpperCase() ?? null;
        return { statut: "succes", referenceTransaction: id, montantRecu: texte(cout?.amount), deviseRecue: devise && /^[A-Z]{3}$/.test(devise) ? devise : null };
      }
      // Cause d'un échec non documentée : traité comme un échec du client, sans repli automatique.
      if (statut === "FAILED" || statut === "DECLINED" || statut === "CANCELED") return { statut: "echec_client", ...base };
      return { statut: "inconnu", ...base };
    },

    // Décision de Jonathan : le champ comparé est « amount » (hors frais, absorbés par KOMA SHOP). La devise doit être USD, celle que nous envoyons :
    // toute autre devise (conversion non documentée) reste indéterminée, jamais devinée (règle 15). Comparaison exacte, en centimes.
    comparerMontant(attenduCents: number, montantRecu: string, deviseRecue: string): ComparaisonMontant {
      if (deviseRecue.toUpperCase() !== "USD") return "indetermine";
      if (!/^\d+(\.\d{1,8})?$/.test(montantRecu.trim())) return "indetermine";
      const recu = Math.round(Number(montantRecu) * 100);
      return recu === attenduCents ? "egal" : recu < attenduCents ? "inferieur" : "superieur";
    },
  };
  return adaptateur;
}

// Réponse initiale : HTTP 202 / « status_code » 202 et « transactionStatus » PENDING. La carte renvoie en plus « paymentPage » (redirection).
function lireInitiation(http: number, json: Corps | null, carte: boolean): ResultatInitiation {
  const code = typeof json?.status_code === "number" ? json.status_code : http;
  const statut = (texte(json?.transactionStatus) ?? "").toUpperCase();
  if (json && code === 202 && statut === "PENDING") {
    const id = texte(json.transactionId);
    const page = carte ? texte(json.paymentPage) : null;
    if (carte && !page) throw new Error("page de paiement absente");
    if (page && !/^https:\/\//i.test(page)) throw new Error("page de paiement invalide");
    return { statut: "initie", referenceTransaction: id, redirection: page };
  }
  // Refus explicite et lisible : le Prestataire a répondu FAILED (cause non documentée : refus côté Prestataire, un autre Agrégateur peut être proposé).
  if (json && (statut === "FAILED" || statut === "DECLINED" || code === 400)) return { statut: "refuse", cause: "prestataire" };
  // Tout le reste (réponse illisible, 5xx, coupure) n'est pas un refus : la Tentative reste en cours et la réconciliation interroge MaishaPay.
  throw new Error("réponse d'initiation inattendue");
}
