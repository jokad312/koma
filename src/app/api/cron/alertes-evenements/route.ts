import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { dependancesAlertes } from "@/modules/alertes/dependances";
import { planifierAlertes } from "@/modules/alertes/service";

// Alertes « Me prévenir » (story 7.3, FR-32, AD-10) : déclenchée chaque minute par pg_cron et pg_net. POST seulement, protégée par CRON_SECRET
// (en-tête Authorization: Bearer). Pose dans la boîte d'envoi un email par inscrit pour chaque événement dont la vente vient d'ouvrir ;
// l'envoi lui-même est fait par /api/cron/envois. Aucun email n'est créé ici : la base décide, une seule fois par inscrit.
async function lancer(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const bilan = await planifierAlertes(dependancesAlertes());
    if (!bilan.ok) return NextResponse.json({ ok: false }, { status: 500 });
    // Jamais d'adresse ni de numéro : seulement un nombre.
    console.log(`[alertes] ${bilan.nombre} email(s) planifié(s)`);
    return NextResponse.json({ ok: true, planifies: bilan.nombre }, { status: 200 });
  } catch {
    console.error("[alertes] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = lancer;
