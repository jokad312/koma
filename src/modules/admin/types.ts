import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// Codes d'erreur renvoyés par les actions : le texte vient de messages/*.json, côté interface.
export type CodeErreurAdmin =
  | "non_autorise"
  | "nom_invalide"
  | "numero_invalide"
  | "forfait_goma_invalide"
  | "forfait_bukavu_invalide"
  | "retrait_fr_invalide"
  | "retrait_en_invalide"
  | "plafond_invalide"
  | "raison_manquante"
  | "age_invalide"
  | "age_non_declare"
  | "suppression_echouee"
  | "message_introuvable"
  | "generique";

export type ResultatAdmin<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurAdmin };

export type CleReglage =
  | "nom_site"
  | "numero_whatsapp"
  | "forfait_livraison_goma_cents"
  | "forfait_livraison_bukavu_cents"
  | "retrait_goma_fr"
  | "retrait_goma_en"
  | "plafond_fabrication";

// Ce que le service attend du serveur : en production, les vrais clients ; en test, des faux nommés TEST_.
export type DependancesAdmin = {
  // Refuse (lève) si le Compte connecté n'a pas le droit ; renvoie l'auteur construit depuis la session vérifiée.
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  ecrireReglage(args: { auteur: AuteurCompte; cle: CleReglage; valeur: string | null }): Promise<{ erreur: string | null }>;
  // Vide l'étiquette de cache `reglages` (updateTag) : appelé seulement après la réponse de la base.
  invalider(): void;
  corrigerAge(args: { auteur: AuteurCompte; compteId: string; age: number; raison: string }): Promise<{ erreur: string | null; supprimer: boolean }>;
  supprimerCompte(compteId: string): Promise<{ erreur: boolean }>;
  marquerMessageTraite(args: { auteur: AuteurCompte; id: string }): Promise<{ erreur: string | null }>;
};

// Message du formulaire de contact, tel que l'admin le lit (données personnelles : jamais journalisées ni copiées ailleurs).
export type MessageContactAdmin = { id: string; nom: string; email: string; message: string; langue: string; creeLe: string };

// Valeurs telles que la base les garde (texte) ; null = jamais saisie (« Valeur à fixer »). Les forfaits sont en centimes USD.
export type ReglagesAdmin = {
  nomSite: string | null;
  numeroWhatsapp: string | null;
  forfaitLivraisonGomaCents: string | null;
  forfaitLivraisonBukavuCents: string | null;
  retraitGomaFr: string | null;
  retraitGomaEn: string | null;
  plafondFabrication: string | null;
};
