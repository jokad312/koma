import { connection, NextResponse, type NextRequest } from "next/server";
import { lireEnvPublique } from "@/lib/env";
import { dependancesConfirmation } from "@/modules/paiement/dependances-confirmation";
import { traiterNotification } from "@/modules/paiement/confirmation";
import { CODES_PRESTATAIRE, type CodePrestataire, type RequeteNotification } from "@/modules/paiement/types";

// Notification d'un Prestataire (AD-5, règle 2). Une route par Prestataire, jamais appelée par notre navigateur. Le corps n'est jamais cru : l'adaptateur
// le vérifie (signature, ou contre-vérification auprès de l'API) et seule la fonction SQL confirmer_paiement peut passer une Commande à « payée ».
//   401 : vérification échouée, rien n'est changé ; 404 : Prestataire inconnu ou sans adaptateur ; 200 : traité (même si la transition est refusée).
// Certains Prestataires rappellent en GET (le client revient par cette adresse) : le résultat est alors traité de la même façon, puis le client est
// renvoyé vers la page de retour, qui n'affiche que l'état lu côté serveur.
const TAILLE_MAX = 64 * 1024;

async function lire(requete: NextRequest): Promise<RequeteNotification | null> {
  const methode = requete.method === "GET" ? "GET" : "POST";
  let corps = "";
  if (methode === "POST") {
    // Taille contrôlée avant toute lecture du corps.
    const annoncee = Number(requete.headers.get("content-length") ?? "0");
    if (Number.isFinite(annoncee) && annoncee > TAILLE_MAX) return null;
    corps = await requete.text();
    if (corps.length > TAILLE_MAX) return null;
  }
  const en_tetes: Record<string, string> = {};
  requete.headers.forEach((valeur, nom) => {
    en_tetes[nom.toLowerCase()] = valeur;
  });
  return { methode, en_tetes, corps, requete: requete.nextUrl.search.replace(/^\?/, "") };
}

async function notifier(requete: NextRequest, contexte: { params: Promise<{ prestataire: string }> }) {
  await connection();
  const { prestataire } = await contexte.params;
  if (!(CODES_PRESTATAIRE as readonly string[]).includes(prestataire)) return new NextResponse(null, { status: 404 });
  const lue = await lire(requete);
  if (!lue) return new NextResponse(null, { status: 413 });
  const r = await traiterNotification(dependancesConfirmation(), prestataire as CodePrestataire, lue);
  // Le client qui revient en GET est toujours renvoyé vers la page de retour (qui lit l'état côté serveur), même si la vérification a échoué :
  // l'adresse du site vient de NEXT_PUBLIC_SITE_URL, jamais de l'hôte de la requête.
  if (lue.methode === "GET" && r.code !== 404) {
    const numero = r.code === 200 && r.numero ? `?numero=${encodeURIComponent(r.numero)}` : "";
    const cible = new URL(`/api/paiement/retour/${encodeURIComponent(prestataire)}${numero}`, lireEnvPublique().NEXT_PUBLIC_SITE_URL);
    return NextResponse.redirect(cible, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  if (r.code !== 200) return new NextResponse(null, { status: r.code, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export const GET = notifier;
export const POST = notifier;
