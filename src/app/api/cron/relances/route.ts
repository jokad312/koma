import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { creerClientService } from "@/lib/supabase/service";

// Relances après achat (story 9.5, FR-45, AD-23) : déclenchée toutes les 6 heures par pg_cron et pg_net. POST seulement, protégée par CRON_SECRET
// (en-tête Authorization: Bearer). Pose dans la boîte d'envoi au plus une Relance par Compte et par rythme (réglage relances_rythme_jours) ; l'envoi
// lui-même, avec les règles de la story 9.4 (consentement, mineurs, un Email commercial tous les 2 jours), est fait par /api/cron/envois.
// La base décide du sujet et ne planifie jamais deux fois la même Relance (clé d'envoi) : la tâche peut être rejouée.
async function lancer(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const { data, error } = await creerClientService().rpc("planifier_relances");
    if (error || typeof data !== "number") {
      console.error("[relances] planification impossible");
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    // Jamais d'adresse ni d'identifiant de Compte : seulement un nombre.
    console.log(`[relances] ${data} relance(s) planifiée(s)`);
    return NextResponse.json({ ok: true, planifiees: data }, { status: 200 });
  } catch {
    console.error("[relances] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = lancer;
