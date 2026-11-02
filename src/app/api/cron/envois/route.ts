import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { creerDependancesEnvois } from "@/modules/envois/dependances";
import { traiterLot } from "@/modules/envois/service";

// Envoi des emails de la boîte d'envoi : un lot borné par appel, déclenché chaque minute par pg_cron et pg_net (AD-10).
// POST seulement. Protégée par CRON_SECRET (en-tête Authorization: Bearer). Sans RESEND_API_KEY ni EMAIL_EXPEDITEUR,
// la route répond 503 avant de réserver le moindre envoi : rien n'est consommé ni simulé (règles 13 et 15).
async function envoyer(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const cleResend = process.env.RESEND_API_KEY?.trim();
  const expediteur = process.env.EMAIL_EXPEDITEUR?.trim();
  if (!cleResend || !expediteur) {
    console.error("[envois] RESEND_API_KEY ou EMAIL_EXPEDITEUR absent : aucun envoi traité");
    return NextResponse.json({ ok: false, raison: "configuration_email_absente" }, { status: 503 });
  }
  try {
    const bilan = await traiterLot(creerDependancesEnvois({ cleResend, expediteur }));
    // Jamais d'adresse ni de contenu : seulement des nombres.
    console.log(`[envois] ${bilan.reserves} réservé(s), ${bilan.envoyes} envoyé(s), ${bilan.ignores} ignoré(s), ${bilan.reessais} à réessayer`);
    return NextResponse.json({ ok: !bilan.erreurBase, ...bilan }, { status: bilan.erreurBase ? 500 : 200 });
  } catch {
    console.error("[envois] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = envoyer;
