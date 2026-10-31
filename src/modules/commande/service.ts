import { obtenirKitGratuitSchema, VERSION_LICENCE_KIT } from "./schemas";
import type { EntreeObtenirKitGratuit } from "./schemas";
import type { CodeErreurCommande, DependancesCommande, ResultatCommande } from "./types";

// Seul le code de l'erreur est journalisé : ni identifiant de Compte, ni donnée personnelle.
function journaliser(contexte: string, code: string) {
  console.error(`[commande] ${contexte} : ${code}`);
}

const CODES_BASE: Record<string, CodeErreurCommande> = {
  KS_COMPTE_INCOMPLET: "compte_incomplet",
  KS_ACCEPTATION_MANQUANTE: "licence",
  KS_KIT_DEJA_POSSEDE: "deja_possede",
  KS_KIT_NON_GRATUIT: "indisponible",
  KS_PRODUIT_INTROUVABLE: "indisponible",
  KS_CLE_IDEMPOTENCE_INVALIDE: "invalide",
};

function codeDeLaBase(message: string): CodeErreurCommande {
  for (const [code, erreur] of Object.entries(CODES_BASE)) if (message.includes(code)) return erreur;
  return "erreur";
}

// Obtient le Kit gratuit d'un geste (FR-58). Le Compte vient de la session vérifiée, jamais de la saisie ; la base refuse tout le reste
// (Licence non acceptée, Kit payant, Kit non publié, Kit déjà possédé). Un succès n'est annoncé qu'après la réponse réelle de la base (règle 13).
export async function obtenirKitGratuit(deps: DependancesCommande, entree: EntreeObtenirKitGratuit): Promise<ResultatCommande<{ numero: string }>> {
  const lu = obtenirKitGratuitSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: entree?.licenceAcceptee !== true ? "licence" : "invalide" };

  let compte;
  try {
    compte = await deps.exigerCompte();
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "KS_NON_CONNECTE") return { ok: false, erreur: "non_connecte" };
    if (code === "KS_COMPTE_INCOMPLET") return { ok: false, erreur: "compte_incomplet" };
    journaliser("vérification du Compte", code || "inconnue");
    return { ok: false, erreur: "erreur" };
  }

  try {
    const r = await deps.offrirCommande({
      auteur: compte.auteur,
      produitId: lu.data.produitId,
      acceptations: [{ objet: "licence_kit", version: VERSION_LICENCE_KIT }],
      cleIdempotence: lu.data.cleIdempotence,
    });
    if (r.erreur) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("offrir_commande", "échec");
      return { ok: false, erreur };
    }
    if (!r.numero) return { ok: false, erreur: "erreur" };
    return { ok: true, numero: r.numero };
  } catch {
    journaliser("offrir_commande", "exception");
    return { ok: false, erreur: "erreur" };
  }
}
