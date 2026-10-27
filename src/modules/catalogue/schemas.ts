import { z } from "zod";
import { analyserMontantUsd, analyserPrixUsd, PRIX_MAX_CENTS } from "@/lib/argent";
import { SLUG_MAX, SLUG_REGEX } from "./slug";
import { FAMILLES_PHYSIQUES, FORMATS_PHOTO, NIVEAUX_KIT, PHOTO_TAILLE_MAX, TAILLES } from "./types";
import type { ChampProduit, ChampUnivers, CodeErreurCatalogue, EntreeKit, EntreeProduit, EntreeUnivers, ErreurCatalogue, KitEcrit, ProduitEcrit, Taille, VarianteEcrite } from "./types";

export const idSchema = z.uuid();

// Univers : noms de 1 à 60 caractères, rognés.
const nomUniversSchema = z.string().trim().min(1).max(60);

export function lireUnivers(entree: EntreeUnivers): { ok: true; nomFr: string; nomEn: string } | { ok: false; champ: ChampUnivers } {
  const fr = nomUniversSchema.safeParse(entree.nomFr);
  if (!fr.success) return { ok: false, champ: "nom_fr" };
  const en = nomUniversSchema.safeParse(entree.nomEn);
  if (!en.success) return { ok: false, champ: "nom_en" };
  return { ok: true, nomFr: fr.data, nomEn: en.data };
}

const titreSchema = z.string().trim().min(1).max(120);
const titreFacultatifSchema = z.string().trim().max(120);
const texteSchema = z.string().trim().max(5000);
const slugSchema = z.string().trim().min(1).max(SLUG_MAX).regex(SLUG_REGEX);
const stockSchema = z.string().trim().regex(/^[0-9]{1,9}$/);

// Délai de fabrication en jours : vide = non fixé (null), sinon entier de 1 à 365.
function lireDelai(texte: string): { ok: true; valeur: number | null } | { ok: false } {
  const saisie = texte.trim();
  if (saisie === "") return { ok: true, valeur: null };
  if (!/^[0-9]{1,4}$/.test(saisie)) return { ok: false };
  const valeur = Number(saisie);
  return valeur >= 1 && valeur <= 365 ? { ok: true, valeur } : { ok: false };
}

const echec = (erreur: CodeErreurCatalogue, champ?: ChampProduit, taille?: Taille): ErreurCatalogue => ({ ok: false, erreur, champ, taille });

// Valide ce que le formulaire envoie et le convertit en ce que la base recevra (la base revalide tout : AD-13).
// Un brouillon peut être incomplet : seuls la famille, le titre français et l'adresse sont obligatoires.
// La première erreur rencontrée est renvoyée, dans l'ordre du formulaire.
export function lireProduit(
  entree: EntreeProduit,
): { ok: true; id: string | null; produit: ProduitEcrit; variantes: VarianteEcrite[] } | ErreurCatalogue {
  const famille = z.enum(FAMILLES_PHYSIQUES).safeParse(entree.famille);
  if (!famille.success) return echec("famille_invalide", "famille");

  const titreFr = titreSchema.safeParse(entree.titreFr);
  if (!titreFr.success) return echec("titre_invalide", "titre_fr");
  const titreEn = titreFacultatifSchema.safeParse(entree.titreEn);
  if (!titreEn.success) return echec("titre_invalide", "titre_en");

  const slug = slugSchema.safeParse(entree.slug);
  if (!slug.success) return echec("slug_invalide", "slug");

  let prixCents: number | null = null;
  const prix = analyserPrixUsd(entree.prix);
  if (prix.ok) prixCents = prix.cents;
  else if (prix.raison === "invalide") return echec("prix_invalide", "prix");

  const delai = lireDelai(entree.delai);
  if (!delai.ok) return echec("delai_invalide", "delai");

  let universId: string | null = null;
  if (entree.universId.trim() !== "") {
    const univers = idSchema.safeParse(entree.universId.trim());
    if (!univers.success) return echec("univers_invalide", "univers");
    universId = univers.data;
  }

  const descriptionFr = texteSchema.safeParse(entree.descriptionFr);
  if (!descriptionFr.success) return echec("texte_invalide", "description_fr");
  const descriptionEn = texteSchema.safeParse(entree.descriptionEn);
  if (!descriptionEn.success) return echec("texte_invalide", "description_en");

  let id: string | null = null;
  if (entree.id.trim() !== "") {
    const lu = idSchema.safeParse(entree.id.trim());
    if (!lu.success) return echec("produit_introuvable");
    id = lu.data;
  }

  const variantes: VarianteEcrite[] = [];
  const vues = new Set<string>();
  for (const v of entree.variantes) {
    const taille = z.enum(TAILLES).safeParse(v.taille);
    if (!taille.success) return echec("taille_invalide", "variantes");
    // Sur-mesure : cosplay seulement. Une seule ligne par taille.
    if (taille.data === "sur_mesure" && famille.data !== "cosplay") return echec("taille_invalide", "variantes", taille.data);
    if (vues.has(taille.data)) return echec("taille_invalide", "variantes", taille.data);
    vues.add(taille.data);

    const delaiVariante = lireDelai(v.delai);
    if (!delaiVariante.ok) return echec("delai_invalide", "variantes", taille.data);

    // Sur-mesure : toujours fabriqué, stock 0 (AD-26).
    const surMesure = taille.data === "sur_mesure";
    let stock = 0;
    if (!surMesure) {
      if (!stockSchema.safeParse(v.stock).success) return echec("stock_invalide", "variantes", taille.data);
      stock = Number(v.stock.trim());
    }
    const fabrication = surMesure || v.surCommande;
    // Fabrication sur commande : un délai est exigé (celui de la variante, sinon celui du produit).
    if (fabrication && (delaiVariante.valeur ?? delai.valeur) === null) return echec("delai_manquant", "variantes", taille.data);
    variantes.push({ taille: taille.data, stock, fabrication_sur_commande: fabrication, delai_fabrication_jours: delaiVariante.valeur });
  }

  return {
    ok: true,
    id,
    produit: {
      famille: famille.data,
      slug: slug.data,
      titre_fr: titreFr.data,
      titre_en: titreEn.data || null,
      description_fr: descriptionFr.data || null,
      description_en: descriptionEn.data || null,
      univers_id: universId,
      prix_cents: prixCents,
      delai_fabrication_jours: delai.valeur,
    },
    variantes,
  };
}

// Valide ce que le formulaire de Kit envoie et le convertit en ce que la base recevra (la base revalide tout : AD-13).
// Un brouillon de Kit peut être incomplet : seuls le titre français et l'adresse sont obligatoires. Prix : 0 admis (Kit gratuit).
export function lireKit(entree: EntreeKit): { ok: true; id: string | null; kit: KitEcrit } | ErreurCatalogue {
  const titreFr = titreSchema.safeParse(entree.titreFr);
  if (!titreFr.success) return echec("titre_invalide", "titre_fr");
  const titreEn = titreFacultatifSchema.safeParse(entree.titreEn);
  if (!titreEn.success) return echec("titre_invalide", "titre_en");

  const slug = slugSchema.safeParse(entree.slug);
  if (!slug.success) return echec("slug_invalide", "slug");

  let prixCents: number | null = null;
  const prix = analyserMontantUsd(entree.prix, PRIX_MAX_CENTS);
  if (prix.ok) prixCents = prix.cents;
  else if (prix.raison === "invalide") return echec("prix_invalide", "prix");

  let niveau: KitEcrit["niveau"] = null;
  if (entree.niveau.trim() !== "") {
    const lu = z.enum(NIVEAUX_KIT).safeParse(entree.niveau.trim());
    if (!lu.success) return echec("niveau_invalide", "niveau");
    niveau = lu.data;
  }

  let universId: string | null = null;
  if (entree.universId.trim() !== "") {
    const univers = idSchema.safeParse(entree.universId.trim());
    if (!univers.success) return echec("univers_invalide", "univers");
    universId = univers.data;
  }

  let produitLieId: string | null = null;
  if (entree.produitLieId.trim() !== "") {
    const lie = idSchema.safeParse(entree.produitLieId.trim());
    if (!lie.success) return echec("kit_lie_invalide", "kit_lie");
    produitLieId = lie.data;
  }

  const descriptionFr = texteSchema.safeParse(entree.descriptionFr);
  if (!descriptionFr.success) return echec("texte_invalide", "description_fr");
  const descriptionEn = texteSchema.safeParse(entree.descriptionEn);
  if (!descriptionEn.success) return echec("texte_invalide", "description_en");
  const materielFr = texteSchema.safeParse(entree.materielFr);
  if (!materielFr.success) return echec("texte_invalide", "materiel_fr");
  const materielEn = texteSchema.safeParse(entree.materielEn);
  if (!materielEn.success) return echec("texte_invalide", "materiel_en");

  let id: string | null = null;
  if (entree.id.trim() !== "") {
    const lu = idSchema.safeParse(entree.id.trim());
    if (!lu.success) return echec("produit_introuvable");
    id = lu.data;
  }

  return {
    ok: true,
    id,
    kit: {
      famille: "kit",
      slug: slug.data,
      titre_fr: titreFr.data,
      titre_en: titreEn.data || null,
      description_fr: descriptionFr.data || null,
      description_en: descriptionEn.data || null,
      materiel_fr: materielFr.data || null,
      materiel_en: materielEn.data || null,
      univers_id: universId,
      prix_cents: prixCents,
      niveau,
      produit_lie_id: produitLieId,
    },
  };
}

// Texte alternatif d'une photo : 1 à 200 caractères, rogné, dans chaque langue.
const altSchema = z.string().trim().min(1).max(200);

export function lireAlt(altFr: string, altEn: string): { ok: true; altFr: string; altEn: string } | { ok: false } {
  const fr = altSchema.safeParse(altFr);
  const en = altSchema.safeParse(altEn);
  return fr.success && en.success ? { ok: true, altFr: fr.data, altEn: en.data } : { ok: false };
}

// Type et taille annoncés avant l'envoi : refus avant tout envoi. Le contenu réel est revérifié à la finalisation.
export function lireFichierAnnonce(type: string, taille: number): { ok: true; ext: "jpg" | "png" | "webp" } | { ok: false; erreur: "format_invalide" | "fichier_trop_lourd" } {
  if (!Object.hasOwn(FORMATS_PHOTO, type)) return { ok: false, erreur: "format_invalide" };
  const ext = FORMATS_PHOTO[type as keyof typeof FORMATS_PHOTO];
  if (!ext) return { ok: false, erreur: "format_invalide" };
  if (!Number.isInteger(taille) || taille < 1) return { ok: false, erreur: "format_invalide" };
  if (taille > PHOTO_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  return { ok: true, ext };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Objet d'attente <produit>/<uuid>.<ext> : doit appartenir au produit (le navigateur ne choisit jamais un autre chemin).
export function objetAttenteValide(objet: string, produitId: string): boolean {
  return new RegExp(`^${produitId}/${UUID}[.](jpg|png|webp)$`, "i").test(objet);
}
