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
// Partout (site et admin, décision de Jonathan du 2026-11-21) : le texte visible est le code de la langue ACTUELLE (« FR » sur une page française),
// le nom accessible dit l'action (« Changer de langue : English »). « rond » : rond à contour de 44 px (barre de l'admin, connexion) ; « pastille » :
// pastille de l'en-tête du site et du menu mobile de l'admin.
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
        hrefLang={cible}
        aria-label={t("changer", { langue: t(`nom.${cible}`) })}
        onClick={() => ecrireCookieLangue(cible)}
        className={
          variante === "rond"
            ? "t-small inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-field text-text-primary no-underline"
            : "t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary no-underline"
        }
      >
        {t(`court.${locale}`)}
      </Link>
    </div>
  );
}
