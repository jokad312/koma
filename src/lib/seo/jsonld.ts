import { adresseSite } from "./url";

// Données de l'éditeur (CLAUDE.md) ; aucune note, avis ni chiffre.
const EDITEUR = {
  nom: "NATHANGROUP SARL",
  ville: "Goma",
  pays: "CD",
} as const;

export function organisationJsonLd(nomSite: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: nomSite,
    url: adresseSite(),
    legalName: EDITEUR.nom,
    address: { "@type": "PostalAddress", addressLocality: EDITEUR.ville, addressCountry: EDITEUR.pays },
  };
}

// Sérialisation sûre dans une balise <script> : « < » est échappé.
export function serialiserJsonLd(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}
