import "server-only";
import { cookies } from "next/headers";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { DUREE_COOKIE_PANIER_S, lireSecretPanier, NOM_COOKIE_PANIER } from "@/lib/panier/cookie";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesPanier, LigneBrute } from "./types";

// Les vrais accès donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesPanier {
  const base = () => creerClientService();
  return {
    lireCookie: async () => (await cookies()).get(NOM_COOKIE_PANIER)?.value ?? null,
    poserCookie: async (valeur) => {
      (await cookies()).set(NOM_COOKIE_PANIER, valeur, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DUREE_COOKIE_PANIER_S,
      });
    },
    secret: () => lireSecretPanier(),
    compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
    creerPanier: async (auteur) => {
      const { data, error } = await base().rpc("creer_panier", { p_auteur: auteur as never });
      return error || typeof data !== "string" ? { erreur: error?.message ?? "creer_panier" } : { id: data };
    },
    ajouter: async ({ auteur, panierId, compteId, produitId, taille, nombre }) => {
      const { error } = await base().rpc("ajouter_au_panier", {
        p_auteur: auteur as never,
        p_panier: panierId,
        p_compte: compteId as never,
        p_produit: produitId,
        p_taille: taille as never,
        p_nombre: nombre,
      });
      return { erreur: error ? error.message : null };
    },
    modifier: async ({ auteur, panierId, ligneId, nombre }) => {
      const { error } = await base().rpc("modifier_ligne_panier", { p_auteur: auteur as never, p_panier: panierId, p_ligne: ligneId, p_nombre: nombre });
      return { erreur: error ? error.message : null };
    },
    retirer: async ({ auteur, panierId, ligneId }) => {
      const { error } = await base().rpc("retirer_ligne_panier", { p_auteur: auteur as never, p_panier: panierId, p_ligne: ligneId });
      return { erreur: error ? error.message : null };
    },
    lire: async (panierId) => {
      const { data, error } = await base().rpc("lire_panier", { p_panier: panierId });
      return error || !Array.isArray(data) ? { erreur: error?.message ?? "lire_panier" } : { lignes: data as LigneBrute[] };
    },
    compter: async (panierId) => {
      const { data, error } = await base().rpc("compter_panier", { p_panier: panierId });
      return error || typeof data !== "number" ? { erreur: error?.message ?? "compter_panier" } : { nombre: data };
    },
    fusionner: async ({ auteur, compteId, panierId }) => {
      const { data, error } = await base().rpc("fusionner_panier", { p_auteur: auteur as never, p_compte: compteId, p_panier: panierId as never });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "fusionner_panier" };
      const id = (data as Record<string, unknown>).panier_id;
      return { panierId: typeof id === "string" ? id : null };
    },
    avis: async (panierId) => {
      const { data, error } = await base().rpc("avis_kit_possede", { p_panier: panierId });
      return error || typeof data !== "boolean" ? { erreur: error?.message ?? "avis_kit_possede" } : { avis: data };
    },
  };
}
