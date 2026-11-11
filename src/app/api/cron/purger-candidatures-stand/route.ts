import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_CANDIDATURES_STAND } from "@/modules/evenements/candidatures-admin";
import { purgerCandidaturesStand, type DependancesPurgeCandidatures } from "@/modules/evenements/candidatures-purge";

// Purge des photos et des liens Instagram des candidatures Stand (story 7.11) : 90 jours après l'Événement, ou après un refus ou une expiration.
// POST seulement (action destructrice). Protégée par CRON_SECRET (en-tête Authorization: Bearer).
// Pas encore planifiée : aucun domaine (Q-D1) ; la route est prête et testée (voir journal-enchainement.md).

function dependancesReelles(): DependancesPurgeCandidatures {
  const client = creerClientService();
  return {
    aPurger: async (limite) => {
      const { data, error } = await client.rpc("candidatures_stand_a_purger", { p_limite: limite });
      if (error || !Array.isArray(data)) return { erreur: "lecture", candidatures: [] };
      return { erreur: null, candidatures: data.map((l) => ({ id: l.candidature_id, photos: l.photos ?? [] })) };
    },
    effacerObjets: async (objets) => {
      const { error } = await client.storage.from(BUCKET_CANDIDATURES_STAND).remove(objets);
      return { erreur: error ? error.message : null };
    },
    listerEnvois: async () => {
      const objets: { objet: string; creeLe: string | null }[] = [];
      const page = 100;
      for (let offset = 0; ; offset += page) {
        const { data, error } = await client.storage.from(BUCKET_CANDIDATURES_STAND).list("envois-candidatures", { limit: page, offset, sortBy: { column: "name", order: "asc" } });
        if (error) return { erreur: error.message, objets: [] };
        for (const o of data) objets.push({ objet: `envois-candidatures/${o.name}`, creeLe: o.updated_at ?? o.created_at ?? null });
        if (data.length < page) return { erreur: null, objets };
      }
    },
    marquerPurgee: async (id) => {
      const { error } = await client.rpc("marquer_candidature_stand_purgee", { p_candidature: id });
      return { erreur: error ? error.message : null };
    },
  };
}

async function purger(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const r = await purgerCandidaturesStand(dependancesReelles());
    // Jamais de nom d'objet : seulement des nombres. Un échec partiel répond 500 pour que le Cron le voie.
    console.log(`[purge-candidatures-stand] ${r.purgees} candidature(s) purgée(s), ${r.envoisEfface} envoi(s) abandonné(s) effacé(s), ${r.echecs} échec(s)`);
    return NextResponse.json({ ok: r.ok, purgees: r.purgees, envoisEfface: r.envoisEfface, echecs: r.echecs }, { status: r.ok ? 200 : 500 });
  } catch {
    console.error("[purge-candidatures-stand] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = purger;
