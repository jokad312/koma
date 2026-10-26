"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { cheminAutreLangue } from "@/i18n/adresses";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ecrireCookieLangue } from "@/lib/langue-cookie";

// Propose l'autre langue, écrite dans sa langue, sur la même page et avec la même requête (filtres, tri, curseur), vers l'adresse propre
// de l'autre langue (AD-16) ; le choix est mémorisé dans le cookie NEXT_LOCALE. useSearchParams impose un Suspense au parent (EnTete).
export function SelecteurLangue() {
  const t = useTranslations("Langue");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const requete = useSearchParams()?.toString() ?? "";
  const cible = routing.locales.find((l) => l !== locale) ?? locale;
  const chemin = cheminAutreLangue(pathname, locale, cible);
  const href = requete ? `${chemin}?${requete}` : chemin;

  return (
    <div role="group" aria-label={t("groupe")}>
      <Link
        href={href}
        locale={cible}
        lang={cible}
        hrefLang={cible}
        onClick={() => ecrireCookieLangue(cible)}
        className="t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary no-underline"
      >
        {t(`nom.${cible}`)}
      </Link>
    </div>
  );
}
