import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireEvenement } from "@/components/admin/FormulaireEvenement";
import { Squelette } from "@/components/ui/Squelette";
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

const ID_FORMULAIRE = "formulaire-evenement";

async function NouvelEvenementSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "evenements.gerer");
  const t = await getTranslations("Admin.evenements");
  return (
    <CoqueAdmin>
      {/* Story 9.16 (étape 8, Q23) : la création reste sur sa route, dessinée en fenêtre ; Échap et la croix ramènent à la liste. */}
      <FenetreFormulaire titre={t("pageNouveau.titre")} retour="/admin/evenements" idFormulaire={ID_FORMULAIRE}>
        <FormulaireEvenement evenement={null} idFormulaire={ID_FORMULAIRE} />
      </FenetreFormulaire>
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
