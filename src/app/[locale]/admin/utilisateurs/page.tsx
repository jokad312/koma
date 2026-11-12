import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { GrilleUtilisateurs } from "@/components/admin/GrilleUtilisateurs";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireUtilisateursAdmin, type UtilisateurAdmin } from "@/modules/admin/utilisateurs";

const CHEMIN = "/admin/utilisateurs";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/utilisateurs">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Page « Utilisateurs » (story 9.10) : réservée à l'Admin (droit « roles.gerer », vérifié sur la page puis par la fonction SQL), lecture seule.
async function UtilisateursSelonDroit({ locale }: { locale: Locale }) {
  const { auteur } = await exigerAdminPage(locale, CHEMIN, "roles.gerer");
  const t = await getTranslations("Admin.utilisateurs");
  let utilisateurs: UtilisateurAdmin[] | null = null;
  try {
    utilisateurs = await lireUtilisateursAdmin(auteur);
  } catch {
    console.error("[admin] lecture des utilisateurs impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {utilisateurs ? <GrilleUtilisateurs utilisateurs={utilisateurs} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function Utilisateurs({ params }: PageProps<"/[locale]/admin/utilisateurs">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <UtilisateursSelonDroit locale={locale} />
    </Suspense>
  );
}
