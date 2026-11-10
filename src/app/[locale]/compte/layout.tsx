import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { estAdminConnecte } from "@/lib/auth/est-admin";

// « Mon compte » : la navigation n'affiche que les entrées qui existent déjà (UX-DR37). Aujourd'hui : Ma bibliothèque.
export default async function CompteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Bibliotheque" });
  const ta = await getTranslations({ locale, namespace: "Admin.nav" });
  const admin = await estAdminConnecte();
  return (
    <section className="flex flex-col gap-6">
      <h1 className="t-h1">{t("compte.titre")}</h1>
      <nav aria-label={t("compte.navigation")}>
        <ul className="flex flex-wrap gap-4">
          <li>
            <Link href="/compte/bibliotheque" className="t-small underline underline-offset-4">
              {t("titre")}
            </Link>
          </li>
          <li>
            <Link href="/compte/commandes" className="t-small underline underline-offset-4">
              {t("compte.commandes")}
            </Link>
          </li>
          <li>
            <Link href="/compte/photos" className="t-small underline underline-offset-4">
              {t("compte.photos")}
            </Link>
          </li>
          <li>
            <Link href="/compte/realisation" className="t-small underline underline-offset-4">
              {t("compte.realisation")}
            </Link>
          </li>
          <li>
            <Link href="/compte/preferences" className="t-small underline underline-offset-4">
              {t("compte.preferences")}
            </Link>
          </li>
          {admin ? (
            <li>
              <Link href="/admin" className="t-small text-text-secondary underline underline-offset-4">
                {ta("libelle")}
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
      {children}
    </section>
  );
}
