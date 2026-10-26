// Table unique des adresses publiques propres à chaque langue (AD-16).
// « interne » est le dossier de src/app/[locale] ; fr et en sont les adresses vues par le visiteur, sans le préfixe de langue.
// Ajouter une page dont l'adresse change selon la langue = ajouter une ligne ici (redirections et réécritures de next.config.ts suivent).
// Aucun import de next-intl : ce fichier est aussi lu par next.config.ts.
type LangueAdresse = "fr" | "en";

export type AdresseLocalisee = { interne: string; fr: string; en: string };

export const ADRESSES: readonly AdresseLocalisee[] = [
  { interne: "/cosplays", fr: "/cosplays", en: "/cosplays" },
  { interne: "/accessoires", fr: "/accessoires", en: "/accessories" },
];

const LANGUES: readonly LangueAdresse[] = ["fr", "en"];

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

// L'adresse de l'autre langue (ou le dossier interne) redirige (308) vers l'adresse propre de la langue demandée.
export function redirectionsAdresses(): Redirection[] {
  const regles: Redirection[] = [];
  for (const locale of LANGUES) {
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

// L'adresse propre d'une langue sert la page du dossier interne, sans changer l'adresse affichée.
export function reecrituresAdresses(): Reecriture[] {
  const regles: Reecriture[] = [];
  for (const locale of LANGUES) {
    for (const adresse of ADRESSES) {
      if (adresse[locale] === adresse.interne) continue;
      regles.push({ source: `/${locale}${adresse[locale]}/:chemin*`, destination: `/${locale}${adresse.interne}/:chemin*` });
    }
  }
  return regles;
}
