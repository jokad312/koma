import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Bouton } from "@/components/ui/Bouton";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
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
  const t = await getTranslations("NonTrouve");

  return (
    <section className="flex flex-col items-start gap-4">
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      <p>{t("texte")}</p>
      <Bouton href="/">{t("lienAccueil")}</Bouton>
    </section>
  );
}
