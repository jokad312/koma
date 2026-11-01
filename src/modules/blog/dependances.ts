import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { exigerDroit } from "@/lib/auth/droits";
import type { DependancesBlog } from "./types";
import type { ArticleImage } from "./types";

// Schéma de validation Zod de l'article
import { schemaArticle } from "./schemas";

// Les vrais clients Supabase donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesBlog {
  const admin = creerClientService();
  return {
    exigerDroit,
    enregistrerArticle: async ({ auteur, id, article, images }) => {
      const { error } = await admin.rpc("enregistrer_article" as never, {
        p_auteur: auteur as never,
        p_id: id as never,
        p_article: article as never,
        p_images: images as never,
      } as never);
      // Seule la cause est renvoyée : le code KS_ du refus, sinon le code SQL. Jamais de donnée saisie.
      return { erreur: error ? (error.message.startsWith("KS_") ? error.message : (error.code || "inconnu")) : null, id: id ?? null };
    },
    changerPublication: async ({ auteur, id, publier }) => {
      const { error } = publier
        ? await admin.rpc("publier_article" as never, { p_auteur: auteur as never, p_id: id as never } as never)
        : await admin.rpc("depublier_article" as never, { p_auteur: auteur as never, p_id: id as never } as never);
      return { erreur: error ? (error.message.startsWith("KS_") ? error.message : (error.code || "inconnu")) : null };
    },
  };
}