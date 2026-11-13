import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { BasculeTheme } from "./BasculeTheme";
import { BoutonDeconnexion } from "./BoutonDeconnexion";
import { LangueRepli } from "./LangueRepli";
import { LienConnexion } from "./LienConnexion";
import { MenuCompteRond } from "./MenuCompteRond";
import { SelecteurLangue } from "./SelecteurLangue";

// Contenu du bouton rond « compte » (en-tête de l'accueil visiteur, story 9.12) : lit la session, donc à rendre sous <Suspense>.
// Visiteur : « Se connecter » ; connecté : « Mon espace » et « Se déconnecter ». Puis le thème sombre et l'autre langue.
export async function ZoneCompteRonde({ sansTraduction }: { sansTraduction?: readonly string[] }) {
  let connecte = false;
  try {
    connecte = (await lireSessionVerifiee()) !== null;
  } catch {
    // Supabase indisponible : comme pour un visiteur.
  }
  const t = await getTranslations("Navigation.menuCompte");
  return (
    <MenuCompteRond connecte={connecte}>
      {connecte ? (
        <>
          <Link href="/compte" className="t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary no-underline">
            {t("monEspace")}
          </Link>
          <BoutonDeconnexion />
        </>
      ) : (
        <LienConnexion />
      )}
      <BasculeTheme />
      <Suspense fallback={<LangueRepli />}>
        <SelecteurLangue sansTraduction={sansTraduction} />
      </Suspense>
    </MenuCompteRond>
  );
}

// Repli pendant la lecture de la session : le bouton d'un visiteur.
export function ZoneCompteRondeRepli() {
  return (
    <MenuCompteRond connecte={false}>
      <LienConnexion />
      <BasculeTheme />
    </MenuCompteRond>
  );
}
