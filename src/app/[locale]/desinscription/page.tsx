import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { dependancesPreferences } from "@/modules/preferences/dependances";
import { desinscrireParLien } from "@/modules/preferences/service";

// Désinscription par le lien d'un Email commercial (story 9.4, FR-45) : effet immédiat, sans connexion. Le message affiché est
// le résultat réel de l'écriture en base (règle 13). Page jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/desinscription">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.desinscription" });
  return construireMetadata({ locale, chemin: "/desinscription", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Resultat({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/desinscription">["searchParams"] }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Desinscription" });
  const { c, s } = await searchParams;
  const resultat = await desinscrireParLien(dependancesPreferences(), { c, s });
  if (resultat === "erreur") return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  return (
    <div className="flex flex-col items-start gap-3">
      {resultat === "desinscrit" ? <MessageEtat type="succes">{t("fait")}</MessageEtat> : <MessageEtat type="attention">{t("invalide")}</MessageEtat>}
      <p className="t-body text-text-primary">{t("reactiver")}</p>
      <Link href="/compte/preferences" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
        {t("lienPreferences")}
      </Link>
    </div>
  );
}

export default async function PageDesinscription({ params, searchParams }: PageProps<"/[locale]/desinscription">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Desinscription");
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="t-h1">{t("titre")}</h1>
      <Suspense fallback={<Squelette />}>
        <Resultat locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
