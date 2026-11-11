import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EcranScan } from "@/components/scan/EcranScan";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireEvenementsScannables } from "@/modules/scan/queries";
import type { EvenementScannable } from "@/modules/scan/types";

const CHEMIN = "/scan";

export async function generateMetadata({ params }: PageProps<"/[locale]/scan">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.scan" });
  // Page de contrôle à l'entrée : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Droit vérifié sur la page elle-même (visiteur : connexion avec retour ; sans le droit : 404), puis lecture des Événements par le client service.
async function ScanSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "pass.scanner");
  const t = await getTranslations("Scan");
  let evenements: EvenementScannable[] | null = null;
  try {
    evenements = await lireEvenementsScannables(locale === "en" ? "en" : "fr");
  } catch {
    console.error("[scan] lecture des événements impossible");
  }
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="t-h1">{t("titre")}</h1>
      {evenements ? <EcranScan evenements={evenements} /> : <MessageEtat type="erreur">{t("evenement.erreurLecture")}</MessageEtat>}
      <Link href="/admin" className="t-small text-text-secondary underline">
        {t("retourAdmin")}
      </Link>
    </div>
  );
}

export default async function Scan({ params }: PageProps<"/[locale]/scan">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ScanSelonDroit locale={locale} />
    </Suspense>
  );
}
