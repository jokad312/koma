import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { ListeEvenements } from "@/components/admin/ListeEvenements";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireEvenementsAdmin } from "@/modules/evenements/queries";
import type { EvenementListe } from "@/modules/evenements/types";

const CHEMIN = "/admin/evenements";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/evenements">): Promise<Metadata> {
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
async function EvenementsSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "evenements.gerer");
  const t = await getTranslations("Admin.evenements");
  let evenements: EvenementListe[] | null = null;
  try {
    evenements = await lireEvenementsAdmin();
  } catch {
    console.error("[evenements] lecture des événements impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {evenements && evenements.length > 0 ? (
          <div>
            <Bouton href="/admin/evenements/nouveau">{t("nouveau")}</Bouton>
          </div>
        ) : null}
        {evenements ? <ListeEvenements evenements={evenements} locale={locale === "en" ? "en" : "fr"} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function Evenements({ params }: PageProps<"/[locale]/admin/evenements">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <EvenementsSelonDroit locale={locale} />
    </Suspense>
  );
}
