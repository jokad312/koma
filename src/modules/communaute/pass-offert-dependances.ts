import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { DependancesPassOffert, OptionsPassOffert } from "./pass-offert";

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texte = (v: unknown): string | null => (typeof v === "string" ? v : null);

// Les vrais accès (en test, des faux nommés TEST_ les remplacent). Chaque fonction SQL revérifie le rôle Admin.
export function dependancesPassOffert(): DependancesPassOffert {
  const client = creerClientService();
  return {
    exigerDroit: (droit) => exigerDroit(droit),
    lireRealisation: async ({ auteur, photoId }) => {
      const { data, error } = await client.rpc("realisation_pour_offre", { p_auteur: auteur as unknown as Json, p_photo: photoId });
      const d = objet(data);
      if (error || !d || !texte(d.realisation_id) || !texte(d.compte_id)) return { erreur: error?.message ?? "realisation_pour_offre" };
      return { realisationId: texte(d.realisation_id)!, compteId: texte(d.compte_id)!, nomAffiche: texte(d.nom_affiche) };
    },
    nomDuCompte: async (compteId) => {
      const utilisateur = await client.auth.admin.getUserById(compteId);
      const meta = utilisateur.data.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
      return [meta?.full_name, meta?.name].find((n): n is string => typeof n === "string" && n.trim().length > 0)?.trim() ?? null;
    },
    attribuer: async ({ auteur, realisationId, typePassId, titulaire }) => {
      const { data, error } = await client.rpc("attribuer_pass_offert", { p_auteur: auteur as unknown as Json, p_realisation: realisationId, p_type: typePassId, p_titulaire: titulaire });
      if (error) return { attribue: false, rang: 0, erreur: error.message };
      const d = objet(data);
      if (!d) return { attribue: false, rang: 0, erreur: "attribuer_pass_offert" };
      return { attribue: d.attribue === true, rang: typeof d.rang === "number" ? d.rang : 0, erreur: null };
    },
    invalider: async () => updateTag(ETIQUETTES.evenements),
  };
}

// Options de l'écran de l'Admin (Événements à venir avec de la place et attributions déjà faites). Une erreur est relancée : jamais une liste inventée.
export async function lireOptionsPassOffert(auteur: AuteurCompte): Promise<OptionsPassOffert> {
  const { data, error } = await creerClientService().rpc("pass_offerts_options", { p_auteur: auteur as unknown as Json });
  const d = objet(data);
  if (error || !d) throw new Error("Lecture des options de Pass offerts impossible.");
  const evenements: OptionsPassOffert["evenements"] = [];
  for (const e of Array.isArray(d.evenements) ? d.evenements : []) {
    const o = objet(e);
    if (!o || !texte(o.id) || !texte(o.titre_fr) || !texte(o.debut_le)) continue;
    const types: OptionsPassOffert["evenements"][number]["types"] = [];
    for (const t of Array.isArray(o.types) ? o.types : []) {
      const x = objet(t);
      if (x && texte(x.id) && texte(x.nom_fr)) types.push({ id: texte(x.id)!, nomFr: texte(x.nom_fr)!, nomEn: texte(x.nom_en) });
    }
    evenements.push({ id: texte(o.id)!, titreFr: texte(o.titre_fr)!, titreEn: texte(o.titre_en), debutLe: texte(o.debut_le)!, attribues: typeof o.attribues === "number" ? o.attribues : 0, types });
  }
  const attributions: OptionsPassOffert["attributions"] = [];
  for (const a of Array.isArray(d.attributions) ? d.attributions : []) {
    const o = objet(a);
    if (o && texte(o.photo_id) && texte(o.evenement_id) && texte(o.titre_fr) && typeof o.rang === "number") {
      attributions.push({ photoId: texte(o.photo_id)!, evenementId: texte(o.evenement_id)!, titreFr: texte(o.titre_fr)!, titreEn: texte(o.titre_en), rang: o.rang });
    }
  }
  return { evenements, attributions };
}

// Événements dont l'opération est terminée (10 Pass offerts attribués), pour la page des Réalisations du client.
export async function lireOperationsTerminees(): Promise<{ titreFr: string; titreEn: string | null }[]> {
  const { data, error } = await creerClientService().rpc("operations_pass_offerts_terminees");
  if (error || !Array.isArray(data)) throw new Error("Lecture des opérations terminées impossible.");
  return data.flatMap((e) => {
    const o = objet(e);
    return o && texte(o.titre_fr) ? [{ titreFr: texte(o.titre_fr)!, titreEn: texte(o.titre_en) }] : [];
  });
}
