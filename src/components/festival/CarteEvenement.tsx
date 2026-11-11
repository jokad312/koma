import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterDateBoutique } from "@/lib/dates";
import type { CarteEvenement as Donnees } from "@/modules/evenements/types";

type Props = {
  evenement: Donnees;
  // Titre de la carte : h3 sous les H2 de la liste, h3 aussi sous le H2 « Rendez-vous otaku » de l'accueil.
  niveau?: 2 | 3;
};

// Carte Événement (DESIGN : photo, date, titre, lieu ; lien sur le titre étendu à la carte). Sans photo, pas de vignette :
// aucune image inventée. La date est affichée à l'heure de la boutique, dans la langue de la page.
// Utilisable côté serveur (accueil) et côté client (« Voir plus » ajoute des cartes dans le navigateur).
export function CarteEvenement({ evenement, niveau = 3 }: Props) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Festival.prevenir.carte");
  const date = formaterDateBoutique(evenement.debutLe, locale);
  const Balise = niveau === 2 ? "h2" : "h3";

  return (
    <article
      data-carte={evenement.id}
      className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
    >
      {evenement.vignetteUrl ? (
        <div className="relative aspect-[4/3] w-full bg-background">
          <Image src={evenement.vignetteUrl} alt={evenement.vignetteAlt ?? ""} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-1 p-4">
        {date ? (
          <time dateTime={evenement.debutLe} className="t-label text-text-secondary">
            {date}
          </time>
        ) : null}
        <Balise className="t-h3">
          <Link href={`/festival/${evenement.slug}`} className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
            {evenement.titre}
          </Link>
        </Balise>
        {evenement.lieu ? <p className="t-small text-text-secondary">{evenement.lieu}</p> : null}
        {evenement.venteAVenir ? (
          // Au-dessus du lien étendu de la carte (z-10) : un lien distinct vers le formulaire « Me prévenir » de la page de l'événement.
          <Link href={`/festival/${evenement.slug}#prevenir`} className="t-label relative z-10 mt-1 inline-flex min-h-touch items-center self-start text-text-primary underline">
            {t("lien")}
            <span className="sr-only">{t("pour", { titre: evenement.titre })}</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}
