import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterDateBoutique } from "@/lib/dates";
import type { CarteArticle as Donnees } from "@/modules/blog/types";

type Props = {
  article: Donnees;
  // Titre de la carte : h2 dans la liste du Blog, h3 sous le H2 « Guides » de l'accueil.
  niveau?: 2 | 3 | 4;
};

// Carte Article (DESIGN : vignette + titre + date, lien étendu à la carte). Sans image, la carte n'a pas de vignette :
// aucune image inventée. La date est affichée à l'heure de la boutique, dans la langue de la page.
// Utilisable côté serveur et côté client (« Voir plus » ajoute des cartes dans le navigateur).
export function CarteArticle({ article, niveau = 2 }: Props) {
  const locale = useLocale() as Locale;
  const date = formaterDateBoutique(article.publieLe, locale);
  const href = `/blog/${article.slug}`;
  const Balise = niveau === 2 ? "h2" : niveau === 3 ? "h3" : "h4";

  return (
    <article
      data-carte={article.id}
      className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
    >
      {article.vignetteUrl ? (
        <div className="relative aspect-[4/3] w-full bg-background">
          <Image
            src={article.vignetteUrl}
            alt={article.vignetteAlt ?? ""}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <Balise className="t-h3">
          <Link href={href} className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
            {article.titre}
          </Link>
        </Balise>
        {date ? (
          <time dateTime={article.publieLe} className="t-small text-text-secondary">
            {date}
          </time>
        ) : null}
      </div>
    </article>
  );
}
