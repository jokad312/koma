import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { cheminRetourValide } from "@/lib/auth/retour";
import { adresseSite } from "@/lib/seo/url";
import { dependances } from "@/modules/comptes/dependances";
import { COOKIE_RETOUR_GOOGLE } from "@/modules/comptes/google";
import { retourGoogleSchema } from "@/modules/comptes/schemas";
import { terminerGoogle } from "@/modules/comptes/service";

// Retour de Google (via Supabase Auth, PKCE) : échange le code, pose la session, puis ramène à la page quittée
// ou à l'étape « âge » de la connexion. Toute erreur ramène à la connexion avec un message ; jamais de page blanche.
export async function GET(requete: NextRequest) {
  const jar = await cookies();
  let garde: { langue: "fr" | "en"; retour: string } = { langue: "fr", retour: "/fr" };
  try {
    const lu = retourGoogleSchema.safeParse(JSON.parse(jar.get(COOKIE_RETOUR_GOOGLE)?.value ?? ""));
    if (lu.success) garde = { langue: lu.data.langue, retour: cheminRetourValide(lu.data.retour, lu.data.langue) };
  } catch {
    // Cookie absent ou illisible : accueil en français.
  }
  jar.delete({ name: COOKIE_RETOUR_GOOGLE, path: "/auth" });

  const site = adresseSite();
  const versConnexion = (parametres: Record<string, string>) => {
    const cible = new URL(`${site}/${garde.langue}/connexion`);
    // La page quittée est gardée : un nouvel essai (code email) y ramène aussi.
    if (garde.retour !== `/${garde.langue}`) cible.searchParams.set("retour", garde.retour);
    Object.entries(parametres).forEach(([cle, valeur]) => cible.searchParams.set(cle, valeur));
    return NextResponse.redirect(cible);
  };

  // Refus ou annulation chez Google : seul l'indicateur d'erreur compte, aucun détail n'est relayé ni journalisé.
  if (requete.nextUrl.searchParams.has("error")) return versConnexion({ erreur: "google" });

  const resultat = await terminerGoogle(await dependances(), {
    code: requete.nextUrl.searchParams.get("code"),
    langue: garde.langue,
    retour: garde.retour,
  });
  if (!resultat.ok) return versConnexion({ erreur: "google" });
  if (resultat.etape !== "termine") return versConnexion({});
  return NextResponse.redirect(new URL(resultat.retour, site));
}
