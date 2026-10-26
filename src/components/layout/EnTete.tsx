import Image from "next/image";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { BasculeTheme } from "./BasculeTheme";
import { LangueRepli } from "./LangueRepli";
import { MenuPanneau } from "./MenuPanneau";
import { RUBRIQUES, type Rubrique } from "./rubriques";
import { LienConnexion } from "./LienConnexion";
import { SelecteurLangue } from "./SelecteurLangue";
import { ZoneCompte } from "./ZoneCompte";

type Props = { nomSite: string; rubriques?: readonly Rubrique[] };

// En-tête collant en verre renforcé. Pas d'icône panier avant la story 4.1 ; pas de rubrique sans page.
// Le logo est affiché tel quel (fichier d'origine, jamais recoloré) ; le cadrage 530 x 124 est fait par recadrage CSS.
export async function EnTete({ nomSite, rubriques = RUBRIQUES }: Props) {
  const t = await getTranslations("Navigation");
  const locale = (await getLocale()) as Locale;
  const liens =
    rubriques.length > 0 ? (
      <nav aria-label={t("principale")}>
        <ul className="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:gap-6">
          {rubriques.map((r) => (
            <li key={r.cle}>
              <Link href={cheminPublic(locale, r.href)} className="t-h3 inline-flex min-h-touch items-center text-text-primary">
                {t(`rubriques.${r.cle}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    ) : null;

  return (
    <header className="entete-collant verre-fort sticky top-0 z-30 h-entete rounded-none border-x-0 border-t-0">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-3 px-marge">
        <Link href="/" className="inline-flex min-h-touch items-center">
          <span className="relative block aspect-[530/124] w-[156px] overflow-hidden lg:w-[190px]">
            {/* Deux fichiers d'origine, jamais recolorés : un seul est affiché (display) selon [data-theme], donc un seul est exposé aux technologies d'assistance. */}
            <Image
              src="/logo/logo-principal.svg"
              alt={nomSite}
              width={630}
              height={220}
              unoptimized
              priority
              data-logo="clair"
              className="logo-clair absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none"
            />
            <Image
              src="/logo/logo-principal-inverse.svg"
              alt={nomSite}
              width={630}
              height={220}
              unoptimized
              priority
              data-logo="sombre"
              className="logo-sombre absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none"
            />
          </span>
        </Link>
        <div className="hidden lg:block">{liens}</div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <BasculeTheme />
            <Suspense fallback={<LangueRepli />}>
              <SelecteurLangue />
            </Suspense>
            <Suspense fallback={<LienConnexion />}>
              <ZoneCompte />
            </Suspense>
          </div>
          <div className="lg:hidden">
            <MenuPanneau>
              {liens}
              <BasculeTheme />
              <Suspense fallback={<LangueRepli />}>
                <SelecteurLangue />
              </Suspense>
              <Suspense fallback={<LienConnexion />}>
                <ZoneCompte />
              </Suspense>
            </MenuPanneau>
          </div>
        </div>
      </div>
    </header>
  );
}
