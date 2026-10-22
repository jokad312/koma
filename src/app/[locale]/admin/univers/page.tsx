import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireUnivers } from "@/components/admin/FormulaireUnivers";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireUniversAdmin } from "@/modules/catalogue/queries";
import type { UniversAdmin } from "@/modules/catalogue/types";

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
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        <section aria-labelledby="univers-existants" className="flex flex-col gap-3">
          <h2 id="univers-existants" className="t-h2">
            {t("liste.titre")}
          </h2>
          {univers === null ? (
            <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
          ) : univers.length === 0 ? (
            <p role="status" className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">
              {t("liste.vide")}
            </p>
          ) : (
            <>
              <p role="status" className="t-small text-text-secondary">
                {t("liste.nombre", { nombre: univers.length })}
              </p>
              <ul className="flex flex-col gap-ecart-cartes">
                {univers.map((u) => (
                  <li key={u.id} className="t-body rounded-lg border border-border bg-surface p-4 break-words">
                    {t("liste.noms", { fr: u.nomFr, en: u.nomEn })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <FormulaireUnivers />
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
