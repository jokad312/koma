import { contientMarqueur } from "@/lib/vitrine/marqueur";
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

type DonneesPage = { nom: string; description: string; url: string; langue: string };

export function pageWebJsonLd({ nom, description, url, langue }: DonneesPage) {
  return { "@context": "https://schema.org", "@type": "WebPage", name: nom, description, url, inLanguage: langue };
}

export function pageContactJsonLd({ nom, description, url, langue }: DonneesPage) {
  return { "@context": "https://schema.org", "@type": "ContactPage", name: nom, description, url, inLanguage: langue };
}

export type PaireFaq = { question: string; reponse: string };

// FAQPage des seules vraies paires : une paire dont la question ou la réponse contient le marqueur « [Texte à fournir] » est exclue.
// Aucune paire réelle : null (la page publie alors un simple WebPage).
export function faqJsonLd(paires: readonly PaireFaq[], { url, langue }: { url: string; langue: string }) {
  const reelles = paires.filter((p) => !contientMarqueur(p.question) && !contientMarqueur(p.reponse));
  if (reelles.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url,
    inLanguage: langue,
    mainEntity: reelles.map((p) => ({ "@type": "Question", name: p.question, acceptedAnswer: { "@type": "Answer", text: p.reponse } })),
  };
}

export type MaillonFilAriane = { nom: string; url: string };

// Fil d'Ariane (BreadcrumbList) : Accueil puis la page ; la dernière entrée est la page courante.
export function filArianeJsonLd(maillons: readonly MaillonFilAriane[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: maillons.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nom, item: m.url })),
  };
}

type DonneesProduit = {
  nom: string;
  description: string;
  images: readonly string[];
  url: string;
  langue: string;
  prixCents: number;
  // URL schema.org de ItemAvailability, calculée à la requête.
  disponibilite: string;
};

// Product + Offer d'une fiche : prix USD lu en base, jamais de note, d'avis ni d'aggregateRating.
export function produitJsonLd({ nom, description, images, url, langue, prixCents, disponibilite }: DonneesProduit) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: nom,
    description,
    image: images,
    url,
    inLanguage: langue,
    offers: {
      "@type": "Offer",
      url,
      price: (prixCents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: disponibilite,
    },
  };
}
