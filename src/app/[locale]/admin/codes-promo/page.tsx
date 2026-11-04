import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireCodePromo } from "@/components/admin/FormulaireCodePromo";
import { ListeCodesPromo } from "@/components/admin/ListeCodesPromo";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireCodesPromoAdmin } from "@/modules/promo/queries";

const CHEMIN = "/admin/codes-promo";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/codes-promo">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le client service.
async function CodesPromoSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "codes_promo.gerer");
  const t = await getTranslations("Admin.codesPromo");
  let codes = null;
  try {
    codes = await lireCodesPromoAdmin();
  } catch {
    console.error("[promo] lecture des codes promo impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        <FormulaireCodePromo />
        {codes ? <ListeCodesPromo codes={codes} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function CodesPromo({ params }: PageProps<"/[locale]/admin/codes-promo">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <CodesPromoSelonDroit locale={locale} />
    </Suspense>
  );
}
