// Table unique des adresses publiques propres à chaque langue (AD-16).
// « interne » est le dossier de src/app/[locale] ; fr et en sont les adresses vues par le visiteur, sans le préfixe de langue.
// Ajouter une page dont l'adresse change selon la langue = ajouter une ligne ici (redirections et réécritures de next.config.ts suivent).
// Aucun import de next-intl : ce fichier est aussi lu par next.config.ts.
import { estLangueActive, LANGUES_ACTIVES } from "./langues-actives";

type LangueAdresse = "fr" | "en";

export type AdresseLocalisee = { interne: string; fr: string; en: string };

export const ADRESSES: readonly AdresseLocalisee[] = [
  { interne: "/cosplays", fr: "/cosplays", en: "/cosplays" },
  { interne: "/accessoires", fr: "/accessoires", en: "/accessories" },
  { interne: "/vetements", fr: "/vetements", en: "/clothing" },
  { interne: "/autres-articles", fr: "/autres-articles", en: "/other-items" },
  { interne: "/kits", fr: "/kits", en: "/kits" },
  { interne: "/panier", fr: "/panier", en: "/cart" },
  { interne: "/commande", fr: "/commande", en: "/checkout" },
];

const LANGUES: readonly LangueAdresse[] = ["fr", "en"];
// Langue par défaut du site (même valeur que routing.defaultLocale, que ce fichier ne peut pas importer).
const LANGUE_PAR_DEFAUT: LangueAdresse = "fr";
// Dossiers internes jamais servis tels quels à un visiteur (réécritures du proxy) : sans équivalent public.
const INTERNES_SANS_EQUIVALENT = ["/accueil-connecte", "/introuvable"];

// Remplace le début d'un chemin (segments entiers seulement) : « /accessoires/x » garde sa suite, « /accessoiresx » n'est pas touché.
function traduire(chemin: string, depuis: (a: AdresseLocalisee) => string, vers: (a: AdresseLocalisee) => string): string {
  for (const adresse of ADRESSES) {
    const base = depuis(adresse);
    if (chemin === base || chemin.startsWith(`${base}/`)) return `${vers(adresse)}${chemin.slice(base.length)}`;
  }
  return chemin;
}

// Chemin interne (dossier de l'application) vers l'adresse propre à la langue : ("en", "/accessoires") donne "/accessories".
export function cheminPublic(locale: LangueAdresse, interne: string): string {
  return traduire(interne, (a) => a.interne, (a) => a[locale]);
}

// Adresse vue dans une langue vers l'adresse propre de l'autre langue (sélecteur de langue).
export function cheminAutreLangue(chemin: string, de: LangueAdresse, vers: LangueAdresse): string {
  return traduire(chemin, (a) => a[de], (a) => a[vers]);
}

type Redirection = { source: string; destination: string; permanent: true };
type Reecriture = { source: string; destination: string };

// Adresse d'une langue désactivée (« /en/accessories/x?tri=prix_asc ») vers la page équivalente de la langue par défaut
// (« /fr/accessoires/x?tri=prix_asc ») : redirection 308 du proxy (décision de Jonathan du 2026-11-22, site en français uniquement).
// Le segment anglais devient le dossier interne, puis l'adresse française ; sans équivalent connu, l'accueil « /fr ».
// Renvoie null quand le chemin n'est pas sous une langue désactivée (rien à rediriger).
export function versLangueActive(chemin: string): string | null {
  // Préfixe comparé sans tenir compte de la casse : « /EN/… » est redirigé comme « /en/… ».
  const morceaux = /^\/([a-z]{2})(\/.*)?$/i.exec(chemin);
  if (!morceaux) return null;
  const [, prefixe, reste = ""] = morceaux;
  const langue = prefixe.toLowerCase();
  if (!(LANGUES as readonly string[]).includes(langue) || estLangueActive(langue)) return null;
  const accueil = `/${LANGUE_PAR_DEFAUT}`;
  const suite = reste.replace(/\/+$/, "");
  if (suite === "") return accueil;
  if (INTERNES_SANS_EQUIVALENT.some((i) => suite === i || suite.startsWith(`${i}/`))) return accueil;
  const depuis = langue as LangueAdresse;
  const interne = traduire(suite, (a) => a[depuis], (a) => a.interne);
  return `${accueil}${cheminPublic(LANGUE_PAR_DEFAUT, interne)}`;
}

// L'adresse de l'autre langue (ou le dossier interne) redirige (308) vers l'adresse propre de la langue demandée.
// Langues actives seulement : une langue désactivée est redirigée en entier par le proxy (versLangueActive), qui passe après ces règles ;
// une règle « /en/… » ici ferait un détour par une autre adresse anglaise.
export function redirectionsAdresses(): Redirection[] {
  const regles: Redirection[] = [];
  for (const locale of LANGUES_ACTIVES) {
    for (const adresse of ADRESSES) {
      const bonne = adresse[locale];
      const mauvaises = new Set([adresse.interne, ...LANGUES.map((l) => adresse[l])]);
      mauvaises.delete(bonne);
      for (const mauvaise of mauvaises) {
        regles.push({ source: `/${locale}${mauvaise}/:chemin*`, destination: `/${locale}${bonne}/:chemin*`, permanent: true });
      }
    }
  }
  return regles;
}

// L'adresse propre d'une langue sert la page du dossier interne, sans changer l'adresse affichée (langues actives seulement).
export function reecrituresAdresses(): Reecriture[] {
  const regles: Reecriture[] = [];
  for (const locale of LANGUES_ACTIVES) {
    for (const adresse of ADRESSES) {
      if (adresse[locale] === adresse.interne) continue;
      regles.push({ source: `/${locale}${adresse[locale]}/:chemin*`, destination: `/${locale}${adresse.interne}/:chemin*` });
    }
  }
  return regles;
}
