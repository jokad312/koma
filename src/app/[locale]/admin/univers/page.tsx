import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CLASSES_PANNEAU, CLASSES_TITRE_PANNEAU } from "@/components/admin/ui/Panneau";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireUnivers } from "@/components/admin/FormulaireUnivers";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { PLUSIEURS_LANGUES, routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireUniversAdmin } from "@/modules/catalogue/queries";
import type { UniversAdmin } from "@/modules/catalogue/types";
import { nb } from "@/components/ui/Nombre";

const CHEMIN = "/admin/univers";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/univers">): Promise<Metadata> {
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
async function UniversSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "produits.modifier");
  const t = await getTranslations("Admin.univers");
  let univers: UniversAdmin[] | null = null;
  try {
    univers = await lireUniversAdmin();
  } catch {
    console.error("[catalogue] lecture des univers impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1 uppercase">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {/* Story 9.16 (étape 8) : liste et formulaire en panneaux, côte à côte à partir de 1280 px ; chaque univers en pastille « nom FR / nom EN ». */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="univers-existants" className={`flex flex-col gap-3 ${CLASSES_PANNEAU}`}>
            <h2 id="univers-existants" className={CLASSES_TITRE_PANNEAU}>
              {t("liste.titre")}
            </h2>
            {univers === null ? (
              <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
            ) : univers.length === 0 ? (
              <p role="status" className="t-body text-text-secondary">
                {t("liste.vide")}
              </p>
            ) : (
              <>
                <p role="status" className="t-label uppercase text-text-primary">
                  {t.rich("liste.nombre", { nombre: univers.length, nb })}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {univers.map((u) => (
                    <li key={u.id} className="t-body max-w-full rounded-full bg-admin-univers px-4 py-2 text-admin-sur-univers break-words">
                      {/* Site en français uniquement (2026-11-22) : le nom français seul ; les deux noms reviennent avec l'anglais. */}
                      {PLUSIEURS_LANGUES ? t("liste.noms", { fr: u.nomFr, en: u.nomEn }) : u.nomFr}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <FormulaireUnivers />
        </div>
      </div>
    </CoqueAdmin>
  );
}

export default async function Univers({ params }: PageProps<"/[locale]/admin/univers">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <UniversSelonDroit locale={locale} />
    </Suspense>
  );
}
