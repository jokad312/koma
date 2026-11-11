import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { versConnexion } from "@/components/commande/PageCommande";
import { CharteGalerie } from "@/components/communaute/CharteGalerie";
import { EnvoiPhotoClient } from "@/components/compte/EnvoiPhotoClient";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { dependancesCommunaute } from "@/modules/communaute/dependances";
import { lireKitsPayes } from "@/modules/communaute/service";

// « Mon compte › Envoyer une Réalisation » (story 8.4, FR-42) : photo d'un costume fabriqué avec un Kit payé. Page privée, jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/realisation">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.compteRealisation" });
  return construireMetadata({ locale, chemin: "/compte/realisation", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale }: { locale: Locale }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Communaute.realisation" });
  const lu = await lireKitsPayes(dependancesCommunaute());
  if (!lu.ok && lu.erreur === "non_connecte") versConnexion(locale, `/${locale}/compte/realisation`);
  if (!lu.ok) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  if (lu.mineur) return <MessageEtat type="information">{t("mineur")}</MessageEtat>;
  if (lu.kits.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="t-body text-text-primary">{t("aucunKit")}</p>
        <Link href="/kits" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
          {t("voirKits")}
        </Link>
      </div>
    );
  }
  return (
    <>
      <CharteGalerie locale={locale} />
      <EnvoiPhotoClient kits={lu.kits} />
      <Link href="/compte/photos" className="t-small inline-flex min-h-touch items-center text-text-primary underline">
        {t("suivre")}
      </Link>
    </>
  );
}

export default async function PageRealisation({ params }: PageProps<"/[locale]/compte/realisation">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Communaute.realisation");
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
