import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { destinationApresConnexion } from "@/lib/auth/arrivee-serveur";
import { cheminRetourValide } from "@/lib/auth/retour";
import { lireEtatCompte } from "@/lib/auth/compte";
import { detecterNavigateurIntegre } from "@/lib/navigateur-integre";
import { lireNomSite } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { construireMetadata } from "@/lib/seo/metadata";
import { urlLocalisee } from "@/lib/seo/url";
import { lireUniversPublics } from "@/modules/catalogue/queries";
import type { UniversChoix } from "@/modules/catalogue/types";
import { lirePhotosConnexion } from "@/lib/vitrine/photos-connexion";
import { DiaporamaConnexion } from "./DiaporamaConnexion";
import { EnTeteConnexion } from "./EnTeteConnexion";
import { FormulaireConnexion } from "./FormulaireConnexion";
import "./connexion.css";

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
async function FormulaireSelonSession({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/connexion">["searchParams"] }) {
  const etat = await lireEtatCompte();
  const { retour, erreur, expiree } = await searchParams;
  if (etat === "complet") {
    // Déjà connecté : retour précis, sinon arrivée par défaut selon le rôle (story 9.12).
    redirect(await destinationApresConnexion(cheminRetourValide(Array.isArray(retour) ? retour[0] : retour, locale), locale));
  }
  const t = await getTranslations("Connexion");
  // Message d'expiration seulement pour une personne qui n'est plus connectée (jamais à un Compte ouvert, même incomplet).
  const sessionExpiree = etat === "anonyme" && (Array.isArray(expiree) ? expiree[0] : expiree) === "1";
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
    <>
      {sessionExpiree ? (
        <p role="status" className="t-body rounded-md border border-border bg-surface px-4 py-3">
          {t("sessionExpiree")}
        </p>
      ) : null}
      <FormulaireConnexion
        etapeInitiale={etat === "incomplet" ? "age" : etat === "questions" ? "questions" : "email"}
        google={integre ? "indisponible" : "disponible"}
        erreurGoogle={(Array.isArray(erreur) ? erreur[0] : erreur) === "google"}
        univers={univers}
      />
    </>
  );
}

export default async function Connexion({ params, searchParams }: PageProps<"/[locale]/connexion">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Connexion");
  const photos = await lirePhotosConnexion();
  const tm = await getTranslations("Metadata.connexion");
  const nomSite = await lireNomSite();

  return (
    // Story 9.17 (maquette connexion.mp4, proportions de connexion-reference.png) : en-tête réduit propre à la page (logo, thème, langue, trait),
    // panneau d'images à gauche (46,3 % de la largeur, coins arrondis, fondu toutes les 3 s ; image fixe si « réduire les animations » ; masqué sous
    // 768 px, Q32) et carte CONNEXION à droite (38,6 %), centrée verticalement sur le panneau. Mesures et marges : connexion.css. Aucun pied de page :
    // l'en-tête et le pied du site sont masqués sur cette seule page ([data-page-connexion], globals.css). Sans image dans public/images/connexion/ :
    // le mot géant « COSPLAY » (décoratif).
    <div data-page-connexion="" className="cx-page flex flex-col">
      <EnTeteConnexion nomSite={nomSite} />
      <section className="cx-rangee">
        <div data-carte-connexion="" className="cx-carte flex w-full flex-col items-start gap-6 rounded-[12px] border border-border bg-surface p-6">
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
          <h1 className="t-h1 uppercase">{t("titre")}</h1>
          {/* useSearchParams (chemin de retour) demande une frontière Suspense. */}
          <Suspense fallback={<Squelette />}>
            <FormulaireSelonSession locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
        {/* Panneau APRÈS la carte dans le DOM (Tab atteint le champ email avant le bouton Pause), à gauche à l'écran (order: -1, connexion.css). */}
        <div
          aria-hidden={photos.length > 0 ? undefined : true}
          data-panneau-connexion=""
          className="cx-panneau relative hidden overflow-hidden border border-border bg-surface md:block"
        >
          {photos.length > 0 ? (
            <DiaporamaConnexion images={photos} />
          ) : (
            <p data-mot-connexion="" className="absolute inset-x-0 top-1/2 m-0 -translate-y-1/2 text-center cx-mot">
              {t("panneau.mot")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
