import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireReglage } from "@/components/admin/FormulaireReglage";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireReglagesAdmin } from "@/modules/admin/queries";

const CHEMIN = "/admin/reglages";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/reglages">): Promise<Metadata> {
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

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture des valeurs par le client service.
async function ReglagesSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "reglages.modifier");
  const reglages = await lireReglagesAdmin();
  const t = await getTranslations("Admin.reglages");
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        <FormulaireReglage cle="nom_site" valeur={reglages.nomSite} />
        <FormulaireReglage cle="numero_whatsapp" valeur={reglages.numeroWhatsapp} />
      </div>
    </CoqueAdmin>
  );
}

export default async function Reglages({ params }: PageProps<"/[locale]/admin/reglages">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ReglagesSelonDroit locale={locale} />
    </Suspense>
  );
}
