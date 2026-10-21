import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { EnTete } from "@/components/layout/EnTete";
import { ID_CONTENU, ID_RACINE_PAGE } from "@/components/layout/constantes";
import { LienEvitement } from "@/components/layout/LienEvitement";
import { PiedDePage } from "@/components/layout/PiedDePage";
import { routing } from "@/i18n/routing";
import { lireEnvPublique } from "@/lib/env";
import { barlow, barlowCondensed } from "@/lib/fonts";
import { lireNomSite } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { organisationJsonLd } from "@/lib/seo/jsonld";
import { SCRIPT_THEME } from "@/lib/theme/script";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Sakura Town n'est chargée que si l'option est active (Q-F1) : le fichier est déposé par Jonathan dans public/fonts/, jamais commité.
const FONT_FACE_SAKURA = '@font-face{font-family:"Sakura Town";src:url("/fonts/sakura-town.otf") format("opentype");font-display:swap}';

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const nomSite = await lireNomSite();
  const sakura = lireEnvPublique().NEXT_PUBLIC_TITRES_SAKURA;

  return (
    <html lang={locale} className={`${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <head>
        {/* Pose le thème avant le premier rendu : pas de flash. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
        {sakura ? <style dangerouslySetInnerHTML={{ __html: FONT_FACE_SAKURA }} /> : null}
      </head>
      <body>
        <NextIntlClientProvider>
          <div id={ID_RACINE_PAGE} className="flex min-h-dvh flex-1 flex-col">
            <LienEvitement />
            <EnTete nomSite={nomSite} />
            <main id={ID_CONTENU} tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-marge py-8">
              <JsonLd donnees={organisationJsonLd(nomSite)} />
              {children}
            </main>
            <PiedDePage nomSite={nomSite} />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
