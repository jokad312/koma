import { z } from "zod";

// État réel d'une Commande pour la page de retour et d'attente (story 4.6, AD-35). Tout vient du serveur : l'adresse de retour, ses
// paramètres de statut, le navigateur ne décident jamais de ce qui s'affiche (FR-20). Module pur : partagé avec les composants clients.

export type PhasePaiement = "a_payer" | "attente" | "payee" | "echec" | "expiree" | "autre";
export type MotifTropPercu = "expiree" | "deja_payee" | "impossible";

// Ce que le serveur donne au navigateur : l'état affichable seulement (ni référence de transaction, ni montant reçu, ni identifiant).
export type EtatPaiement = {
  phase: PhasePaiement;
  // Statut de la Commande en base (« payee », « en_fabrication », « expediee », « livree » pour une Commande payée).
  statut: string;
  kit: boolean;
  // Secondes écoulées depuis le début de la Tentative en cours (phase « attente » seulement).
  attenteDepuisSecondes: number | null;
  causeEchec: "client" | "prestataire" | null;
  tropPercu: MotifTropPercu | null;
};

const brutSchema = z.object({
  statut: z.string(),
  expire_le: z.string().nullable(),
  kit: z.boolean(),
  tentative_en_cours: z.object({ moyen: z.string(), age_secondes: z.number().int().nonnegative() }).nullable(),
  derniere_cause_echec: z.enum(["client", "prestataire"]).nullable(),
  trop_percu: z.enum(["expiree", "deja_payee", "impossible"]).nullable(),
});

const PAYEES = ["payee", "en_fabrication", "expediee", "livree"];

// Passe de la lecture de la base (fonction etat_paiement_commande) à l'état affichable. Une Commande en attente ou échouée dont l'échéance
// est passée est « expirée » même si la tâche planifiée n'est pas encore passée. « Payée » exige un statut payé en base. Lecture invalide : null.
export function deriverEtat(brut: unknown, maintenantMs: number): EtatPaiement | null {
  const lu = brutSchema.safeParse(brut);
  if (!lu.success) return null;
  const { statut, expire_le: expireLe, kit, tentative_en_cours: tentative, derniere_cause_echec: cause, trop_percu: tropPercu } = lu.data;
  const base = { statut, kit, tropPercu, causeEchec: null, attenteDepuisSecondes: null };
  if (PAYEES.includes(statut)) return { ...base, phase: "payee" };
  // Une Tentative en cours est toujours retrouvée (retour arrière, rechargement, autre onglet) : attente ou vérification, jamais un choix.
  if (tentative && (statut === "en_attente" || statut === "echouee")) return { ...base, phase: "attente", attenteDepuisSecondes: tentative.age_secondes };
  if ((statut === "en_attente" || statut === "echouee") && expireLe && new Date(expireLe).getTime() <= maintenantMs) return { ...base, phase: "expiree" };
  if (statut === "expiree") return { ...base, phase: "expiree" };
  if (statut === "en_attente") return { ...base, phase: "a_payer" };
  if (statut === "echouee") return { ...base, phase: "echec", causeEchec: cause };
  return { ...base, phase: "autre" };
}

// Délais de la page d'attente (AD-10, UX-DR36) : sondage toutes les 3 secondes, vérification annoncée après 2 minutes sans état final.
export const INTERVALLE_SONDAGE_MS = 3000;
export const DELAI_VERIFICATION_SECONDES = 120;

// Adresse de retour d'un Prestataire : nous la construisons nous-mêmes et la lui donnons à l'initiation. Seul le numéro de Commande (notre
// référence publique) y figure ; tout paramètre de statut que le Prestataire ajouterait est ignoré par la route.
export function adresseRetourPrestataire(siteUrl: string, prestataire: string, numero: string): string {
  const racine = siteUrl.replace(/\/+$/, "");
  return `${racine}/api/paiement/retour/${encodeURIComponent(prestataire)}?numero=${encodeURIComponent(numero)}`;
}
