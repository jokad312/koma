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

// Lecture par morceaux, coupée dès 1 024 octets : un corps sans Content-Length (envoi en flux) n'est jamais lu en entier.
async function lireBorne(requete: Request): Promise<string | null | "trop_gros"> {
  if (!requete.body) return null;
  const lecteur = requete.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAILLE_MAX_OCTETS) {
        await lecteur.cancel().catch(() => undefined);
        return "trop_gros";
      }
      morceaux.push(value);
    }
  } catch {
    return null;
  }
  const octets = new Uint8Array(total);
  let position = 0;
  for (const m of morceaux) {
    octets.set(m, position);
    position += m.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return null;
  }
}

export async function POST(requete: Request) {
  await connection();
  // Seul un envoi JSON de notre propre page passe : un formulaire croisé (text/plain) est refusé.
  const type = (requete.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return reponse(415);

  const annonce = requete.headers.get("content-length");
  if (annonce !== null) {
    const taille = Number(annonce);
    if (!Number.isFinite(taille) || taille > TAILLE_MAX_OCTETS) return reponse(413);
  }

  const texte = await lireBorne(requete);
  if (texte === "trop_gros") return reponse(413);
  if (texte === null) return reponse(400);

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
