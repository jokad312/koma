import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { creerClientService } from "@/lib/supabase/service";

// Galerie d'événement (story 7.10, FR-39, AD-9, AD-10) : déclenchée chaque heure par pg_cron et pg_net. POST seulement, protégée par CRON_SECRET
// (en-tête Authorization: Bearer). Pose dans la boîte d'envoi un email par acheteur de Pass pour chaque Événement terminé dont le lien est saisi ;
// l'envoi lui-même est fait par /api/cron/envois. La base décide, une seule fois par acheteur et par Événement (clé d'envoi).
async function lancer(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const { data, error } = await creerClientService().rpc("planifier_galeries_evenements");
    if (error || typeof data !== "number") {
      console.error("[galerie-evenement] planification impossible");
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    // Jamais d'adresse ni de lien : seulement un nombre.
    console.log(`[galerie-evenement] ${data} email(s) planifié(s)`);
    return NextResponse.json({ ok: true, planifies: data }, { status: 200 });
  } catch {
    console.error("[galerie-evenement] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = lancer;
