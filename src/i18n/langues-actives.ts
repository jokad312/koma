// Langues proposées aux visiteurs (décision de Jonathan du 2026-11-22) : site en français uniquement ; l'anglais est désactivé mais conservé
// pour un éventuel lancement international (messages/en.json, colonnes _en, adresses anglaises de src/i18n/adresses.ts).
// Réactiver l'anglais demande trois choses : remettre "en" dans cette liste ; rétablir les champs anglais des formulaires admin (et les
// contrôles côté client de src/modules/catalogue/publication.ts) ; créer une NOUVELLE migration qui remet les exigences anglaises de
// manques_publication et manques_publication_evenement (retirées par 20270126100000_site_francais_uniquement.sql, à ne jamais modifier).
// Aucun import de next-intl : ce fichier est aussi lu par next.config.ts (via adresses.ts).
export const LANGUES_ACTIVES = ["fr"] as const satisfies readonly ("fr" | "en")[];

export type LangueActive = (typeof LANGUES_ACTIVES)[number];

export function estLangueActive(langue: string | null | undefined): langue is LangueActive {
  return !!langue && (LANGUES_ACTIVES as readonly string[]).includes(langue);
}

// Plus d'une langue active : le sélecteur de langue, les hreflang et les adresses alternatives existent.
export const PLUSIEURS_LANGUES: boolean = (LANGUES_ACTIVES as readonly string[]).length > 1;

// Langue retenue côté serveur (emails, actions) : la langue demandée si elle est active, sinon le français. Un Compte dont la langue
// enregistrée est « en » reçoit ainsi ses emails en français tant que l'anglais est désactivé.
export function langueServie(langue: unknown): LangueActive {
  return typeof langue === "string" && estLangueActive(langue) ? langue : "fr";
}
