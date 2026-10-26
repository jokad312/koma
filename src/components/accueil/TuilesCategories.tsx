import { useLocale, useTranslations } from "next-intl";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const CATEGORIES = [
  { cle: "cosplays", interne: "/cosplays" },
  { cle: "accessoires", interne: "/accessoires" },
] as const;

// Deux tuiles de texte (aucune image : règle 6) vers les catalogues. Une colonne sous 360 px, deux au-delà.
// L'élévation au survol et au focus n'existe qu'en mouvement normal.
export function TuilesCategories() {
  const t = useTranslations("Accueil.categories");
  const locale = useLocale() as Locale;
  return (
    <section aria-labelledby="accueil-categories" className="flex flex-col gap-4">
      <div id="accueil-categories">
        <TitreVitrine niveau={2}>{t("titre")}</TitreVitrine>
      </div>
      <ul className="grid grid-cols-1 gap-ecart-cartes min-[360px]:grid-cols-2">
        {CATEGORIES.map(({ cle, interne }) => (
          <li key={cle}>
            <Link
              // Le dossier interne est traduit ici en adresse de la langue (« /accessories » en anglais) : le lien est déjà propre.
              href={cheminPublic(locale, interne)}
              className="flex h-full min-h-touch flex-col gap-1 rounded-lg border border-border bg-surface p-5 text-text-primary no-underline break-words motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
            >
              <span className="t-h3">{t(`${cle}.nom`)}</span>
              <span className="t-small text-text-secondary">{t(`${cle}.description`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
