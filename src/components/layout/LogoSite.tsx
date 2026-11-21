import Image from "next/image";
import { Link } from "@/i18n/navigation";

// Logo de l'en-tête, lien vers l'accueil (extrait de EnTete pour l'en-tête réduit de la connexion, story 9.17). Affiché tel quel (fichier d'origine,
// jamais recoloré) ; le cadrage 530 x 124 est fait par recadrage CSS.
export function LogoSite({ nomSite }: { nomSite: string }) {
  return (
    <Link href="/" className="inline-flex min-h-touch items-center">
      <span className="relative block aspect-[530/124] w-[156px] overflow-hidden max-[359px]:w-[132px] lg:w-[190px]">
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
  );
}
