import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireUniversAdmin } from "@/modules/catalogue/queries";
import type { UniversAdmin } from "@/modules/catalogue/types";

const CHEMIN = "/admin/produits/nouveau";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/produits/nouveau">): Promise<Metadata> {
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

// Droit vérifié sur la page elle-même, puis lecture des univers par le client service.
async function NouveauSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "produits.modifier");
  const t = await getTranslations("Admin.produits");
  let univers: UniversAdmin[] | null = null;
  try {
    univers = await lireUniversAdmin();
  } catch {
    console.error("[catalogue] lecture des univers impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("pageNouveau.titre")}</h1>
        <p className="t-body text-text-secondary">{t("pageNouveau.intro")}</p>
        {/* Sans lecture des univers, le formulaire n'est pas montré : il prétendrait qu'aucun univers n'existe. */}
        {univers ? <FormulaireProduit univers={univers} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function NouveauProduit({ params }: PageProps<"/[locale]/admin/produits/nouveau">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <NouveauSelonDroit locale={locale} />
    </Suspense>
  );
}
