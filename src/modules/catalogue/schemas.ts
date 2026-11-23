import { z } from "zod";
import { analyserMontantUsd, analyserPrixUsd, PRIX_MAX_CENTS } from "@/lib/argent";
import { SLUG_MAX, SLUG_REGEX } from "./slug";
import { COULEUR_HEX_REGEX, COULEUR_MAX, estPhysique, FORMATS_PHOTO, NIVEAUX_KIT, PHOTO_TAILLE_MAX, TAILLES, taillesDeLaFamille } from "./types";
import type { ChampProduit, ChampUnivers, CodeErreurCatalogue, EntreeKit, EntreeProduit, EntreeUnivers, ErreurCatalogue, KitEcrit, ProduitEcrit, Taille, VarianteEcrite } from "./types";

export const idSchema = z.uuid();

// Univers : noms de 1 à 60 caractères, rognés.
const nomUniversSchema = z.string().trim().min(1).max(60);

// Texte anglais obligatoire en base mais sans champ dans l'admin (site en français uniquement, décision Q5 du 2026-11-22) :
// vide, il reçoit la copie du français ; une valeur anglaise saisie (ou renvoyée telle quelle) est gardée.
export function anglaisOuCopie(en: string | null | undefined, fr: string): string {
  const saisi = (en ?? "").trim();
  return saisi === "" ? fr : saisi;
}

export function lireUnivers(entree: EntreeUnivers): { ok: true; nomFr: string; nomEn: string } | { ok: false; champ: ChampUnivers } {
  const fr = nomUniversSchema.safeParse(entree.nomFr);
  if (!fr.success) return { ok: false, champ: "nom_fr" };
  const en = nomUniversSchema.safeParse(anglaisOuCopie(entree.nomEn, fr.data));
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

const echec = (erreur: CodeErreurCatalogue, champ?: ChampProduit, taille?: Taille, couleur?: string): ErreurCatalogue =>
  couleur === undefined ? { ok: false, erreur, champ, taille } : { ok: false, erreur, champ, taille, couleur };

// Valide ce que le formulaire envoie et le convertit en ce que la base recevra (la base revalide tout : AD-13).
// Un brouillon peut être incomplet : seuls la famille, le titre français et l'adresse sont obligatoires.
// La première erreur rencontrée est renvoyée, dans l'ordre du formulaire.
export function lireProduit(
  entree: EntreeProduit,
): { ok: true; id: string | null; produit: ProduitEcrit; variantes: VarianteEcrite[] } | ErreurCatalogue {
  if (!estPhysique(entree.famille)) return echec("famille_invalide", "famille");
  const famille = { data: entree.famille };

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
  const tailles = taillesDeLaFamille(famille.data);
  // Une couleur garde le même nom anglais et la même pastille sur toutes ses tailles (clé : nom français sans tenir compte de la casse).
  const couleurs = new Map<string, string>();
  let avecCouleur = 0;
  for (const v of entree.variantes) {
    const taille = z.enum(TAILLES).safeParse(v.taille);
    if (!taille.success) return echec("taille_invalide", "variantes");
    // Sur-mesure : cosplay seulement ; « unique » : Autre article seulement ; Vêtement et Accessoire : XS à XXL.
    if (!tailles.includes(taille.data)) return echec("taille_invalide", "variantes", taille.data);

    const couleurFr = (v.couleurFr ?? "").trim();
    const couleurEn = (v.couleurEn ?? "").trim();
    const couleurHex = (v.couleurHex ?? "").trim().toUpperCase();
    if (couleurFr === "" && (couleurEn !== "" || couleurHex !== "")) return echec("couleur_invalide", "variantes", taille.data);
    if (couleurFr !== "") {
      if (famille.data !== "vetement" || couleurFr.length > COULEUR_MAX || couleurEn.length > COULEUR_MAX || (couleurHex !== "" && !COULEUR_HEX_REGEX.test(couleurHex))) {
        return echec("couleur_invalide", "variantes", taille.data, couleurFr);
      }
      // Nom anglais et pastille joints avec un séparateur (« Black » + « #1B1713 » ne se confond jamais avec « Black#1B1713 »).
      const signature = [couleurFr, couleurEn, couleurHex].join("\u001f");
      const deja = couleurs.get(couleurFr.toLowerCase());
      if (deja !== undefined && deja !== signature) return echec("couleur_invalide", "variantes", taille.data, couleurFr);
      couleurs.set(couleurFr.toLowerCase(), signature);
      avecCouleur += 1;
    }

    // Une seule ligne par couple (taille, couleur).
    const cle = `${taille.data}${couleurFr.toLowerCase()}`;
    if (vues.has(cle)) return echec("taille_invalide", "variantes", taille.data, couleurFr || undefined);
    vues.add(cle);

    let idVariante: string | undefined;
    if ((v.id ?? "").trim() !== "") {
      const lu = idSchema.safeParse((v.id ?? "").trim());
      if (!lu.success) return echec("taille_invalide", "variantes", taille.data, couleurFr || undefined);
      idVariante = lu.data;
    }

    const delaiVariante = lireDelai(v.delai);
    if (!delaiVariante.ok) return echec("delai_invalide", "variantes", taille.data, couleurFr || undefined);

    // Sur-mesure : toujours fabriqué, stock 0 (AD-26).
    const surMesure = taille.data === "sur_mesure";
    let stock = 0;
    if (!surMesure) {
      if (!stockSchema.safeParse(v.stock).success) return echec("stock_invalide", "variantes", taille.data, couleurFr || undefined);
      stock = Number(v.stock.trim());
    }
    const fabrication = surMesure || v.surCommande;
    // Fabrication sur commande : un délai est exigé (celui de la variante, sinon celui du produit).
    if (fabrication && (delaiVariante.valeur ?? delai.valeur) === null) return echec("delai_manquant", "variantes", taille.data, couleurFr || undefined);
    variantes.push({
      ...(idVariante ? { id: idVariante } : {}),
      taille: taille.data,
      couleur_fr: couleurFr || null,
      couleur_en: couleurFr && couleurEn ? couleurEn : null,
      couleur_hex: couleurFr && couleurHex ? couleurHex : null,
      stock,
      fabrication_sur_commande: fabrication,
      delai_fabrication_jours: delaiVariante.valeur,
    });
  }
  // Vêtement : toutes les variantes ont une couleur, ou aucune.
  if (avecCouleur > 0 && avecCouleur < variantes.length) return echec("couleur_invalide", "variantes");
  // Autre article : sa variante « Taille unique » existe toujours (la base la crée aussi d'office).
  if (famille.data === "autre" && variantes.length === 0) {
    variantes.push({ taille: "unique", couleur_fr: null, couleur_en: null, couleur_hex: null, stock: 0, fabrication_sur_commande: false, delai_fabrication_jours: null });
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

// Texte alternatif d'une photo : 1 à 200 caractères, rogné, dans chaque langue. Anglais vide : copie du français (Q5).
const altSchema = z.string().trim().min(1).max(200);

export function lireAlt(altFr: string, altEn: string): { ok: true; altFr: string; altEn: string } | { ok: false } {
  const fr = altSchema.safeParse(altFr);
  const en = altSchema.safeParse(anglaisOuCopie(altEn, (altFr ?? "").trim()));
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
