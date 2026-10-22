import "server-only";
import { exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import { premierSlugLibre } from "./queries";
import type { DependancesCatalogue } from "./types";

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
// Aucune étiquette de cache à invalider ici : le catalogue public n'est pas encore en cache (stories 2.4 et 2.5).
export function dependances(): DependancesCatalogue {
  const admin = creerClientService();
  return {
    exigerDroit,
    ecrireUnivers: async ({ auteur, nomFr, nomEn }) => {
      const { data, error } = await admin.rpc("creer_univers", { p_auteur: auteur as never, p_nom_fr: nomFr, p_nom_en: nomEn });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    ecrireProduit: async ({ auteur, id, produit, variantes }) => {
      const { data, error } = await admin.rpc("enregistrer_produit", {
        p_auteur: auteur as never,
        p_id: (id ?? null) as never,
        p_produit: produit as never,
        p_variantes: variantes as never,
      });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    premierSlugLibre,
  };
}
