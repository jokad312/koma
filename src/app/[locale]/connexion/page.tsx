import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { cheminRetourValide } from "@/lib/auth/retour";
import { lireEtatCompte } from "@/lib/auth/compte";
import { detecterNavigateurIntegre } from "@/lib/navigateur-integre";
import { lireNomSite } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { construireMetadata } from "@/lib/seo/metadata";
import { urlLocalisee } from "@/lib/seo/url";
import { lireUniversPublics } from "@/modules/catalogue/queries";
import type { UniversChoix } from "@/modules/catalogue/types";
import { FormulaireConnexion } from "./FormulaireConnexion";

const CHEMIN = "/connexion";

export async function generateMetadata({ params }: PageProps<"/[locale]/connexion">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.connexion" });
  // Page de service : jamais indexée.
  return construireMetadata({
    locale,
    chemin: CHEMIN,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Lit la session (donnée de requête) : sous Suspense, le reste de la page reste statique.
async function FormulaireSelonSession({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/[locale]/connexion">["searchParams"];
}) {
  const etat = await lireEtatCompte();
  const { retour, erreur } = await searchParams;
  if (etat === "complet") {
    redirect(cheminRetourValide(Array.isArray(retour) ? retour[0] : retour, locale));
  }
  const integre = detecterNavigateurIntegre((await headers()).get("user-agent")).integre;
  // Univers de la question d'accueil, dans la langue de la route. Lecture impossible : la question est omise (elle est facultative),
  // le reste de l'étape est inchangé.
  let univers: UniversChoix[] = [];
  try {
    univers = await lireUniversPublics(locale);
  } catch {
    console.error("[connexion] lecture des univers impossible : question omise");
  }
  return (
    <FormulaireConnexion
      etapeInitiale={etat === "incomplet" ? "age" : etat === "questions" ? "questions" : "email"}
      google={integre ? "indisponible" : "disponible"}
      erreurGoogle={(Array.isArray(erreur) ? erreur[0] : erreur) === "google"}
      univers={univers}
    />
  );
}

export default async function Connexion({ params, searchParams }: PageProps<"/[locale]/connexion">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Connexion");
  const tm = await getTranslations("Metadata.connexion");

  return (
    <section className="flex flex-col items-start gap-6">
      <JsonLd
        donnees={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: tm("titre"),
          description: tm("description"),
          url: urlLocalisee(locale, CHEMIN),
          inLanguage: locale,
        }}
      />
      <h1 className="t-h1">{t("titre")}</h1>
      {/* useSearchParams (chemin de retour) demande une frontière Suspense. */}
      <Suspense fallback={<Squelette />}>
        <FormulaireSelonSession locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
