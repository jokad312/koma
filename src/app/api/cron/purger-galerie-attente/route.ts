import { createHash, timingSafeEqual } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE } from "@/lib/supabase/stockage";
import { purgerGalerieAttente, type StockageAttente } from "@/modules/catalogue/purge";

// Purge des originaux abandonnés de galerie-attente (plus de 24 h). POST seulement (action destructrice). Protégée par CRON_SECRET (en-tête Authorization: Bearer).
// Pas encore planifiée : aucun domaine (Q-D1) ; la route est prête et testée (voir journal-enchainement.md).

// Comparaison à temps constant : les deux valeurs sont réduites à une empreinte de même longueur.
function secretValide(recu: string | null): boolean {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || !recu) return false;
  const m = /^\s*bearer\s+(\S+)\s*$/i.exec(recu);
  if (!m) return false;
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

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
  };
}

async function purger(requete: Request) {
  await connection();
  if (!secretValide(requete.headers.get("authorization"))) {
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
