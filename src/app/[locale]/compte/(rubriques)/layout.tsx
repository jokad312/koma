import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LienAdminCompte } from "@/components/layout/LienAdminCompte";

// Rubriques de « Mon compte » (bibliothèque, commandes, Pass, photos, Réalisation, préférences) : la navigation n'affiche que les entrées qui
// existent déjà (UX-DR37) et ramène à l'espace personnel. L'espace personnel (/compte, story 9.12) est hors de ce groupe : son H1 est « Bonjour … ».
export default async function CompteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Bibliotheque" });
  return (
    <section className="flex flex-col gap-6">
      <h1 className="t-h1">{t("compte.titre")}</h1>
      <nav aria-label={t("compte.navigation")}>
        <ul className="flex flex-wrap gap-4">
          <li>
            <Link href="/compte" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("compte.espace")}
            </Link>
          </li>
          <li>
            <Link href="/compte/bibliotheque" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("titre")}
            </Link>
          </li>
          <li>
            <Link href="/compte/commandes" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("compte.commandes")}
            </Link>
          </li>
          <li>
            <Link href="/compte/pass" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("compte.pass")}
            </Link>
          </li>
          <li>
            <Link href="/compte/photos" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("compte.photos")}
            </Link>
          </li>
          <li>
            <Link href="/compte/realisation" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("compte.realisation")}
            </Link>
          </li>
          <li>
            <Link href="/compte/preferences" className="t-small inline-flex min-h-touch items-center underline underline-offset-4">
              {t("compte.preferences")}
            </Link>
          </li>
          <Suspense fallback={null}>
            <LienAdminCompte />
          </Suspense>
        </ul>
      </nav>
      {children}
    </section>
  );
}
