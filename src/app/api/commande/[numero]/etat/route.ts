import { connection, NextResponse } from "next/server";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { lireEtatPaiement } from "@/modules/paiement/etat-queries";

// État affichable d'une Commande du Compte connecté (AD-35) : jamais mis en cache, jamais l'état d'une Commande d'un autre Compte (404).
const ENTETES = { "Cache-Control": "no-store" };

export async function GET(_requete: Request, contexte: { params: Promise<{ numero: string }> }) {
  await connection();
  const { numero } = await contexte.params;
  try {
    const session = await lireSessionVerifiee();
    if (!session) return NextResponse.json({ erreur: "non_connecte" }, { status: 401, headers: ENTETES });
    const etat = await lireEtatPaiement(session.compteId, numero);
    if (!etat) return NextResponse.json({ erreur: "introuvable" }, { status: 404, headers: ENTETES });
    return NextResponse.json(etat, { status: 200, headers: ENTETES });
  } catch {
    console.error("[paiement] lecture de l'état impossible");
    return NextResponse.json({ erreur: "echec" }, { status: 500, headers: ENTETES });
  }
}
