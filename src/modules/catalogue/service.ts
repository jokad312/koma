import type { AuteurCompte } from "@/lib/auth/auteur";
import { lireProduit, lireUnivers } from "./schemas";
import type { ChampProduit, CodeErreurCatalogue, DependancesCatalogue, EntreeProduit, EntreeUnivers, ResultatCatalogue } from "./types";

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie ni un identifiant de Compte.
function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[catalogue] ${contexte} : ${code}`);
}

async function verifierDroit(deps: DependancesCatalogue): Promise<{ auteur: AuteurCompte } | { erreur: CodeErreurCatalogue }> {
  try {
    return { auteur: (await deps.exigerDroit("produits.modifier")).auteur };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    journaliser("droit", code);
    return { erreur: code === "KS_VERIFICATION_IMPOSSIBLE" ? "generique" : "non_autorise" };
  }
}

// Erreur de la base d'un produit : code d'interface et champ concerné, sans donnée saisie.
const ERREURS_PRODUIT: ReadonlyArray<readonly [string, CodeErreurCatalogue, ChampProduit | undefined]> = [
  ["KS_FAMILLE_INVALIDE", "famille_invalide", "famille"],
  ["KS_TITRE_INVALIDE", "titre_invalide", "titre_fr"],
  ["KS_SLUG_INVALIDE", "slug_invalide", "slug"],
  ["KS_PRIX_INVALIDE", "prix_invalide", "prix"],
  ["KS_DELAI_INVALIDE", "delai_invalide", "delai"],
  ["KS_TEXTE_INVALIDE", "texte_invalide", "description_fr"],
  ["KS_UNIVERS_INTROUVABLE", "univers_invalide", "univers"],
  ["KS_TAILLE_INVALIDE", "taille_invalide", "variantes"],
  ["KS_STOCK_INVALIDE", "stock_invalide", "variantes"],
  ["KS_DELAI_MANQUANT", "delai_manquant", "variantes"],
  ["KS_PRODUIT_INTROUVABLE", "produit_introuvable", undefined],
  ["KS_DROIT_REFUSE", "non_autorise", undefined],
  ["KS_AUTEUR_MANQUANT", "non_autorise", undefined],
];

// Crée un univers (création seulement) : droit, validation, écriture ; « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13).
export async function creerUnivers(deps: DependancesCatalogue, entree: EntreeUnivers): Promise<ResultatCatalogue<{ id: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = lireUnivers(entree);
  if (!lu.ok) return { ok: false, erreur: "nom_invalide", champ: lu.champ };

  try {
    const { erreur, id } = await deps.ecrireUnivers({ auteur: droit.auteur, nomFr: lu.nomFr, nomEn: lu.nomEn });
    if (erreur) {
      journaliser("univers refusé", erreur);
      if (erreur.includes("KS_UNIVERS_EXISTE")) return { ok: false, erreur: "univers_existe" };
      if (erreur.includes("KS_UNIVERS_INVALIDE")) return { ok: false, erreur: "nom_invalide" };
      if (erreur.includes("KS_DROIT_REFUSE") || erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    if (!id) return { ok: false, erreur: "generique" };
    return { ok: true, id };
  } catch (e) {
    journaliser("univers", e);
    return { ok: false, erreur: "generique" };
  }
}

// Crée (id vide) ou modifie un brouillon de produit physique avec ses variantes : droit, validation, une seule écriture atomique.
// Jamais de publication ici (story 2.2). Adresse déjà prise : erreur sur le champ avec la première adresse libre.
export async function enregistrerProduit(deps: DependancesCatalogue, entree: EntreeProduit): Promise<ResultatCatalogue<{ id: string; cree: boolean }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = lireProduit(entree);
  if (!lu.ok) return lu;

  try {
    const { erreur, id } = await deps.ecrireProduit({ auteur: droit.auteur, id: lu.id, produit: lu.produit, variantes: lu.variantes });
    if (erreur) {
      journaliser("produit refusé", erreur);
      if (erreur.includes("KS_SLUG_PRIS")) {
        let slugPropose: string | undefined;
        try {
          slugPropose = await deps.premierSlugLibre(lu.produit.slug, lu.id);
        } catch (e) {
          journaliser("adresse libre", e);
        }
        return { ok: false, erreur: "slug_pris", champ: "slug", slugPropose };
      }
      const connue = ERREURS_PRODUIT.find(([code]) => erreur.includes(code));
      if (connue) return { ok: false, erreur: connue[1], champ: connue[2] };
      return { ok: false, erreur: "generique" };
    }
    if (!id) return { ok: false, erreur: "generique" };
    return { ok: true, id, cree: lu.id === null };
  } catch (e) {
    journaliser("produit", e);
    return { ok: false, erreur: "generique" };
  }
}
