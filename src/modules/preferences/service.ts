import { z } from "zod";
import { verifierDesinscription, verifierDesinscriptionAlerte } from "./lien-desinscription";
import { OBJETS_CONSENTEMENT } from "./types";
import type { DependancesPreferences, Preferences, ResultatPreferences } from "./types";

// Seul le code de l'erreur est journalisé : ni identifiant de Compte, ni donnée personnelle.
function journaliser(contexte: string) {
  console.error(`[preferences] ${contexte} : échec`);
}

export async function lirePreferences(deps: DependancesPreferences): Promise<ResultatPreferences<{ preferences: Preferences }>> {
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    const r = await deps.lire(compte.compteId);
    if ("erreur" in r) {
      journaliser("lecture");
      return { ok: false, erreur: "erreur" };
    }
    return { ok: true, preferences: r.preferences };
  } catch {
    journaliser("lecture");
    return { ok: false, erreur: "erreur" };
  }
}

const reglageSchema = z.object({ objet: z.enum(OBJETS_CONSENTEMENT), actif: z.boolean() });

// L'état renvoyé est celui que la base a réellement enregistré (règle 13) : l'interface n'affiche « Actif » qu'après cette réponse.
export async function reglerPreference(deps: DependancesPreferences, entree: unknown): Promise<ResultatPreferences<{ actif: boolean }>> {
  const lu = reglageSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    const r = await deps.regler(compte.auteur, lu.data.objet, lu.data.actif);
    if ("erreur" in r) {
      journaliser("réglage");
      return { ok: false, erreur: "erreur" };
    }
    return { ok: true, actif: r.actif };
  } catch {
    journaliser("réglage");
    return { ok: false, erreur: "erreur" };
  }
}

// Désinscription par le lien : la signature est vérifiée avant tout appel à la base ; sans connexion.
// « c » : Compte (story 9.4). « a » : inscription par email sans Compte à « Me prévenir » (story 7.3).
export async function desinscrireParLien(
  deps: Pick<DependancesPreferences, "desinscrire" | "desinscrireAlerte">,
  params: { c?: unknown; s?: unknown; a?: unknown },
): Promise<"desinscrit" | "lien_invalide" | "erreur"> {
  const c = Array.isArray(params.c) ? params.c[0] : params.c;
  const a = Array.isArray(params.a) ? params.a[0] : params.a;
  const s = Array.isArray(params.s) ? params.s[0] : params.s;
  try {
    let r: { fait: boolean } | { erreur: string };
    if (typeof a === "string" && (c === undefined || c === null)) {
      if (!verifierDesinscriptionAlerte(a, s)) return "lien_invalide";
      r = await deps.desinscrireAlerte(a);
    } else {
      if (!verifierDesinscription(c, s)) return "lien_invalide";
      r = await deps.desinscrire(c);
    }
    if ("erreur" in r) {
      journaliser("désinscription");
      return "erreur";
    }
    return r.fait ? "desinscrit" : "lien_invalide";
  } catch {
    journaliser("désinscription");
    return "erreur";
  }
}
