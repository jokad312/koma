import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { lireEnvPublique } from "@/lib/env";
import { choisirLangue } from "@/i18n/detection";
import { NOM_COOKIE_LANGUE, routing } from "@/i18n/routing";
import { arriveeParDefaut, roleDuJeton } from "@/lib/auth/arrivee";
import { COOKIE_ACTIVITE, COOKIE_SESSION_EXPIREE, estPageProtegee, evaluerActivite, lireDelaiInactiviteMs } from "@/lib/auth/inactivite";
import { analyserAdresseFiche, ficheExiste } from "@/modules/catalogue/existence";
import { analyserAdresseArticle, articleExiste } from "@/modules/blog/existence";

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
  // aSession reste null quand l'état est inconnu : alors aucune déconnexion et aucun cookie d'activité touché.
  let aSession: boolean | null = null;
  // Revendication koma_role du jeton (crochet Supabase, story 9.12) : aiguillage seulement, jamais une barrière.
  let roleJeton: "admin" | "assistant" | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error) console.error(`[proxy] getClaims en erreur : ${error.name}`);
    else {
      aSession = Boolean(data?.claims);
      roleJeton = roleDuJeton(data?.claims);
    }
  } catch (e) {
    console.error(`[proxy] getClaims indisponible : ${e instanceof Error ? e.name : "erreur inconnue"}`);
  }

  const chemin = request.nextUrl.pathname;
  const optionsCookie = { path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 400 };
  // 400 jours (plafond des navigateurs) : le cookie d'activité ne doit pas disparaître avant la session, sinon elle serait « reposée » au lieu d'expirer.
  let redirectionExpiree: NextResponse | null = null;
  let sessionExpiree = false;

  // Déconnexion après inactivité (story 9.14) : toute requête reçue compte comme activité.
  if (aSession !== null) {
    const maintenant = Date.now();
    const decision = evaluerActivite({
      valeur: request.cookies.get(COOKIE_ACTIVITE)?.value,
      maintenant,
      aSession,
      delaiMs: aSession ? await lireDelaiInactiviteMs(maintenant) : 0,
    });
    if (decision === "poser") reponseSession.cookies.set(COOKIE_ACTIVITE, String(maintenant), { ...optionsCookie, httpOnly: true });
    else if (decision === "supprimer") reponseSession.cookies.set(COOKIE_ACTIVITE, "", { ...optionsCookie, httpOnly: true, maxAge: 0 });
    // Reconnectée : le message d'expiration n'a plus lieu d'être.
    if (aSession && request.cookies.has(COOKIE_SESSION_EXPIREE)) reponseSession.cookies.set(COOKIE_SESSION_EXPIREE, "", { ...optionsCookie, maxAge: 0 });
    if (decision === "expire") {
      sessionExpiree = true;
      try {
        // signOut renvoie son erreur (il ne lève pas toujours) : seul son nom est journalisé.
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) console.error(`[proxy] fermeture de session impossible : ${error.name}`);
      } catch (e) {
        console.error(`[proxy] fermeture de session impossible : ${e instanceof Error ? e.name : "erreur inconnue"}`);
      }
      // Même si la révocation a échoué, les cookies de session sont retirés : la personne continue en visiteur.
      const nomsSession = request.cookies.getAll().map((c) => c.name).filter((n) => n.startsWith("sb-"));
      nomsSession.forEach((name) => request.cookies.delete(name));
      // Réponse recréée après la suppression : la requête transmise au serveur n'a plus les cookies de session (elle n'est plus authentifiée).
      // Les cookies déjà posés sur la réponse sont reportés, puis ceux de session sont effacés chez le navigateur.
      const dejaPoses = reponseSession.cookies.getAll();
      reponseSession = NextResponse.next({ request });
      dejaPoses.forEach((cookie) => reponseSession.cookies.set(cookie));
      for (const name of nomsSession) reponseSession.cookies.set(name, "", { path: "/", maxAge: 0 });
      reponseSession.cookies.set(COOKIE_ACTIVITE, "", { ...optionsCookie, httpOnly: true, maxAge: 0 });
      const langue = routing.locales.find((l) => chemin === `/${l}` || chemin.startsWith(`/${l}/`));
      if (langue && request.method === "GET" && estPageProtegee(chemin.slice(langue.length + 1) || "/")) {
        // Page qui exige un Compte : connexion avec retour à la page quittée et message (le panier n'est pas touché).
        const cible = request.nextUrl.clone();
        cible.pathname = `/${langue}/connexion`;
        cible.search = "";
        cible.searchParams.set("retour", `${chemin}${request.nextUrl.search}`);
        cible.searchParams.set("expiree", "1");
        redirectionExpiree = NextResponse.redirect(cible);
        redirectionExpiree.headers.set("Cache-Control", "no-store");
      } else {
        // Page publique, action ou route hors langue : pas de redirection forcée, le bandeau discret prévient la personne.
        reponseSession.cookies.set(COOKIE_SESSION_EXPIREE, "1", { ...optionsCookie, maxAge: 60 * 60 * 24 });
      }
    }
  }

  // Arrivées selon la connexion (story 9.12, option A du 2026-11-13) : l'accueil public est le même pour tous ; seuls l'admin et l'assistant
  // (revendication koma_role du jeton) sont envoyés à l'admin depuis « / », /fr, /en et /[l]/compte. Aucune lecture en base ici : sans
  // revendication (crochet non activé), aucune redirection. Les pages revérifient les droits côté serveur.
  // Après une expiration de la session, la personne est un visiteur : aucune redirection.
  // « Voir le site » de l'admin (?vue=site) : la personne veut l'accueil public, aucun aiguillage.
  const vueSite = request.nextUrl.searchParams.get("vue") === "site";
  const sessionOuverte = aSession === true && !sessionExpiree;
  if (sessionOuverte && request.method === "GET" && !vueSite) {
    const langueAccueil = routing.locales.find((l) => chemin === `/${l}` || chemin === `/${l}/`);
    const langueCompte = routing.locales.find((l) => chemin === `/${l}/compte` || chemin === `/${l}/compte/`);
    if (roleJeton !== null && (chemin === "/" || langueAccueil || langueCompte)) {
      const langue = langueAccueil ?? langueCompte ?? choisirLangue(request.cookies.get(NOM_COOKIE_LANGUE)?.value, request.headers.get("accept-language"));
      // Nouvelle adresse (pas un clone) : « /fr/ » ne doit pas donner « /fr/compte/ ».
      const cible = new URL(arriveeParDefaut(roleJeton, langue), request.url);
      const versArrivee = NextResponse.redirect(cible);
      versArrivee.headers.set("Vary", "Accept-Language, Cookie");
      versArrivee.headers.set("Cache-Control", "no-store");
      reponseSession.cookies.getAll().forEach((cookie) => versArrivee.cookies.set(cookie));
      return versArrivee;
    }
  }

  if (redirectionExpiree) {
    const redirection = redirectionExpiree;
    reponseSession.cookies.getAll().forEach((cookie) => redirection.cookies.set(cookie));
    return redirection;
  }
  let reponse: NextResponse;

  if (chemin === "/") {
    const langue = choisirLangue(request.cookies.get(NOM_COOKIE_LANGUE)?.value, request.headers.get("accept-language"));
    const cible = request.nextUrl.clone();
    cible.pathname = `/${langue}`;
    reponse = NextResponse.redirect(cible);
    reponse.headers.set("Vary", "Accept-Language, Cookie");
    reponse.headers.set("Cache-Control", "no-store");
  } else if (estCheminLocalise(chemin)) {
    // Fiche ou Article inconnu, dépublié, d'une autre famille, ou sans version anglaise : le statut 404 doit partir avant le flux
    // (coque prérendue). On réécrit vers une adresse que personne ne sert : la route attrape-tout rend la page « introuvable »
    // traduite, avec le statut 404. Une base muette (« incertain ») laisse le chemin normal décider.
    let localeIntrouvable: "fr" | "en" | null = null;
    const article = analyserAdresseArticle(chemin);
    if (article) {
      if ((await articleExiste(article.locale, article.segment)) === "non") localeIntrouvable = article.locale;
    } else {
      const fiche = analyserAdresseFiche(chemin);
      if (fiche && (await ficheExiste(fiche.famille, fiche.segment)) === "non") localeIntrouvable = fiche.locale;
    }
    if (localeIntrouvable) {
      const cible = request.nextUrl.clone();
      cible.pathname = `/${localeIntrouvable}/introuvable`;
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
