import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireEvenement } from "@/components/admin/FormulaireEvenement";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/admin/evenements/nouveau";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/evenements/nouveau">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: CHEMIN,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

async function NouvelEvenementSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "evenements.gerer");
  const t = await getTranslations("Admin.evenements");
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("pageNouveau.titre")}</h1>
        <p>
          <Link href="/admin/evenements" className="t-label inline-flex min-h-touch items-center underline">
            {t("pageNouveau.retour")}
          </Link>
        </p>
        <FormulaireEvenement evenement={null} />
      </div>
    </CoqueAdmin>
  );
}

export default async function NouvelEvenement({ params }: PageProps<"/[locale]/admin/evenements/nouveau">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <NouvelEvenementSelonDroit locale={locale} />
    </Suspense>
  );
}
