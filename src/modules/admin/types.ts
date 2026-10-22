import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// Codes d'erreur renvoyés par les actions : le texte vient de messages/*.json, côté interface.
export type CodeErreurAdmin =
  | "non_autorise"
  | "nom_invalide"
  | "numero_invalide"
  | "raison_manquante"
  | "age_invalide"
  | "age_non_declare"
  | "suppression_echouee"
  | "message_introuvable"
  | "generique";

export type ResultatAdmin<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurAdmin };

export type CleReglage = "nom_site" | "numero_whatsapp";

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

export type ReglagesAdmin = { nomSite: string | null; numeroWhatsapp: string | null };
