import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE } from "@/lib/supabase/stockage";
import { purgerGalerieAttente, type StockageAttente } from "@/modules/catalogue/purge";

// Purge des originaux abandonnés de galerie-attente (plus de 24 h). POST seulement (action destructrice). Protégée par CRON_SECRET (en-tête Authorization: Bearer).
// Pas encore planifiée : aucun domaine (Q-D1) ; la route est prête et testée (voir journal-enchainement.md).

function stockageReel(): StockageAttente {
  const bucket = creerClientService().storage.from(BUCKET_ATTENTE);
  return {
    lister: async (dossier) => {
      const entrees: Awaited<ReturnType<StockageAttente["lister"]>>["entrees"] = [];
      const page = 100;
      for (let offset = 0; ; offset += page) {
        const { data, error } = await bucket.list(dossier, { limit: page, offset, sortBy: { column: "name", order: "asc" } });
        if (error) return { erreur: error.message, entrees: [] };
        for (const o of data) entrees.push({ name: o.name, creeLe: o.updated_at ?? o.created_at ?? null, estDossier: o.id === null });
        if (data.length < page) return { erreur: null, entrees };
      }
    },
    supprimer: async (objets) => {
      const { data, error } = await bucket.remove(objets);
      return { erreur: error ? error.message : null, effaces: error ? 0 : (data?.length ?? 0) };
    },
    // Photos de clients encore vivantes (story 8.1) : lues par pages ; une erreur suspend la purge de photos-clients/.
    photosEnregistrees: async () => {
      const vivantes = new Set<string>();
      const page = 1000;
      for (let debut = 0; ; debut += page) {
        const { data, error } = await creerClientService().from("photo_galerie").select("objet").neq("statut", "retiree").order("id").range(debut, debut + page - 1);
        if (error) return null;
        for (const l of data ?? []) vivantes.add(l.objet);
        if ((data ?? []).length < page) return vivantes;
      }
    },
  };
}

async function purger(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const r = await purgerGalerieAttente(stockageReel(), Date.now());
    if (!r.ok) {
      console.error("[purge] lecture de galerie-attente impossible");
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    // Jamais de nom d'objet : seulement des nombres. Un échec partiel répond 500 pour que le Cron le voie.
    console.log(`[purge] galerie-attente : ${r.effaces} objet(s) effacé(s), ${r.echecs} échec(s)`);
    return NextResponse.json({ ok: r.echecs === 0, effaces: r.effaces, echecs: r.echecs }, { status: r.echecs === 0 ? 200 : 500 });
  } catch {
    console.error("[purge] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = purger;
