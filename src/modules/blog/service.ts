import { nettoyerPhoto } from "@/modules/catalogue/photo";
import { proposerSlug } from "@/modules/catalogue/slug";
import { codeErreurSchema, schemaArticle } from "./schemas";
import { CHEMIN_IMAGE_ARTICLE, FORMATS_IMAGE_ARTICLE, IMAGE_ARTICLE_TAILLE_MAX, type Article, type CodeErreurBlog, type DependancesBlog, type ResultatBlog } from "./types";
import { BUCKET_ATTENTE, BUCKET_PUBLIC } from "@/lib/supabase/stockage";

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie ni un identifiant de Compte.
function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[blog] ${contexte} : ${code}`);
}

// Erreurs de la base propres à l'article (module blog) et leur code d'interface.
const ERREURS_ARTICLE: ReadonlyArray<readonly [string, CodeErreurBlog]> = [
  ["KS_ARTICLE_INVALIDE", "article_invalide"],
  ["KS_TITRE_INVALIDE", "titre_invalide"],
  ["KS_TEXTE_INVALIDE", "texte_invalide"],
  ["KS_SLUG_INVALIDE", "slug_invalide"],
  ["KS_SLUG_PRIS", "slug_pris"],
  ["KS_PRODUIT_INEXISTANT", "produit_inexistant"],
  ["KS_ARTICLE_INTROUVABLE", "article_introuvable"],
  ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

function erreurArticle(erreur: string): CodeErreurBlog {
  return ERREURS_ARTICLE.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

// Identifiant fourni par le navigateur : doit être un UUID, jamais un chemin ni une valeur libre.
function identifiantValide(valeur: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur);
}

// Crée (id vide) ou modifie un brouillon d'article : droit, validation, une seule écriture atomique.
export async function enregistrerArticle(
  deps: DependancesBlog,
  entree: { id: string | null; article: { titreFr: string; texteFr: string; titreEn: string | null; texteEn: string | null; slug: string | null; lienProduitId: string | null; images: Article["images"] } },
): Promise<ResultatBlog<{ id: string; cree: boolean }>> {
  const droit = await deps.exigerDroit("blog.gerer");
  if (entree.id !== null && !identifiantValide(entree.id)) return { ok: false, erreur: "article_introuvable" };
  const lu = schemaArticle.safeParse(entree.article);
  if (!lu.success) {
    // Le message de validation d'un champ est le code d'interface correspondant (titre_invalide, texte_invalide…).
    return { ok: false, erreur: codeErreurSchema(lu.error.issues[0]?.message) };
  }
  // L'adresse est facultative à la saisie : vide, elle est déduite du titre français (même règle que les Produits).
  // Un titre sans lettre latine ne donne aucune adresse : le refus est explicite.
  const slug = lu.data.slug ?? proposerSlug(lu.data.titreFr);
  if (slug === "") return { ok: false, erreur: "slug_invalide" };
  // La fonction Postgres lit des clés snake_case : la conversion est faite ici, jamais dans le navigateur.
  const article = {
    titre_fr: lu.data.titreFr,
    texte_fr: lu.data.texteFr,
    titre_en: lu.data.titreEn ?? null,
    texte_en: lu.data.texteEn ?? null,
    slug,
    lien_produit_id: lu.data.lienProduitId ?? null,
  };
  const images = lu.data.images.map((image) => ({ fichier: image.fichier, alt_fr: image.altFr, alt_en: image.altEn }));
  try {
    // Les images déjà enregistrées sont lues AVANT l'écriture : celles retirées seront effacées après la sauvegarde.
    const anciennes = entree.id !== null ? await deps.lireImagesArticle(entree.id).catch(() => []) : [];
    const { erreur, id } = await deps.enregistrerArticle({ auteur: droit.auteur, id: entree.id, article, images });
    if (erreur) {
      journaliser("article refusé", erreur);
      return { ok: false, erreur: erreurArticle(erreur) };
    }
    if (!id) return { ok: false, erreur: "generique" };
    // Fichiers publics qui ne sont plus référencés : effacés seulement maintenant, quand la base ne les cite plus.
    const gardees = new Set(lu.data.images.map((image) => image.fichier));
    for (const image of anciennes) {
      if (CHEMIN_IMAGE_ARTICLE.test(image.fichier) && !gardees.has(image.fichier)) {
        await deps.supprimerObjet({ bucket: BUCKET_PUBLIC, objet: image.fichier }).catch(() => {});
      }
    }
    await deps.invaliderArticles();
    return { ok: true, id, cree: entree.id === null };
  } catch (e) {
    journaliser("article", e);
    return { ok: false, erreur: "generique" };
  }
}

// Publie (publier = true) ou dépublie (publier = false) un article : droit, refus si la publication est incomplète.
export async function changerPublication(deps: DependancesBlog, entree: { id: string; publier: boolean }): Promise<ResultatBlog<{ id: string }>> {
  const droit = await deps.exigerDroit("blog.gerer");
  if (!identifiantValide(entree.id)) return { ok: false, erreur: "article_introuvable" };
  try {
    const { erreur } = await deps.changerPublication({ auteur: droit.auteur, id: entree.id, publier: entree.publier });
    if (erreur) {
      journaliser("article", erreur);
      return { ok: false, erreur: erreurArticle(erreur) };
    }
    await deps.invaliderArticles();
    return { ok: true, id: entree.id };
  } catch (e) {
    journaliser("article", e);
    return { ok: false, erreur: "generique" };
  }
}

// Contrôle du format et de la taille annoncés avant tout envoi ; le contenu réel est revérifié à la finalisation.
function fichierAnnonce(type: string, taille: number): { ok: true; ext: string } | { ok: false; erreur: CodeErreurBlog } {
  if (!Object.hasOwn(FORMATS_IMAGE_ARTICLE, type)) return { ok: false, erreur: "format_invalide" };
  const ext = FORMATS_IMAGE_ARTICLE[type as keyof typeof FORMATS_IMAGE_ARTICLE];
  if (!ext) return { ok: false, erreur: "format_invalide" };
  if (!Number.isInteger(taille) || taille < 1) return { ok: false, erreur: "format_invalide" };
  if (taille > IMAGE_ARTICLE_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  return { ok: true, ext };
}

// Autorise l'envoi direct d'une image d'article vers le bucket d'attente : chemin choisi par le serveur, jamais par le navigateur.
export async function demanderEnvoiImage(
  deps: DependancesBlog,
  entree: { type: string; taille: number },
): Promise<ResultatBlog<{ objet: string; jeton: string }>> {
  await deps.exigerDroit("blog.gerer");
  const fichier = fichierAnnonce(entree.type, entree.taille);
  if (!fichier.ok) return { ok: false, erreur: fichier.erreur };
  try {
    const objet = `articles/${crypto.randomUUID()}.${fichier.ext}`;
    const { erreur, jeton } = await deps.signerEnvoiImage({ objet });
    if (erreur || !jeton) {
      journaliser("jeton d'envoi d'image", erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton };
  } catch (e) {
    journaliser("envoi d'image", e);
    return { ok: false, erreur: "generique" };
  }
}

// Finalise une image : contrôle du contenu réel, métadonnées retirées, copie dans produits-public puis retour du chemin.
export async function finaliserImage(
  deps: DependancesBlog,
  entree: { objet: string; altFr: string; altEn: string },
): Promise<ResultatBlog<{ fichier: string; altFr: string; altEn: string }>> {
  await deps.exigerDroit("blog.gerer");
  if (!CHEMIN_IMAGE_ARTICLE.test(entree.objet)) return { ok: false, erreur: "format_invalide" };
  const altFr = entree.altFr.trim();
  const altEn = entree.altEn.trim();
  if (altFr === "" || altFr.length > 200 || altEn === "" || altEn.length > 200) return { ok: false, erreur: "alt_invalide" };

  let objetPublic: string | null = null;
  try {
    const lu = await deps.lireObjetAttente(entree.objet);
    if (lu.erreur || !lu.octets) {
      journaliser("lecture de l'image", lu.erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    if (lu.octets.byteLength > IMAGE_ARTICLE_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };

    const propre = await nettoyerPhoto(lu.octets);
    if (!propre.ok) return { ok: false, erreur: "format_invalide" };

    objetPublic = `articles/${crypto.randomUUID()}.${propre.ext}`;
    const ecrit = await deps.ecrireObjetPublic({ objet: objetPublic, octets: propre.octets, contentType: propre.contentType });
    if (ecrit.erreur) {
      journaliser("écriture de l'image", ecrit.erreur);
      // L'original d'attente est effacé : le formulaire recommencera l'envoi.
      await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet });
      return { ok: false, erreur: "generique" };
    }
    await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet });
    return { ok: true, fichier: objetPublic, altFr, altEn };
  } catch (e) {
    journaliser("image", e);
    // Sauf si la copie publique a pu être écrite (résultat inconnu), rien ne reste.
    if (objetPublic === null) await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet }).catch(() => {});
    return { ok: false, erreur: "generique" };
  }
}

// Envoi abandonné : l'objet d'attente est effacé, jamais un fichier public.
export async function annulerEnvoiImage(deps: DependancesBlog, entree: { objet: string }): Promise<ResultatBlog> {
  await deps.exigerDroit("blog.gerer");
  if (!CHEMIN_IMAGE_ARTICLE.test(entree.objet)) return { ok: false, erreur: "format_invalide" };
  try {
    const { erreur } = await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet });
    if (erreur) {
      journaliser("annulation d'image", erreur);
      return { ok: false, erreur: "generique" };
    }
    return { ok: true };
  } catch (e) {
    journaliser("annulation d'image", e);
    return { ok: false, erreur: "generique" };
  }
}
