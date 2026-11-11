import "server-only";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { AccesBenevole, DependancesBenevoles } from "./types";

const codeKs = (message: string, code: string | undefined) => /KS_[A-Z_]+/.exec(message)?.[0] ?? (code || "inconnu");

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependancesBenevoles(): DependancesBenevoles {
  const admin = creerClientService();
  return {
    exigerDroit: async () => {
      const { auteur } = await exigerDroit("benevoles.acces");
      return { auteur };
    },
    attribuer: async ({ auteur, evenementId, email }) => {
      const { data, error } = await admin.rpc("attribuer_acces_benevole", { p_auteur: auteur as unknown as Json, p_evenement: evenementId, p_email: email });
      if (error) return { erreur: codeKs(error.message, error.code), statut: null };
      const statut = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>).statut : null;
      return { erreur: null, statut: typeof statut === "string" ? statut : null };
    },
    retirer: async ({ auteur, evenementId, accesId }) => {
      const { data, error } = await admin.rpc("retirer_acces_benevole", { p_auteur: auteur as unknown as Json, p_evenement: evenementId, p_acces: accesId });
      if (error) return { erreur: codeKs(error.message, error.code), retire: false };
      return { erreur: null, retire: data === true };
    },
  };
}

// Page admin : les accès de CET Événement, avec l'email (Admin seulement : la base revérifie le droit). Une erreur est relancée, jamais une liste vide inventée.
export async function lireAccesBenevoles(auteur: AuteurCompte, evenementId: string): Promise<AccesBenevole[]> {
  const { data, error } = await creerClientService().rpc("lister_acces_benevoles", { p_auteur: auteur as unknown as Json, p_evenement: evenementId });
  if (error || !Array.isArray(data)) throw new Error("Lecture des accès bénévoles impossible.");
  const maintenant = Date.now();
  return data.map((l) => ({
    id: l.id,
    email: l.email,
    valableDu: l.valable_du,
    valableJusquAu: l.valable_jusqu_au,
    etat: l.valide ? ("valide" as const) : Date.parse(l.valable_du) > maintenant ? ("avenir" as const) : ("termine" as const),
  }));
}
