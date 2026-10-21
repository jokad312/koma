import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BasculeTheme } from "./BasculeTheme";
import { MenuPanneau } from "./MenuPanneau";
import { RUBRIQUES, type Rubrique } from "./rubriques";
import { SelecteurLangue } from "./SelecteurLangue";

type Props = { nomSite: string; rubriques?: readonly Rubrique[] };

// En-tête collant en verre renforcé. Pas d'icône panier avant la story 4.1 ; pas de rubrique sans page.
// Le logo est affiché tel quel (fichier d'origine, jamais recoloré) ; le cadrage 530 x 124 est fait par recadrage CSS.
export async function EnTete({ nomSite, rubriques = RUBRIQUES }: Props) {
  const t = await getTranslations("Navigation");
  const liens =
    rubriques.length > 0 ? (
      <nav aria-label={t("principale")}>
        <ul className="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:gap-6">
          {rubriques.map((r) => (
            <li key={r.cle}>
              <Link href={r.href} className="t-h3 inline-flex min-h-touch items-center text-text-primary">
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
            <Image
              src="/logo/logo-principal.svg"
              alt={nomSite}
              width={630}
              height={220}
              unoptimized
              priority
              className="absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none"
            />
          </span>
        </Link>
        <div className="hidden lg:block">{liens}</div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <BasculeTheme />
            <SelecteurLangue />
          </div>
          <div className="lg:hidden">
            <MenuPanneau>
              {liens}
              <BasculeTheme />
              <SelecteurLangue />
            </MenuPanneau>
          </div>
        </div>
      </div>
    </header>
  );
}
