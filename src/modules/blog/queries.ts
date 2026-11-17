import "server-only";
import { estFamilleProduit } from "@/modules/catalogue/types";
import { cacheTag } from "next/cache";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientService } from "@/lib/supabase/service";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { contientMarqueur, MARQUEUR_TEXTE } from "@/lib/vitrine/marqueur";
import type { Tables } from "@/lib/supabase/types";
import { encoderCurseurArticles } from "./adresse";
import { extraitArticle } from "./texte";
import { CUMUL_MAX_ARTICLES, TAILLE_PAGE_ARTICLES } from "./types";
import type {
  Article,
  ArticleImage,
  ArticleListe,
  ArticlePublic,
  CarteArticle,
  CurseurArticles,
  PageArticles,
  ProduitLie,
} from "./types";

// Colonnes lues par l'admin, d'après les types générés (src/lib/supabase/types.ts).
type LigneArticle = Pick<
  Tables<"article">,
  "id" | "auteur_id" | "titre_fr" | "titre_en" | "texte_fr" | "texte_en" | "extrait_fr" | "extrait_en" | "slug" | "lien_produit_id" | "images" | "publie_le" | "cree_le" | "modifie_le" | "archive_le"
>;

function client() {
  return creerClientService();
}

// Photos d'un article : seules les entrées complètes et au bon chemin sont rendues, jamais une valeur brute de la base.
function lireImages(brut: unknown): ArticleImage[] {
  if (!Array.isArray(brut)) return [];
  const images: ArticleImage[] = [];
  for (const item of brut) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.fichier !== "string" || typeof o.alt_fr !== "string" || typeof o.alt_en !== "string") continue;
    images.push({ fichier: o.fichier, altFr: o.alt_fr, altEn: o.alt_en });
  }
  return images;
}

function versArticle(ligne: LigneArticle): Article {
  return {
    id: ligne.id,
    auteurId: ligne.auteur_id,
    titreFr: ligne.titre_fr,
    titreEn: ligne.titre_en,
    texteFr: ligne.texte_fr ?? "",
    texteEn: ligne.texte_en,
    extraitFr: ligne.extrait_fr,
    extraitEn: ligne.extrait_en,
    slug: ligne.slug,
    lienProduitId: ligne.lien_produit_id,
    images: lireImages(ligne.images),
    publieLe: ligne.publie_le,
    creeLe: ligne.cree_le,
    modifieLe: ligne.modifie_le,
    archiveLe: ligne.archive_le,
  };
}

// Liste admin (droit vérifié par la page) : une erreur de lecture est relancée, jamais une liste vide inventée.
// Première image réellement enregistrée sur l'article (même sans texte alternatif : un brouillon peut ne pas l'avoir encore) ; jamais inventée.
function premiereImage(brut: unknown): { fichier: string; altFr: string } | null {
  if (!Array.isArray(brut) || brut.length === 0) return null;
  const o = brut[0] as Record<string, unknown> | null;
  if (typeof o !== "object" || o === null || typeof o.fichier !== "string" || o.fichier === "") return null;
  return { fichier: o.fichier, altFr: typeof o.alt_fr === "string" ? o.alt_fr.trim() : "" };
}

// Story 9.16 g) : la carte reçoit la première image (adresse publique, texte alternatif français ou titre) et l'extrait calculé ici ;
// le texte entier ne quitte jamais le serveur. Archivés compris : le filtre de la page les sépare.
export async function lireArticlesAdmin(): Promise<ArticleListe[]> {
  const { data, error } = await client()
    .from("article")
    .select("id, titre_fr, slug, publie_le, modifie_le, archive_le, images, texte_fr, extrait_fr")
    .order("modifie_le", { ascending: false });
  if (error) throw new Error("Lecture des articles impossible.");
  return (data ?? []).map((a) => {
    const premiere = premiereImage(a.images);
    return {
      id: a.id,
      titreFr: a.titre_fr,
      slug: a.slug,
      publieLe: a.publie_le,
      modifieLe: a.modifie_le,
      archiveLe: a.archive_le,
      // Texte alternatif : celui de l'image s'il est rempli (un brouillon peut ne pas l'avoir encore), sinon le titre de l'article.
      vignette: premiere ? { url: urlPhotoPublique(premiere.fichier), alt: premiere.altFr || a.titre_fr } : null,
      // Story 9.16 h) : l'extrait saisi est utilisé tel quel ; vide, les 160 premiers caractères du texte (Q28).
      extrait: extraitArticle(a.extrait_fr, a.texte_fr),
    };
  });
}

// Un article complet pour le formulaire d'édition ; null si l'identifiant est inconnu (404).
export async function lireArticleAdmin(id: string): Promise<Article | null> {
  const { data, error } = await client()
    .from("article")
    .select("id, auteur_id, titre_fr, titre_en, texte_fr, texte_en, extrait_fr, extrait_en, slug, lien_produit_id, images, publie_le, cree_le, modifie_le, archive_le")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lecture de l'article impossible.");
  return data ? versArticle(data) : null;
}

// ---- Lecture publique (story 8.7) ----

// Colonnes lues par les pages publiques, d'après les types générés.
type LignePublique = Pick<
  Tables<"article">,
  "id" | "slug" | "titre_fr" | "titre_en" | "texte_fr" | "texte_en" | "extrait_fr" | "extrait_en" | "publie_le" | "modifie_le" | "images" | "lien_produit_id"
>;

function clientPublic() {
  return creerClientPublic();
}

// Version anglaise réellement lisible : titre ET texte renseignés, non vides, sans marqueur de texte à fournir.
function aVersionAnglaise(ligne: { titre_en: string | null; texte_en: string | null }): boolean {
  const titre = ligne.titre_en?.trim() ?? "";
  const texte = ligne.texte_en?.trim() ?? "";
  return titre !== "" && texte !== "" && !contientMarqueur(titre) && !contientMarqueur(texte);
}

type FiltreVersionAnglaise<R> = {
  not(colonne: string, operateur: string, valeur: string | null): R;
  neq(colonne: string, valeur: string): R;
};

// Filtres de la version anglaise, posés en base pour que la pagination reste exacte. Le marqueur est cherché avec « like » ;
// les titres et textes sont déjà débarrassés de leurs espaces par la fonction d'enregistrement.
function filtrerVersionAnglaise<R extends FiltreVersionAnglaise<R>>(requete: R, locale: "fr" | "en"): R {
  if (locale !== "en") return requete;
  const motif = `*${MARQUEUR_TEXTE}*`;
  return requete
    .not("titre_en", "is", null)
    .neq("titre_en", "")
    .not("titre_en", "like", motif)
    .not("texte_en", "is", null)
    .neq("texte_en", "")
    .not("texte_en", "like", motif);
}

function titreDeLaLangue(locale: "fr" | "en", ligne: { titre_fr: string; titre_en: string | null }): string {
  return (locale === "en" ? ligne.titre_en?.trim() : "") || ligne.titre_fr;
}

// Le texte alternatif suit la langue quand il existe ; repli sur le français, jamais un texte inventé.
function altDeLaLangue(locale: "fr" | "en", image: ArticleImage): string {
  return locale === "en" ? image.altEn.trim() || image.altFr : image.altFr;
}

// Story 9.16 h) : extrait saisi dans la langue servie, null s'il est vide (jamais celui de l'autre langue sous /en : la page est en anglais).
// Un extrait qui contient le marqueur « [Texte à fournir] » n'est jamais montré au public (même règle que la version anglaise).
function extraitDeLaLangue(locale: "fr" | "en", ligne: { extrait_fr: string | null; extrait_en: string | null }): string | null {
  const brut = (locale === "en" ? ligne.extrait_en : ligne.extrait_fr)?.trim() ?? "";
  return brut !== "" && !contientMarqueur(brut) ? brut : null;
}

// Texte servi dans la langue : sous /en, le texte anglais (la liste /en n'a que des articles avec version anglaise), sinon le français.
function texteDeLaLangue(locale: "fr" | "en", ligne: { texte_fr: string | null; texte_en: string | null }): string {
  return (locale === "en" ? ligne.texte_en?.trim() : "") || ligne.texte_fr || "";
}

// Sans les colonnes de texte et d'extrait (carte courte de l'accueil), la carte n'a pas d'extrait : le texte n'est pas lu pour rien.
type LigneCarte = Pick<LignePublique, "id" | "slug" | "titre_fr" | "titre_en" | "publie_le" | "images"> &
  Partial<Pick<LignePublique, "texte_fr" | "texte_en" | "extrait_fr" | "extrait_en">>;

function versCarte(locale: "fr" | "en", ligne: LigneCarte, avecExtrait = true): CarteArticle | null {
  if (!ligne.slug || !ligne.publie_le) return null;
  const premiere = lireImages(ligne.images)[0];
  return {
    id: ligne.id,
    slug: ligne.slug,
    titre: titreDeLaLangue(locale, ligne),
    // Story 9.16 h) : extrait saisi, sinon les 160 premiers caractères du texte de la langue ; le texte entier n'est pas renvoyé.
    extrait:
      !avecExtrait
        ? null
        : extraitArticle(
            extraitDeLaLangue(locale, { extrait_fr: ligne.extrait_fr ?? null, extrait_en: ligne.extrait_en ?? null }),
            texteDeLaLangue(locale, { texte_fr: ligne.texte_fr ?? null, texte_en: ligne.texte_en ?? null }),
          ),
    publieLe: ligne.publie_le,
    vignetteUrl: premiere ? urlPhotoPublique(premiere.fichier) : null,
    vignetteAlt: premiere ? altDeLaLangue(locale, premiere) : null,
  };
}

// Une page de la liste publique : 12 Articles, du plus récent au plus ancien (publie_le desc, id desc).
//  - cumul (page à curseur) : relit depuis le début les n Articles déjà affichés plus les 12 suivants (jamais de décalage) ;
//  - sinon (Server Action « Voir plus ») : seulement les 12 suivants, par la clé de tri.
// La RLS ne montre que les Articles publiés ; sous /en, les Articles sans version anglaise sont écartés en base.
// Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function listerArticlesPublies(
  locale: "fr" | "en",
  curseur: CurseurArticles | null,
  options: { cumul?: boolean } = {},
): Promise<PageArticles> {
  "use cache";
  cacheTag(ETIQUETTES.articles);
  const cumul = Boolean(options.cumul && curseur);
  const dejaVus = curseur?.n ?? 0;
  const taille = TAILLE_PAGE_ARTICLES + (cumul ? dejaVus : 0);
  let requete = clientPublic()
    .from("article")
    .select("id, slug, titre_fr, titre_en, texte_fr, texte_en, extrait_fr, extrait_en, publie_le, images")
    .not("slug", "is", null)
    .order("publie_le", { ascending: false })
    .order("id", { ascending: false });
  requete = filtrerVersionAnglaise(requete, locale);
  // Curseur : Articles strictement après la clé de tri (publie_le, id). La page à curseur relit depuis le début.
  if (curseur && !cumul) {
    requete = requete.or(`publie_le.lt.${curseur.date},and(publie_le.eq.${curseur.date},id.lt.${curseur.id})`);
  }
  const { data, error } = await requete.range(0, taille);
  if (error || !data) throw new Error("Lecture du blog impossible.");

  const lignes = data.slice(0, taille);
  const articles = lignes.map((l) => versCarte(locale, l)).filter((a): a is CarteArticle => a !== null);
  const affiches = (cumul ? 0 : dejaVus) + articles.length;
  const dernier = lignes[lignes.length - 1];
  const suite =
    data.length > taille && dernier && dernier.publie_le && affiches < CUMUL_MAX_ARTICLES
      ? encoderCurseurArticles({ date: dernier.publie_le, id: dernier.id, n: affiches })
      : null;
  return { articles, suite };
}

// Les Articles les plus récents pour le bloc 7 de l'accueil. Une erreur est relancée : l'appelant masque le bloc.
export async function lireDerniersArticles(locale: "fr" | "en", limite = 3): Promise<CarteArticle[]> {
  "use cache";
  cacheTag(ETIQUETTES.articles);
  const maximum = Math.max(1, Math.min(limite, TAILLE_PAGE_ARTICLES));
  let requete = clientPublic()
    .from("article")
    .select("id, slug, titre_fr, titre_en, publie_le, images")
    .not("slug", "is", null)
    .order("publie_le", { ascending: false })
    .order("id", { ascending: false });
  requete = filtrerVersionAnglaise(requete, locale);
  const { data, error } = await requete.limit(maximum);
  if (error || !data) throw new Error("Lecture du blog impossible.");
  return data.map((l) => versCarte(locale, l, false)).filter((a): a is CarteArticle => a !== null);
}

// Un Produit lié, seulement s'il est publié (la RLS cache les brouillons et les retirés) : null sinon, aucun lien affiché.
// Étiqueté aussi « catalogue » : renommer un Produit met à jour le lien de l'Article.
export async function lireProduitLie(id: string, locale: "fr" | "en"): Promise<ProduitLie | null> {
  "use cache";
  cacheTag(ETIQUETTES.articles, ETIQUETTES.catalogue);
  const { data, error } = await creerClientPublic().from("produit").select("titre_fr, titre_en, slug, famille").eq("id", id).maybeSingle();
  if (error) throw new Error("Lecture du produit lié impossible.");
  if (!data || !estFamilleProduit(data.famille)) return null;
  return { titre: (locale === "en" ? data.titre_en?.trim() : "") || data.titre_fr, famille: data.famille, slug: data.slug };
}

// Un Article publié par son adresse, dans la langue demandée ; null : inconnu, brouillon, dépublié, ou sans version anglaise sous /en.
// Le Produit lié est lu dans la même lecture (RLS publique : seulement publié). Une erreur est relancée : jamais une page inventée.
export async function lireArticlePublie(locale: "fr" | "en", slug: string): Promise<ArticlePublic | null> {
  "use cache";
  cacheTag(ETIQUETTES.articles, ETIQUETTES.catalogue);
  const { data, error } = await clientPublic()
    .from("article")
    .select("id, slug, titre_fr, titre_en, texte_fr, texte_en, extrait_fr, extrait_en, publie_le, modifie_le, images, lien_produit_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Lecture de l'article impossible.");
  if (!data || !data.slug || !data.publie_le) return null;
  const versionAnglaise = aVersionAnglaise(data);
  if (locale === "en" && !versionAnglaise) return null;
  const images = lireImages(data.images);
  return {
    id: data.id,
    slug: data.slug,
    titre: titreDeLaLangue(locale, data),
    texte: texteDeLaLangue(locale, data),
    extrait: extraitDeLaLangue(locale, data),
    publieLe: data.publie_le,
    modifieLe: data.modifie_le,
    images: images.map((image) => ({ url: urlPhotoPublique(image.fichier), alt: altDeLaLangue(locale, image) })),
    produitLie: data.lien_produit_id ? await lireProduitLie(data.lien_produit_id, locale) : null,
    versionAnglaise,
  };
}

// Adresses des Articles publiés, lues par pages de 1000 jusqu'à épuisement, en cache « articles ».
// Une lecture impossible rend null (cause journalisée) : ce cache ne jette jamais, sinon le build échouerait en l'absence de base.
async function lireSlugsArticlesPubliesOuNull(): Promise<Array<{ slug: string; versionAnglaise: boolean }> | null> {
  "use cache";
  cacheTag(ETIQUETTES.articles);
  const TAILLE = 1000;
  const articles: Array<{ slug: string; versionAnglaise: boolean }> = [];
  try {
    for (let debut = 0; ; debut += TAILLE) {
      const { data, error } = await clientPublic()
        .from("article")
        .select("slug, titre_en, texte_en")
        .not("slug", "is", null)
        .order("publie_le", { ascending: false })
        .order("id", { ascending: true })
        .range(debut, debut + TAILLE - 1);
      if (error || !data) throw new Error("Lecture des articles publiés impossible.");
      for (const ligne of data) {
        if (ligne.slug) articles.push({ slug: ligne.slug, versionAnglaise: aVersionAnglaise(ligne) });
      }
      if (data.length < TAILLE) return articles;
    }
  } catch {
    console.error("[blog] lecture des articles publiés impossible : plan du site sans articles");
    return null;
  }
}

// Adresses des Articles publiés, pour le plan du site : le français toujours, l'anglais seulement si la version anglaise existe.
// Une lecture impossible est relancée (l'appelant garde le reste du plan et journalise) ; le cache interne, lui, ne jette jamais.
export async function lireSlugsArticlesPublies(): Promise<Array<{ slug: string; versionAnglaise: boolean }>> {
  const articles = await lireSlugsArticlesPubliesOuNull();
  if (!articles) throw new Error("Lecture des articles publiés impossible.");
  return articles;
}

// Adresses des Articles français sans version anglaise : le sélecteur de langue mène alors à la liste /en/blog.
// En cache « articles », vidé à chaque enregistrement ou publication. La liste est facultative : une lecture impossible rend []
// (le sélecteur garde son comportement habituel), jamais une valeur inventée.
export async function lireSlugsSansVersionAnglaise(): Promise<string[]> {
  "use cache";
  cacheTag(ETIQUETTES.articles);
  const articles = await lireSlugsArticlesPubliesOuNull();
  return (articles ?? []).filter((a) => !a.versionAnglaise).map((a) => a.slug);
}
