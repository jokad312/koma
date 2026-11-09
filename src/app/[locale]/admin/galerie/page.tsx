import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { DepotPhotoWhatsapp } from "@/components/admin/DepotPhotoWhatsapp";
import { FilePhotos } from "@/components/admin/FilePhotos";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { dependancesGalerie } from "@/modules/communaute/admin-dependances";
import { lirePhotosAdmin } from "@/modules/communaute/admin-service";

const CHEMIN = "/admin/galerie";

// Bornes de la date d'accord WhatsApp, en UTC comme celles de la base : ni dans le futur, ni il y a plus d'un an.
function bornesAccord(maintenant: Date): { aujourdhui: string; ilYaUnAn: string } {
  return {
    aujourdhui: maintenant.toISOString().slice(0, 10),
    ilYaUnAn: new Date(maintenant.getTime() - 365 * 86_400_000).toISOString().slice(0, 10),
  };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/galerie">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Droit galerie.valider (Admin et Assistant) vérifié sur la page elle-même, puis par chaque action et chaque fonction SQL.
async function GalerieSelonDroit({ locale }: { locale: Locale }) {
  await connection();
  await exigerAdminPage(locale, CHEMIN, "galerie.valider");
  const t = await getTranslations("Admin.galerie");
  const lu = await lirePhotosAdmin(dependancesGalerie());
  const { aujourdhui, ilYaUnAn } = bornesAccord(new Date());
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {lu.ok ? <FilePhotos photos={lu.photos} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
        <DepotPhotoWhatsapp aujourdhui={aujourdhui} ilYaUnAn={ilYaUnAn} />
      </div>
    </CoqueAdmin>
  );
}

export default async function Galerie({ params }: PageProps<"/[locale]/admin/galerie">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <GalerieSelonDroit locale={locale} />
    </Suspense>
  );
}
