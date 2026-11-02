import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { ListePrestataires, type PrestataireAdmin } from "@/components/admin/ListePrestataires";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { adaptateurBranche } from "@/modules/paiement/registre";
import { lirePrestataires } from "@/modules/paiement/queries";

const CHEMIN = "/admin/prestataires";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/prestataires">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le client service.
async function PrestatairesSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "prestataires.gerer");
  const t = await getTranslations("Admin.prestataires");
  let prestataires: PrestataireAdmin[] | null = null;
  try {
    prestataires = (await lirePrestataires()).map((p) => ({ ...p, adaptateurBranche: adaptateurBranche(p.code) }));
  } catch {
    console.error("[paiement] lecture des Prestataires impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {prestataires ? <ListePrestataires prestataires={prestataires} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function Prestataires({ params }: PageProps<"/[locale]/admin/prestataires">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <PrestatairesSelonDroit locale={locale} />
    </Suspense>
  );
}
