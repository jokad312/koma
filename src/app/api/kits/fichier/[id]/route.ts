import { connection, NextResponse } from "next/server";
import { dependancesTelechargement } from "@/modules/bibliotheque/dependances-telechargement";
import { preparerTelechargement } from "@/modules/bibliotheque/telechargement";

// Jamais mis en cache : chaque clic vérifie l'accès et crée un nouveau lien de 60 secondes (règle 1, AD-11).
const ENTETES = { "Cache-Control": "no-store" };

export async function GET(_requete: Request, contexte: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await contexte.params;
  const resultat = await preparerTelechargement(await dependancesTelechargement(), id);
  switch (resultat.statut) {
    case "ok":
      return NextResponse.json({ url: resultat.url }, { status: 200, headers: ENTETES });
    case "non_connecte":
      return NextResponse.json({ erreur: "non_connecte" }, { status: 401, headers: ENTETES });
    case "refuse":
      return NextResponse.json({ erreur: "refuse" }, { status: 403, headers: ENTETES });
    default:
      return NextResponse.json({ erreur: "echec" }, { status: 500, headers: ENTETES });
  }
}
