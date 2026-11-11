import { TAILLE_LOT_SYNCHRO, type BilanSynchro, type ErreurHorsLigne, type ResultatLiberation, type ResultatSynchroServeur } from "./hors-ligne-types";
import type { Stockage } from "./stockage-hors-ligne";

// Synchronisation au retour du réseau (story 7.8) : les scans faits hors ligne partent par lots (empreintes seulement), puis le Verrou est rendu, puis la
// liste locale est effacée. Chaque étape ne passe à la suivante qu'après la réponse RÉELLE du serveur (règle 13) : un scan n'est marqué envoyé qu'après
// la réponse de synchroniser_scans, la liste n'est effacée qu'après celle de liberer_verrou.

export type DependancesSynchro = {
  stockage: Pick<Stockage, "scansASynchroniser" | "marquerSynchronises" | "effacerEvenement" | "compterEnAttente">;
  synchroniser: (e: { evenementId: string; appareil: string; scans: { id: string; nature: "jeton" | "code"; empreinte: string; scanneLe: string }[] }) => Promise<ResultatSynchroServeur>;
  liberer: (e: { evenementId: string; appareil: string }) => Promise<ResultatLiberation>;
};

export type ResultatSynchro =
  // Tout est envoyé, le Verrou est rendu, la liste et les scans locaux sont effacés.
  | { statut: "libere"; bilan: BilanSynchro }
  // Réseau ou serveur indisponible : rien n'est perdu, l'appareil réessaiera.
  | { statut: "echec"; erreur: ErreurHorsLigne; bilan: BilanSynchro; restants: number }
  // Le serveur n'accepte plus cet appareil (Verrou libéré de force) : les scans restants ne partiront pas ; ils sont gardés pour que l'on puisse les lire.
  | { statut: "perdu"; bilan: BilanSynchro; restants: number };

const ZERO: BilanSynchro = { appliques: 0, conflits: 0, inconnus: 0, invalides: 0, dejaTraites: 0 };

function additionner(a: BilanSynchro, b: BilanSynchro): BilanSynchro {
  return {
    appliques: a.appliques + b.appliques,
    conflits: a.conflits + b.conflits,
    inconnus: a.inconnus + b.inconnus,
    invalides: a.invalides + b.invalides,
    dejaTraites: a.dejaTraites + b.dejaTraites,
  };
}

export async function synchroniserEtLiberer(deps: DependancesSynchro, evenementId: string, appareil: string): Promise<ResultatSynchro> {
  let bilan = ZERO;
  const restantsApres = async () => {
    try {
      return await deps.stockage.compterEnAttente(evenementId);
    } catch {
      return 0;
    }
  };
  try {
    // Plusieurs passes : un scan jugé pendant l'envoi (écran qui tardait à se bloquer) est relu et envoyé à la passe suivante.
    for (let passe = 0; passe < 4; passe++) {
      const aEnvoyer = await deps.stockage.scansASynchroniser(evenementId);
      if (aEnvoyer.length === 0) break;
      for (let i = 0; i < aEnvoyer.length; i += TAILLE_LOT_SYNCHRO) {
        const lot = aEnvoyer.slice(i, i + TAILLE_LOT_SYNCHRO);
        const r = await deps.synchroniser({
          evenementId,
          appareil,
          scans: lot.map((s) => ({ id: s.id, nature: s.nature, empreinte: s.empreinte, scanneLe: s.scanneLe })),
        });
        if (!r.ok) {
          const restants = await restantsApres();
          if (r.erreur === "verrou_absent") return { statut: "perdu", bilan, restants };
          return { statut: "echec", erreur: r.erreur, bilan, restants };
        }
        bilan = additionner(bilan, r.bilan);
        await deps.stockage.marquerSynchronises(lot.map((s) => s.id));
      }
    }
    // Relecture avant de rendre le Verrou : un scan encore en attente n'est jamais abandonné.
    const encore = await deps.stockage.compterEnAttente(evenementId);
    if (encore > 0) return { statut: "echec", erreur: "generique", bilan, restants: encore };
    const liberation = await deps.liberer({ evenementId, appareil });
    if (!liberation.ok && liberation.erreur !== "verrou_absent") {
      return { statut: "echec", erreur: liberation.erreur, bilan, restants: await restantsApres() };
    }
    // Verrou rendu : la liste et les scans envoyés sont effacés ; un scan arrivé entre-temps reste gardé (jamais effacé sans avoir été envoyé).
    const gardes = await deps.stockage.effacerEvenement(evenementId);
    if (gardes > 0) return { statut: "perdu", bilan, restants: gardes };
    return { statut: "libere", bilan };
  } catch {
    return { statut: "echec", erreur: "generique", bilan, restants: await restantsApres() };
  }
}
