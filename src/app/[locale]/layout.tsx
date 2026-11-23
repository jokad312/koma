import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BandeauNavigateurIntegre } from "@/components/layout/BandeauNavigateurIntegre";
import { EnvoiMesure } from "@/components/mesure/EnvoiMesure";
import { BandeauSessionExpiree } from "@/components/layout/BandeauSessionExpiree";
import { EnTete } from "@/components/layout/EnTete";
import { ID_CONTENU, ID_RACINE_PAGE } from "@/components/layout/constantes";
import { LienEvitement } from "@/components/layout/LienEvitement";
import { ScriptTheme } from "@/components/layout/ScriptTheme";
import { PiedDePage } from "@/components/layout/PiedDePage";
import { LANGUES_ACTIVES, PLUSIEURS_LANGUES, routing } from "@/i18n/routing";
import { komaChikara } from "@/lib/fonts";
import { lireNomSite, lireNumeroWhatsappOuNull } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { organisationJsonLd } from "@/lib/seo/jsonld";
import { lireSlugsSansVersionAnglaise } from "@/modules/blog/queries";
import "../globals.css";

// Langues actives seulement (site en français uniquement depuis le 2026-11-22) : /en est redirigé par le proxy, jamais servi.
export function generateStaticParams() {
  return LANGUES_ACTIVES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const nomSite = await lireNomSite();
  const numeroWhatsapp = await lireNumeroWhatsappOuNull();
  // Articles français sans version anglaise : le sélecteur de langue mène alors à /en/blog. Une lecture impossible ne casse pas
  // la page : le sélecteur garde son comportement habituel (la page Article rendra de toute façon une 404 sous /en).
  // Une seule langue active : aucun sélecteur, la liste n'est pas lue.
  let sansTraduction: string[] = [];
  if (PLUSIEURS_LANGUES) {
    try {
      sansTraduction = await lireSlugsSansVersionAnglaise();
    } catch {
      console.error("[blog] liste des articles sans version anglaise impossible : sélecteur de langue inchangé");
    }
  }
  return (
    <html lang={locale} className={komaChikara.variable} suppressHydrationWarning>
      <head>
        {/* Pose le thème avant le premier rendu : pas de flash. */}
        <ScriptTheme />
      </head>
      <body>
        {/* Mesure d'audience maison (9.7) : aucun script tiers, aucune requête sur les pages exclues. */}
        <EnvoiMesure />
        <NextIntlClientProvider>
          <div id={ID_RACINE_PAGE} className="flex min-h-dvh flex-1 flex-col">
            <LienEvitement />
            <Suspense fallback={null}>
              <BandeauNavigateurIntegre />
            </Suspense>
            <BandeauSessionExpiree />
            <EnTete nomSite={nomSite} sansTraduction={sansTraduction} />
            <main id={ID_CONTENU} tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-marge py-8">
              <JsonLd donnees={organisationJsonLd(nomSite)} />
              {children}
            </main>
            <PiedDePage nomSite={nomSite} numeroWhatsapp={numeroWhatsapp} />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
