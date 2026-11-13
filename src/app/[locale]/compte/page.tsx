import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BlocsAccueil } from "@/components/accueil/BlocsAccueil";
import { versConnexion } from "@/components/commande/PageCommande";
import {
  AccesRapidesEspace,
  BlocCommandesEspace,
  BlocEvenementsEspace,
  BlocKitsEspace,
  BlocPassEspace,
} from "@/components/compte/espace/BlocsEspace";
import { EnTeteEspace } from "@/components/compte/espace/EnTeteEspace";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { lireEtatCompte } from "@/lib/auth/compte";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireIdentiteEspace } from "@/modules/espace/identite";

// Espace personnel (story 9.12) : page privée, rendue à la demande à chaque requête, jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.espace" });
  return construireMetadata({ locale, chemin: "/compte", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

type Requete = PageProps<"/[locale]/compte">["searchParams"];

// Session vérifiée ici (visiteur ou Compte incomplet : connexion, puis retour ici). Chaque bloc lit les données du seul Compte de la session.
async function Espace({ locale, searchParams }: { locale: Locale; searchParams: Requete }) {
  const retour = `/${locale}/compte`;
  const etat = await lireEtatCompte();
  if (etat === "anonyme" || etat === "incomplet") versConnexion(locale, retour);
  const identite = await lireIdentiteEspace();
  if (!identite) versConnexion(locale, retour);
  const t = await getTranslations({ locale, namespace: "Espace" });
  const { compteId, pseudo } = identite;
  return (
    <div className="flex flex-col gap-10">
      <EnTeteEspace pseudo={pseudo} locale={locale} />
      <Suspense fallback={<Squelette />}>
        <BlocCommandesEspace compteId={compteId} locale={locale} />
      </Suspense>
      <Suspense fallback={<Squelette />}>
        <BlocKitsEspace compteId={compteId} locale={locale} />
      </Suspense>
      <Suspense fallback={<Squelette />}>
        <BlocPassEspace compteId={compteId} locale={locale} />
      </Suspense>
      <Suspense fallback={<Squelette />}>
        <BlocEvenementsEspace compteId={compteId} locale={locale} />
      </Suspense>
      <Suspense fallback={<Squelette />}>
        <AccesRapidesEspace compteId={compteId} locale={locale} />
      </Suspense>
      {/* g. « Découvrir la boutique » : les blocs de l'accueil, sans le grand héros. */}
      <section aria-labelledby="espace-boutique" className="flex flex-col gap-6 border-t border-border pt-10">
        <h2 id="espace-boutique" className="t-h2">
          {t("boutique")}
        </h2>
        <BlocsAccueil locale={locale} searchParams={searchParams} variante="boutique" />
      </section>
    </div>
  );
}

export default async function EspacePersonnel({ params, searchParams }: PageProps<"/[locale]/compte">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <Espace locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}
