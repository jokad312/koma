import { cheminDepuisReferer, pageMesuree } from "./chemins";
import { schemaEvenement } from "./schemas";
import type { DependancesMesure, ResultatMesure } from "./types";

// Fenêtre fixe d'une heure pour les deux limites (AD-22).
const FENETRE_SECONDES = 3600;

// Par session (identifiant aléatoire gardé en sessionStorage) : une visite normale envoie quelques événements par page.
export const LIMITE_SESSION_PAR_HEURE = 300;

// Par empreinte d'IP : large, car en RDC les opérateurs mobiles (CGNAT) et les cybercafés mettent beaucoup de personnes
// derrière la même adresse ; une limite serrée bloquerait des visiteurs honnêtes. La clé est un HMAC, jamais l'adresse.
export const LIMITE_IP_PAR_HEURE = 1200;

// Plafond global : la session est choisie par le client et l'adresse IP peut manquer ; ce plafond borne quoi qu'il arrive
// le nombre d'événements écrits par heure (une boutique à ses débuts en reçoit bien moins).
export const LIMITE_GLOBALE_PAR_HEURE = 20000;

// Seul le code d'erreur est journalisé : jamais le corps de la requête, jamais une valeur reçue.
function journaliser(contexte: string, erreur: unknown) {
  const brut = typeof erreur === "string" ? erreur : erreur instanceof Error ? erreur.message : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "erreur inconnue";
  console.error(`[mesure] ${contexte} : ${code}`);
}

// Enregistre un événement venu du navigateur. Le chemin vient du Referer, jamais du corps : un client bricolé ne peut pas
// faire écrire une page exclue. Referer absent ou d'une autre origine : aucune écriture (204), décision de Jonathan du 2026-11-10.
export async function enregistrerEvenement(dependances: DependancesMesure, corps: unknown): Promise<ResultatMesure> {
  const lu = schemaEvenement.safeParse(corps);
  if (!lu.success) return "invalide";
  const evenement = lu.data;

  const [referer, hote] = await Promise.all([dependances.referer(), dependances.hote()]);
  const chemin = cheminDepuisReferer(referer, hote);
  if (!chemin) return "sans_referer";

  const page = pageMesuree(evenement.action, chemin);
  if (!page) return "refuse";

  try {
    const sessionAutorisee = await dependances.consommerEssai({
      cle: `mesure:session:${evenement.session}`,
      fenetreSecondes: FENETRE_SECONDES,
      maximum: LIMITE_SESSION_PAR_HEURE,
    });
    if (!sessionAutorisee) return "refuse";

    const empreinte = await dependances.empreinteClient();
    if (empreinte) {
      const ipAutorisee = await dependances.consommerEssai({
        cle: `mesure:ip:${empreinte}`,
        fenetreSecondes: FENETRE_SECONDES,
        maximum: LIMITE_IP_PAR_HEURE,
      });
      if (!ipAutorisee) return "refuse";
    }

    const globalAutorise = await dependances.consommerEssai({ cle: "mesure:global", fenetreSecondes: FENETRE_SECONDES, maximum: LIMITE_GLOBALE_PAR_HEURE });
    if (!globalAutorise) return "refuse";

    const { erreur } = await dependances.enregistrer({
      action: evenement.action,
      page,
      origine: evenement.origine ?? null,
      referent: evenement.provenance ?? null,
      langue: evenement.langue,
      appareil: evenement.appareil,
      // Espace privé : un identifiant jetable par événement, pour qu'une action faite depuis /compte ne puisse jamais être
      // rattachée à la session de navigation (et, par l'heure, à un Compte).
      session: page === "/compte" ? crypto.randomUUID() : evenement.session,
      dureeMs: evenement.duree ?? null,
    });
    if (erreur) {
      journaliser("écriture impossible", erreur);
      return "erreur";
    }
    return "ok";
  } catch (erreur) {
    journaliser("écriture impossible", erreur);
    return "erreur";
  }
}
