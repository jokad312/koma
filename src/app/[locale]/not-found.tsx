import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "Metadata.nonTrouve" });
  return construireMetadata({
    locale,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

export default async function NonTrouve() {
  const locale = await getLocale();
  const t = await getTranslations("NonTrouve");

  return (
    <main>
      <h1>{t("titre")}</h1>
      <p>{t("texte")}</p>
      <Link href={`/${locale}`}>{t("lienAccueil")}</Link>
    </main>
  );
}
