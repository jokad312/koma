import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { MessageContactAdmin, ReglagesAdmin, TacheAdmin } from "./types";

// Lecture admin des réglages par le client service : jamais le cache public, jamais de valeur de repli (règle 15).
// Une valeur absente reste null : l'écran affiche « Valeur à fixer ».
export async function lireReglagesAdmin(): Promise<ReglagesAdmin> {
  const { data, error } = await creerClientService()
    .from("reglage")
    .select("cle, valeur")
    .in("cle", [
      "nom_site",
      "numero_whatsapp",
      "forfait_livraison_goma_cents",
      "forfait_livraison_bukavu_cents",
      "retrait_goma_fr",
      "retrait_goma_en",
      "plafond_fabrication",
      "delai_paiement",
      "frais_annulation_pass",
      "delai_stand_heures",
      "relances_rythme_jours",
      "session_inactivite_heures",
    ]);
  if (error) throw new Error("Lecture des réglages impossible.");
  const valeur = (cle: string) => data?.find((ligne) => ligne.cle === cle)?.valeur?.trim() || null;
  return {
    nomSite: valeur("nom_site"),
    numeroWhatsapp: valeur("numero_whatsapp"),
    forfaitLivraisonGomaCents: valeur("forfait_livraison_goma_cents"),
    forfaitLivraisonBukavuCents: valeur("forfait_livraison_bukavu_cents"),
    retraitGomaFr: valeur("retrait_goma_fr"),
    retraitGomaEn: valeur("retrait_goma_en"),
    plafondFabrication: valeur("plafond_fabrication"),
    delaiPaiement: valeur("delai_paiement"),
    fraisAnnulationPass: valeur("frais_annulation_pass"),
    delaiStandHeures: valeur("delai_stand_heures"),
    relancesRythmeJours: valeur("relances_rythme_jours"),
    sessionInactiviteHeures: valeur("session_inactivite_heures"),
  };
}

// Messages de contact à traiter (statut « nouveau »), les plus récents d'abord. Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function lireMessagesNouveaux(): Promise<MessageContactAdmin[]> {
  const { data, error } = await creerClientService()
    .from("message_contact")
    .select("id, nom, email, message, langue, cree_le")
    .eq("statut", "nouveau")
    .order("cree_le", { ascending: false });
  if (error) throw new Error("Lecture des messages impossible.");
  return (data ?? []).map((m) => ({ id: m.id, nom: m.nom, email: m.email, message: m.message, langue: m.langue, creeLe: m.cree_le }));
}

// Compteur de la navigation admin : null si la lecture échoue (pas de compteur, jamais un faux zéro).
export async function compterMessagesNouveaux(): Promise<number | null> {
  try {
    const { count, error } = await creerClientService().from("message_contact").select("id", { count: "exact", head: true }).eq("statut", "nouveau");
    if (error || count === null) return null;
    return count;
  } catch {
    return null;
  }
}

// Tâches ouvertes de l'Admin (vue taches_admin), les plus récentes d'abord. Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function lireTachesAdmin(): Promise<TacheAdmin[]> {
  const { data, error } = await creerClientService()
    .from("taches_admin")
    .select("id, type, gravite, cible_type, cible_id, details, cree_le")
    .order("cree_le", { ascending: false });
  if (error) throw new Error("Lecture des tâches impossible.");
  // Les colonnes d'une vue sont nullables dans les types : une ligne incomplète est écartée.
  const taches: TacheAdmin[] = [];
  for (const t of data ?? []) {
    if (!t.id || !t.type || !t.cible_type || !t.cible_id || !t.cree_le) continue;
    taches.push({
      id: t.id,
      type: t.type,
      gravite: t.gravite === "info" || t.gravite === "critique" ? t.gravite : "attention",
      cibleType: t.cible_type,
      cibleId: t.cible_id,
      details: typeof t.details === "object" && t.details !== null && !Array.isArray(t.details) ? (t.details as TacheAdmin["details"]) : {},
      creeLe: t.cree_le,
    });
  }
  return taches;
}
