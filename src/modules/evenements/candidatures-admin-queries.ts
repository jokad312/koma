import "server-only";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_CANDIDATURES_STAND, etatCandidature, type CandidatureAdmin } from "./candidatures-admin";

// Durée de vie d'un lien de photo (secondes) : le temps de regarder la page.
const DUREE_LIEN_SECONDES = 300;

// Candidatures Stand d'un Événement, les plus récentes d'abord (Admin seulement, droit revérifié ici). Une erreur est relancée : jamais une liste vide inventée.
export async function lireCandidaturesAdmin(_auteur: AuteurCompte, evenementId: string): Promise<CandidatureAdmin[]> {
  await exigerDroit("evenements.gerer");
  const client = creerClientService();
  const { data, error } = await client
    .from("candidature_stand")
    .select("id, compte_id, statut, expire_le, description, instagram, photos, motif_refus, commande_id, photos_purgees_le, cree_le, type:type_pass_id(nom_fr)")
    .eq("evenement_id", evenementId)
    .order("cree_le", { ascending: false })
    .limit(200);
  if (error) throw new Error("Lecture des candidatures impossible.");
  const lignes = data ?? [];
  const commandes = lignes.map((l) => l.commande_id).filter((c): c is string => c !== null);
  const statuts = new Map<string, string>();
  if (commandes.length > 0) {
    const { data: cmd, error: erreurCmd } = await client.from("commande").select("id, statut").in("id", commandes);
    if (erreurCmd) throw new Error("Lecture des commandes impossible.");
    for (const c of cmd ?? []) statuts.set(c.id, c.statut);
  }
  const maintenant = Date.now();
  return Promise.all(
    lignes.map(async (l) => {
      const type = Array.isArray(l.type) ? (l.type[0] ?? null) : l.type;
      const compte = await client.auth.admin.getUserById(l.compte_id);
      let photos: string[] = [];
      if (l.photos_purgees_le === null && l.photos.length > 0) {
        const { data: signes, error: erreurSigne } = await client.storage.from(BUCKET_CANDIDATURES_STAND).createSignedUrls(l.photos, DUREE_LIEN_SECONDES);
        if (erreurSigne) throw new Error("Liens des photos impossibles.");
        photos = (signes ?? []).map((s) => s.signedUrl).filter((u): u is string => typeof u === "string" && u !== "");
      }
      return {
        id: l.id,
        etat: etatCandidature({ statut: l.statut, expireLe: l.expire_le, commandeStatut: l.commande_id ? (statuts.get(l.commande_id) ?? null) : null }, maintenant),
        email: compte.data.user?.email ?? null,
        typeNom: type?.nom_fr ?? "",
        creeLe: l.cree_le,
        expireLe: l.expire_le,
        description: l.description,
        instagram: l.instagram,
        photos,
        photosPurgees: l.photos_purgees_le !== null,
        motifRefus: l.motif_refus,
      };
    }),
  );
}
