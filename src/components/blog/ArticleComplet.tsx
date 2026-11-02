import { getTranslations } from "next-intl/server";
import { ContenuArticle } from "@/components/blog/ContenuArticle";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterDateBoutique } from "@/lib/dates";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { articleJsonLd, filArianeJsonLd } from "@/lib/seo/jsonld";
import { urlLocalisee } from "@/lib/seo/url";
import { extraireTexte } from "@/modules/blog/texte";
import type { ArticlePublic } from "@/modules/blog/types";

const SEPARATEUR_FIL = "›";

// Dossier interne de la fiche du Produit lié (l'adresse de la langue est calculée par Link).
const DOSSIERS_FICHE = { cosplay: "/cosplays", accessoire: "/accessoires", kit: "/kits" } as const;

type Props = { article: ArticlePublic; locale: Locale; nomSite: string };

// Un Article complet : fil d'Ariane et JSON-LD, titre en H1 (Sakura Town avec repli), date de publication, texte nettoyé
// par ContenuArticle, galerie des images avec le texte alternatif de la langue, puis lien vers le Produit lié s'il est publié.
// Colonne de lecture de 720 px sur ordinateur (DESIGN). Aucun auteur, avis, compteur ni durée inventés.
export async function ArticleComplet({ article, locale, nomSite }: Props) {
  const t = await getTranslations({ locale, namespace: "Blog" });
  const date = formaterDateBoutique(article.publieLe, locale);
  const url = urlLocalisee(locale, `/blog/${article.slug}`);
  const produitLie = article.produitLie;
  const hrefProduit = produitLie ? cheminPublic(locale, `${DOSSIERS_FICHE[produitLie.famille]}/${produitLie.slug}`) : null;

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: t("fil.accueil"), url: urlLocalisee(locale) },
          { nom: t("titre"), url: urlLocalisee(locale, "/blog") },
          { nom: article.titre, url },
        ])}
      />
      <JsonLd
        donnees={articleJsonLd({
          titre: article.titre,
          description: extraireTexte(article.texte),
          images: article.images.map((image) => image.url),
          url,
          langue: locale,
          publieLe: article.publieLe,
          modifieLe: article.modifieLe,
          nomSite,
        })}
      />
      <nav aria-label={t("fil.navigation")}>
        <ol className="t-small flex flex-wrap items-center gap-2 text-text-secondary">
          <li>
            <Link href="/" className="inline-flex min-h-touch items-center text-text-primary underline">
              {t("fil.accueil")}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li>
            <Link href="/blog" className="inline-flex min-h-touch items-center text-text-primary underline">
              {t("titre")}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li aria-current="page">{article.titre}</li>
        </ol>
      </nav>
      <TitreVitrine niveau={1}>{article.titre}</TitreVitrine>
      {date ? (
        <p className="t-small text-text-secondary">
          <time dateTime={article.publieLe}>{date}</time>
        </p>
      ) : null}
      <ContenuArticle texte={article.texte} />
      {article.images.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {article.images.map((image) => (
            <li key={image.url}>
              {/* Image de galerie sans dimensions connues : <img> assumé (aucune optimisation Next possible sans taille). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt} loading="lazy" className="h-auto w-full rounded-md" />
            </li>
          ))}
        </ul>
      ) : null}
      {produitLie && hrefProduit ? (
        <p className="t-body">
          <Link
            href={hrefProduit}
            className="font-semibold text-text-primary underline decoration-primary decoration-2 underline-offset-2"
          >
            {produitLie.titre}
          </Link>
        </p>
      ) : null}
    </article>
  );
}
