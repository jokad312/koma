import type { ActionMesure } from "./actions";

// Types de la mesure d'audience (story 9.7). Aucune de ces valeurs n'est une donnée personnelle.

export type LangueMesure = "fr" | "en";
export type Appareil = "mobile" | "tablette" | "ordinateur" | "inconnu";

export const LANGUES_MESURE = ["fr", "en"] as const;
export const APPAREILS = ["mobile", "tablette", "ordinateur", "inconnu"] as const;

// Ce que la route transmet à la fonction d'écriture, une fois le chemin recalculé côté serveur.
export type EntreeMesure = {
  action: ActionMesure;
  page: string;
  origine: string | null;
  referent: string | null;
  langue: LangueMesure;
  appareil: Appareil;
  session: string;
  dureeMs: number | null;
};

// Accès réels, remplacés par des faux nommés TEST_ dans les tests.
export type DependancesMesure = {
  // En-tête Referer de la requête : seule source fiable du chemin, jamais le champ envoyé par le client.
  referer: () => Promise<string | null>;
  // Hôte de la requête : le Referer doit venir de la même origine, sinon il est ignoré.
  hote: () => Promise<string | null>;
  // HMAC de l'adresse IP (jamais l'adresse en clair) : sert uniquement de clé de limitation, dans limite_essai.
  empreinteClient: () => Promise<string | null>;
  consommerEssai: (args: { cle: string; fenetreSecondes: number; maximum: number }) => Promise<boolean>;
  enregistrer: (entree: EntreeMesure) => Promise<{ erreur: string | null }>;
};

// « sans_referer » : aucune écriture, car le chemin ne peut pas être vérifié.
export type ResultatMesure = "ok" | "refuse" | "sans_referer" | "invalide" | "erreur";
