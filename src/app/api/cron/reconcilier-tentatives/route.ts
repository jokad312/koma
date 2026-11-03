import { connection, NextResponse } from "next/server";
import { secretCronValide } from "@/lib/auth/secret-cron";
import { reconcilier } from "@/modules/paiement/confirmation";
import { dependancesConfirmation } from "@/modules/paiement/dependances-confirmation";

// Réconciliation des Tentatives de paiement sans réponse (AD-10) : un lot borné par appel, déclenché chaque minute par pg_cron et pg_net.
// POST seulement, protégée par CRON_SECRET. Interroge l'API de chaque Prestataire branché et applique le résultat par les mêmes fonctions que
// les notifications ; aucun résultat n'est jamais déduit d'un silence.
async function lancer(requete: Request) {
  await connection();
  if (!secretCronValide(requete.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const bilan = await reconcilier(dependancesConfirmation());
    // Jamais de référence ni de montant : seulement des nombres.
    console.log(`[reconciliation] ${bilan.interrogees} interrogée(s), ${bilan.payees} payée(s), ${bilan.echouees} échouée(s), ${bilan.abandonnees} abandonnée(s), ${bilan.erreurs} erreur(s)`);
    return NextResponse.json({ ok: bilan.erreurs === 0, ...bilan }, { status: bilan.erreurs > 0 && bilan.interrogees === 0 ? 500 : 200 });
  } catch {
    console.error("[reconciliation] exception inattendue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = lancer;
