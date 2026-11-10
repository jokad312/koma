import { connection, NextResponse } from "next/server";
import { dependancesMesure } from "@/modules/mesure/dependances";
import { enregistrerEvenement } from "@/modules/mesure/service";

// Mesure d'audience maison (story 9.7, AD-19) : aucune lecture publique, aucune donnée personnelle.
// POST seulement ; le chemin vient du Referer (jamais du corps), donc un Referer absent n'écrit rien (204).
const SANS_CACHE = { "Cache-Control": "no-store" };
const TAILLE_MAX_OCTETS = 1024;

function reponse(status: number) {
  return new NextResponse(null, { status, headers: SANS_CACHE });
}

export async function POST(requete: Request) {
  await connection();
  // Seul un envoi JSON de notre propre page passe : un formulaire croisé (text/plain) est refusé.
  if (!(requete.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return reponse(415);

  const annonce = requete.headers.get("content-length");
  if (annonce !== null) {
    const taille = Number(annonce);
    if (!Number.isFinite(taille) || taille > TAILLE_MAX_OCTETS) return reponse(413);
  }

  const texte = await requete.text().catch(() => null);
  if (texte === null) return reponse(400);
  if (new TextEncoder().encode(texte).length > TAILLE_MAX_OCTETS) return reponse(413);

  let corps: unknown;
  try {
    corps = JSON.parse(texte);
  } catch {
    return reponse(400);
  }

  try {
    const resultat = await enregistrerEvenement(dependancesMesure(), corps);
    if (resultat === "invalide") return reponse(400);
    if (resultat === "erreur") return reponse(500);
    // ok, refusé (page exclue, débit) et sans Referer : même réponse, aucun détail.
    return reponse(204);
  } catch {
    console.error("[mesure] écriture impossible");
    return reponse(500);
  }
}
