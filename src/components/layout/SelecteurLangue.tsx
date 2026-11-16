"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { cheminAutreLangue } from "@/i18n/adresses";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ecrireCookieLangue } from "@/lib/langue-cookie";

// Propose l'autre langue, écrite dans sa langue, sur la même page et avec la même requête (filtres, tri, curseur), vers l'adresse propre
// de l'autre langue (AD-16) ; le choix est mémorisé dans le cookie NEXT_LOCALE. useSearchParams impose un Suspense au parent (EnTete).
// `sansTraduction` : adresses des Articles français sans version anglaise ; depuis l'un d'eux, le sélecteur mène à la liste /en/blog.
// « rond » (barre du haut de l'admin, 9.16 b) : rond à contour de 44 px avec le code court de l'autre langue (« EN ») ; le nom accessible reste le nom
// complet (« English »), qui commence par le texte visible (WCAG 2.5.3).
type Props = { sansTraduction?: readonly string[]; variante?: "pastille" | "rond" };

export function SelecteurLangue({ sansTraduction = [], variante = "pastille" }: Props) {
  const t = useTranslations("Langue");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  let requete = useSearchParams()?.toString() ?? "";
  const cible = routing.locales.find((l) => l !== locale) ?? locale;
  let chemin = cheminAutreLangue(pathname, locale, cible);
  if (locale === "fr" && cible === "en") {
    const article = /^\/blog\/([^/]+)$/.exec(pathname);
    if (article && sansTraduction.includes(article[1])) {
      chemin = "/blog";
      requete = "";
    }
  }
  const href = requete ? `${chemin}?${requete}` : chemin;

  return (
    <div role="group" aria-label={t("groupe")}>
      <Link
        href={href}
        locale={cible}
        lang={cible}
        hrefLang={cible}
        onClick={() => ecrireCookieLangue(cible)}
        className={
          variante === "rond"
            ? "t-small inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-field text-text-primary no-underline"
            : "t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary no-underline"
        }
      >
        {variante === "rond" ? (
          <>
            <span aria-hidden="true">{t(`court.${cible}`)}</span>
            <span className="sr-only">{t(`nom.${cible}`)}</span>
          </>
        ) : (
          t(`nom.${cible}`)
        )}
      </Link>
    </div>
  );
}
