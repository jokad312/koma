import { connection, NextResponse } from "next/server";
import { dependancesVideo } from "@/modules/bibliotheque/dependances-video";
import { preparerLecture } from "@/modules/bibliotheque/video";

// Jamais mis en cache : chaque demande vérifie l'accès et signe un nouveau jeton (règle 1, AD-11).
const ENTETES = { "Cache-Control": "no-store" };

export async function GET(_requete: Request, contexte: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await contexte.params;
  const resultat = await preparerLecture(dependancesVideo(), slug);
  switch (resultat.statut) {
    case "ok":
      return NextResponse.json(resultat.lecture, { status: 200, headers: ENTETES });
    case "non_connecte":
      return NextResponse.json({ erreur: "non_connecte" }, { status: 401, headers: ENTETES });
    case "refuse":
      return NextResponse.json({ erreur: "refuse" }, { status: 403, headers: ENTETES });
    default:
      return NextResponse.json({ erreur: "echec" }, { status: 500, headers: ENTETES });
  }
}
