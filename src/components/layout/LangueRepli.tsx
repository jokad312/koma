import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Affiché pendant que SelecteurLangue attend le chemin de la page (usePathname n'est connu qu'à la requête sur les
// routes sans paramètres connus, comme les 404) : lien vers l'accueil de l'autre langue, utilisable sans JavaScript.
export async function LangueRepli() {
  const t = await getTranslations("Langue");
  const locale = (await getLocale()) as Locale;
  const cible = routing.locales.find((l) => l !== locale) ?? locale;
  return (
    <div role="group" aria-label={t("groupe")}>
      <Link
        href="/"
        locale={cible}
        lang={cible}
        hrefLang={cible}
        className="t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary no-underline"
      >
        {t(`nom.${cible}`)}
      </Link>
    </div>
  );
}
