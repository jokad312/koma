import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { versConnexion } from "@/components/commande/PageCommande";
import { InterrupteursPreferences } from "@/components/compte/InterrupteursPreferences";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { dependancesPreferences } from "@/modules/preferences/dependances";
import { lirePreferences } from "@/modules/preferences/service";

// Page privée du client, rendue à la demande : jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/preferences">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.comptePreferences" });
  return construireMetadata({ locale, chemin: "/compte/preferences", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale }: { locale: Locale }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Preferences" });
  const lu = await lirePreferences(dependancesPreferences());
  if (!lu.ok && lu.erreur === "non_connecte") versConnexion(locale, `/${locale}/compte/preferences`);
  if (!lu.ok) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  return (
    <>
      {lu.preferences.mineurBloque ? <MessageEtat type="information">{t("mineur")}</MessageEtat> : null}
      <InterrupteursPreferences initiales={lu.preferences} />
    </>
  );
}

export default async function PagePreferences({ params }: PageProps<"/[locale]/compte/preferences">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Preferences");
  return (
    <section className="flex flex-col gap-4">
      <h2 className="t-h2">{t("titre")}</h2>
      <p className="t-body text-text-secondary">{t("intro")}</p>
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} />
      </Suspense>
    </section>
  );
}
