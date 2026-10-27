import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { lireEnvPublique } from "@/lib/env";
import { choisirLangue } from "@/i18n/detection";
import { NOM_COOKIE_LANGUE, routing } from "@/i18n/routing";
import { analyserAdresseFiche, ficheExiste } from "@/modules/catalogue/existence";

const intl = createIntlMiddleware(routing);

function estCheminLocalise(chemin: string) {
  return routing.locales.some((l) => chemin === `/${l}` || chemin.startsWith(`/${l}/`));
}

// Enchaîne la session Supabase puis la langue. Ne redirige jamais une page publique vers la connexion ;
// seule exception décidée le 2026-10-21 : « / » mène à /fr ou /en.
export async function proxy(request: NextRequest) {
  let reponseSession = NextResponse.next({ request });
  const env = lireEnvPublique();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aPoser) => {
        aPoser.forEach(({ name, value }) => request.cookies.set(name, value));
        reponseSession = NextResponse.next({ request });
        aPoser.forEach(({ name, value, options }) => reponseSession.cookies.set(name, value, options));
      },
    },
  });

  // Supabase indisponible : la requête continue comme pour un visiteur non connecté (aucune page publique en 500).
  // Seul le nom de l'erreur est journalisé : ni message, ni jeton, ni cookie.
  try {
    const { error } = await supabase.auth.getClaims();
    if (error) console.error(`[proxy] getClaims en erreur : ${error.name}`);
  } catch (e) {
    console.error(`[proxy] getClaims indisponible : ${e instanceof Error ? e.name : "erreur inconnue"}`);
  }

  const chemin = request.nextUrl.pathname;
  let reponse: NextResponse;

  if (chemin === "/") {
    const langue = choisirLangue(request.cookies.get(NOM_COOKIE_LANGUE)?.value, request.headers.get("accept-language"));
    const cible = request.nextUrl.clone();
    cible.pathname = `/${langue}`;
    reponse = NextResponse.redirect(cible);
    reponse.headers.set("Vary", "Accept-Language, Cookie");
    reponse.headers.set("Cache-Control", "no-store");
  } else if (estCheminLocalise(chemin)) {
    // Fiche inconnue, dépubliée ou d'une autre famille : le statut 404 doit partir avant le flux (coque prérendue). On réécrit vers une
    // adresse que personne ne sert : la route attrape-tout rend la page « introuvable » traduite, avec le statut 404.
    const fiche = analyserAdresseFiche(chemin);
    if (fiche && (await ficheExiste(fiche.famille, fiche.segment)) === "non") {
      const cible = request.nextUrl.clone();
      cible.pathname = `/${fiche.locale}/introuvable`;
      reponse = NextResponse.rewrite(cible, { status: 404 });
    } else {
      reponse = intl(request);
    }
  } else {
    return reponseSession;
  }

  // Reporte les cookies de session rafraîchis sur la réponse de langue.
  reponseSession.cookies.getAll().forEach((cookie) => reponse.cookies.set(cookie));
  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
