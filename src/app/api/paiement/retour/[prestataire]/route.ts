import { NextResponse, type NextRequest } from "next/server";
import { cheminPublic } from "@/i18n/adresses";
import { lireEnvPublique } from "@/lib/env";
import { NOM_COOKIE_LANGUE, routing, type Locale } from "@/i18n/routing";
import { CODES_PRESTATAIRE } from "@/modules/paiement/types";

// Page de retour d'un Prestataire (FR-20, story 4.6). Elle accepte un retour en GET ou en POST et redirige toujours vers la page de la
// Commande, qui n'affiche que l'état lu côté serveur : tout paramètre de statut de l'adresse (« ?status=success »…) est ignoré. Seul le
// numéro de Commande, que nous avons nous-mêmes mis dans l'adresse de retour, est lu ; il est revalidé et la page vérifie qu'il est au Compte connecté.
const NUMERO = /^KS-[0-9]{4}-[0-9]{6,}$/;

function langue(requete: NextRequest): Locale {
  const valeur = requete.cookies.get(NOM_COOKIE_LANGUE)?.value;
  return routing.locales.find((l) => l === valeur) ?? routing.defaultLocale;
}

async function numeroDe(requete: NextRequest): Promise<string | null> {
  let brut = requete.nextUrl.searchParams.get("numero");
  if (!brut && requete.method === "POST") {
    try {
      const donnees = await requete.formData();
      const valeur = donnees.get("numero");
      brut = typeof valeur === "string" ? valeur : null;
    } catch {
      brut = null;
    }
  }
  return brut && NUMERO.test(brut) ? brut : null;
}

async function retour(requete: NextRequest, contexte: { params: Promise<{ prestataire: string }> }) {
  const { prestataire } = await contexte.params;
  if (!(CODES_PRESTATAIRE as readonly string[]).includes(prestataire)) return new NextResponse(null, { status: 404 });
  const locale = langue(requete);
  const numero = await numeroDe(requete);
  const base = `/${locale}${cheminPublic(locale, "/commande")}`;
  // L'adresse du site vient de NEXT_PUBLIC_SITE_URL (jamais écrite en dur) : derrière un proxy, l'hôte de la requête peut être interne.
  const cible = new URL(numero ? `${base}/${numero}` : base, lireEnvPublique().NEXT_PUBLIC_SITE_URL);
  // 303 : un retour en POST devient une lecture (GET) de la page de la Commande.
  return NextResponse.redirect(cible, { status: 303, headers: { "Cache-Control": "no-store" } });
}

export const GET = retour;
export const POST = retour;
