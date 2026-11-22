import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Panneau } from "@/components/admin/ui/Panneau";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { TachesArgent } from "@/components/admin/TachesArgent";
import { TacheMesuresARecevoir } from "@/components/admin/TacheMesuresARecevoir";
import { TachePhotos } from "@/components/admin/TachePhotos";
import { ListeTaches } from "@/components/admin/ListeTaches";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireTachesAdmin } from "@/modules/admin/queries";
import type { TacheAdmin } from "@/modules/admin/types";
import { nb } from "@/components/ui/Nombre";

const CHEMIN = "/admin/taches";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/taches">): Promise<Metadata> {
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
async function TachesSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "admin.acceder");
  const t = await getTranslations("Admin.taches");
  let taches: TacheAdmin[] | null = null;
  try {
    taches = await lireTachesAdmin();
  } catch {
    console.error("[admin] lecture des tâches impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1 uppercase">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {/* Story 9.16 (étape 8) : les trois suivis en panneaux côte à côte à partir de 1280 px, puis la liste des tâches ouvertes dans un panneau. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <TacheMesuresARecevoir />
          <TachePhotos />
          <TachesArgent />
        </div>
        {taches ? (
          <Panneau titre={t.rich("ouvertes", { nombre: taches.length, nb })}>
            <ListeTaches taches={taches} />
          </Panneau>
        ) : (
          <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
        )}
      </div>
    </CoqueAdmin>
  );
}

export default async function Taches({ params }: PageProps<"/[locale]/admin/taches">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <TachesSelonDroit locale={locale} />
    </Suspense>
  );
}
