import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { statutAffiche } from "./pass-groupes";
import type { PassLu, StatutPass } from "./pass-types";

const STATUTS: readonly StatutPass[] = ["valide", "scanne", "annule", "rembourse"];

function un<T>(valeur: T | T[] | null): T | null {
  return Array.isArray(valeur) ? (valeur[0] ?? null) : valeur;
}

const dansLaLangue = (locale: "fr" | "en", fr: string | null, en: string | null): string | null => {
  const texte = (locale === "en" ? en?.trim() : "") || fr?.trim() || "";
  return texte === "" ? null : texte;
};

// Les Pass du Compte connecté (story 7.5), lus côté serveur par son identifiant : la jointure sur la Commande filtre par Compte acheteur,
// et chaque ligne est revérifiée ici. Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function listerMesPass(compteId: string, locale: "fr" | "en"): Promise<PassLu[]> {
  const { data, error } = await creerClientService()
    .from("pass")
    .select(
      "id, nom_titulaire, statut, jeton, code_court, rang, cree_le, evenement:evenement_id(id, slug, titre_fr, titre_en, lieu_fr, lieu_en, debut_le, fin_le), ligne:ligne_commande_id(pass_nom_fr, pass_nom_en), commande:commande_id!inner(compte_id, offerte, statut)",
    )
    .eq("commande.compte_id", compteId)
    .order("cree_le", { ascending: true })
    .order("rang", { ascending: true });
  if (error) throw new Error("Lecture des Pass impossible.");

  const resultat: PassLu[] = [];
  for (const ligne of data ?? []) {
    const evenement = un(ligne.evenement);
    const commande = un(ligne.commande);
    const lignePass = un(ligne.ligne);
    const statut = STATUTS.find((s) => s === ligne.statut);
    if (!evenement || !commande || commande.compte_id !== compteId || !statut) continue;
    resultat.push({
      id: ligne.id,
      nomTitulaire: ligne.nom_titulaire,
      statut: statutAffiche(statut, commande.statut),
      typeNom: dansLaLangue(locale, lignePass?.pass_nom_fr ?? null, lignePass?.pass_nom_en ?? null) ?? "",
      jeton: ligne.jeton,
      codeCourt: ligne.code_court,
      offert: commande.offerte === true,
      evenement: {
        id: evenement.id,
        slug: evenement.slug,
        titre: dansLaLangue(locale, evenement.titre_fr, evenement.titre_en) ?? evenement.titre_fr,
        debutLe: evenement.debut_le,
        finLe: evenement.fin_le,
        lieu: dansLaLangue(locale, evenement.lieu_fr, evenement.lieu_en),
      },
    });
  }
  return resultat;
}
