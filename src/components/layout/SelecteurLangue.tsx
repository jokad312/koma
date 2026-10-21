"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ecrireCookieLangue } from "@/lib/langue-cookie";

// Propose l'autre langue, écrite dans sa langue, sur la même page ; le choix est mémorisé dans le cookie NEXT_LOCALE.
export function SelecteurLangue() {
  const t = useTranslations("Langue");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const cible = routing.locales.find((l) => l !== locale) ?? locale;

  return (
    <div role="group" aria-label={t("groupe")}>
      <Link
        href={pathname}
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
