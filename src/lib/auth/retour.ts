import { routing, type Locale } from "@/i18n/routing";

const DEBUT_LOCALISE = /^\/(?:fr|en)(?:[/?#]|$)/;
const CARACTERES_DE_CONTROLE = /[\u0000-\u001f\u007f]/;
const PAGE_CONNEXION = /^\/(?:fr|en)\/connexion(?:[/?#]|$)/i;

function decoder(valeur: string): string | null {
  try {
    return decodeURIComponent(valeur);
  } catch {
    return null;
  }
}

// Chemin de retour après la connexion, validé côté serveur : chemin interne commençant par /fr ou /en,
// jamais une adresse externe, ni « // », ni « \ », ni la page de connexion elle-même.
// Tout le reste mène à l'accueil de la langue.
export function cheminRetourValide(retour: unknown, locale: Locale): string {
  const accueil = `/${locale}`;
  if (typeof retour !== "string" || retour.length === 0 || retour.length > 512) return accueil;
  if (!DEBUT_LOCALISE.test(retour)) return accueil;
  if (CARACTERES_DE_CONTROLE.test(retour) || retour.includes("\\") || retour.includes("//")) return accueil;

  // Une forme encodée ne doit pas cacher un « \ », un « // » ou un caractère de contrôle.
  const decode = decoder(retour);
  if (decode === null) return accueil;
  if (CARACTERES_DE_CONTROLE.test(decode) || decode.includes("\\") || decode.includes("//")) return accueil;

  if (PAGE_CONNEXION.test(retour) || PAGE_CONNEXION.test(decode)) return accueil;

  // Le chemin reste sur le site : l'analyse avec une base factice ne doit pas changer d'origine.
  const base = "http://localhost";
  let url: URL;
  try {
    url = new URL(retour, base);
  } catch {
    return accueil;
  }
  if (url.origin !== base || !routing.locales.some((l) => url.pathname === `/${l}` || url.pathname.startsWith(`/${l}/`))) {
    return accueil;
  }
  return retour;
}
