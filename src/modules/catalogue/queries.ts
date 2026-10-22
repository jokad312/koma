import "server-only";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientService } from "@/lib/supabase/service";
import { choisirSlugLibre, SLUG_REGEX } from "./slug";
import type { FamillePhysique, ProduitAdmin, ProduitListe, Taille, UniversAdmin, UniversChoix } from "./types";

// Lectures admin par le client service (après le droit vérifié par la page) : une erreur de lecture est relancée,
// jamais une liste vide inventée. Aucune valeur de repli (règle 15).
export async function lireUniversAdmin(): Promise<UniversAdmin[]> {
  const { data, error } = await creerClientService().from("univers").select("id, nom_fr, nom_en").order("nom_fr", { ascending: true });
  if (error) throw new Error("Lecture des univers impossible.");
  return (data ?? []).map((u) => ({ id: u.id, nomFr: u.nom_fr, nomEn: u.nom_en }));
}

export async function lireProduitsAdmin(): Promise<ProduitListe[]> {
  const { data, error } = await creerClientService()
    .from("produit")
    .select("id, famille, titre_fr, slug, prix_cents, publie_le")
    .order("cree_le", { ascending: false });
  if (error) throw new Error("Lecture des produits impossible.");
  return (data ?? []).map((p) => ({
    id: p.id,
    famille: p.famille as FamillePhysique,
    titreFr: p.titre_fr,
    slug: p.slug,
    prixCents: p.prix_cents,
    publieLe: p.publie_le,
  }));
}

// Un produit et ses variantes pour la fiche d'édition ; null si l'identifiant est inconnu (404).
export async function lireProduitAdmin(id: string): Promise<ProduitAdmin | null> {
  const client = creerClientService();
  const { data, error } = await client
    .from("produit")
    .select(
      "id, famille, slug, titre_fr, titre_en, description_fr, description_en, univers_id, prix_cents, delai_fabrication_jours, publie_le",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lecture du produit impossible.");
  if (!data) return null;
  const variantes = await client
    .from("variante")
    .select("taille, stock, fabrication_sur_commande, delai_fabrication_jours")
    .eq("produit_id", id);
  if (variantes.error) throw new Error("Lecture des variantes impossible.");
  return {
    id: data.id,
    famille: data.famille as FamillePhysique,
    slug: data.slug,
    titreFr: data.titre_fr,
    titreEn: data.titre_en,
    descriptionFr: data.description_fr,
    descriptionEn: data.description_en,
    universId: data.univers_id,
    prixCents: data.prix_cents,
    delaiFabricationJours: data.delai_fabrication_jours,
    publieLe: data.publie_le,
    variantes: (variantes.data ?? []).map((v) => ({
      taille: v.taille as Taille,
      stock: v.stock,
      fabricationSurCommande: v.fabrication_sur_commande,
      delaiFabricationJours: v.delai_fabrication_jours,
    })),
  };
}

// Première adresse libre à partir d'une base valide (en excluant le produit lui-même quand il est modifié).
export async function premierSlugLibre(base: string, exclureId: string | null): Promise<string> {
  // La base ne contient que [a-z0-9-] : sans danger dans le motif « commence par ».
  if (!SLUG_REGEX.test(base)) throw new Error("Adresse de départ invalide.");
  let requete = creerClientService().from("produit").select("slug").like("slug", `${base}%`);
  if (exclureId) requete = requete.neq("id", exclureId);
  const { data, error } = await requete;
  if (error) throw new Error("Lecture des adresses impossible.");
  return choisirSlugLibre(base, new Set((data ?? []).map((p) => p.slug)));
}

// Univers proposés à la question d'accueil, dans la langue de la route : lecture publique (RLS), sans session.
// Une erreur est relancée : l'appelant décide (la question est facultative, l'étape continue sans elle).
export async function lireUniversPublics(locale: "fr" | "en"): Promise<UniversChoix[]> {
  const colonne = locale === "fr" ? "nom_fr" : "nom_en";
  const { data, error } = await creerClientPublic().from("univers").select(`id, ${colonne}`).order(colonne, { ascending: true });
  if (error) throw new Error("Lecture des univers impossible.");
  return ((data ?? []) as unknown as Array<Record<string, string>>).map((u) => ({ id: u.id, nom: u[colonne] }));
}
