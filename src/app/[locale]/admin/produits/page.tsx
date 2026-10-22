import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { ListeProduits } from "@/components/admin/ListeProduits";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireProduitsAdmin } from "@/modules/catalogue/queries";
import type { ProduitListe } from "@/modules/catalogue/types";

const CHEMIN = "/admin/produits";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/produits">): Promise<Metadata> {
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

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le client service.
async function ProduitsSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "produits.modifier");
  const t = await getTranslations("Admin.produits");
  let produits: ProduitListe[] | null = null;
  try {
    produits = await lireProduitsAdmin();
  } catch {
    console.error("[catalogue] lecture des produits impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {produits && produits.length > 0 ? (
          <div>
            <Bouton href="/admin/produits/nouveau">{t("nouveau")}</Bouton>
          </div>
        ) : null}
        {produits ? <ListeProduits produits={produits} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function Produits({ params }: PageProps<"/[locale]/admin/produits">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ProduitsSelonDroit locale={locale} />
    </Suspense>
  );
}
