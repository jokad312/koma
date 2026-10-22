import { construireAuteur } from "@/lib/auth/auteur";
import { cheminRetourValide } from "@/lib/auth/retour";
import { detecterNavigateurIntegre } from "@/lib/navigateur-integre";
import { demandeCodeSchema, demandeGoogleSchema, DUREE_CODE_MS, declarationAgeSchema, questionsAccueilSchema, verificationCodeSchema } from "./schemas";
import type { DemandeCode, DemandeGoogle, DeclarationAge, QuestionsAccueil, VerificationCode } from "./schemas";
import type { DependancesComptes, EtapeApresCode, Langue, Resultat } from "./types";

// Seul le nom de l'erreur est journalisé : ni message, ni email, ni jeton.
function journaliser(contexte: string, erreur: unknown) {
  const lire = (cle: string) => (erreur && typeof erreur === "object" && cle in erreur ? (erreur as Record<string, unknown>)[cle] : undefined);
  const nom = lire("name") !== undefined ? String(lire("name")) : "erreur";
  // Code et statut de l'erreur Auth (ex. over_email_send_rate_limit, 429) aident au diagnostic ; jamais le message.
  const code = typeof lire("code") === "string" ? ` code=${lire("code")}` : "";
  const statut = typeof lire("status") === "number" ? ` statut=${lire("status")}` : "";
  console.error(`[comptes] ${contexte} : ${nom}${code}${statut}`);
}

// Garantit la ligne profil du Compte avant toute lecture de son état (filet : le déclencheur peut avoir manqué).
// Un échec est journalisé avec sa cause (code KS_ ou SQL, sans donnée personnelle) et renvoyé tel quel.
async function garantirProfil(deps: DependancesComptes, compteId: string, langue: Langue): Promise<string | null> {
  const { erreur } = await deps.assurerProfil({ auteur: construireAuteur(compteId), compteId, langue });
  if (erreur) console.error(`[comptes] profil non garanti : ${erreur}`);
  return erreur;
}

const CODES_LIMITE = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

// Envoie un code : le résultat ne dit « ok » qu'après la réponse réelle de Supabase (règle 13).
export async function demanderCode(deps: DependancesComptes, entree: DemandeCode): Promise<Resultat<{ email: string }>> {
  const lu = demandeCodeSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "email_invalide" };
  try {
    const { error } = await deps.auth.signInWithOtp({
      email: lu.data.email,
      options: { shouldCreateUser: true, data: { langue: lu.data.langue } },
    });
    if (error) {
      journaliser("envoi du code", error);
      if (error.status === 429 || (error.code && CODES_LIMITE.has(error.code))) return { ok: false, erreur: "limite" };
      if (error.code === "email_address_invalid" || error.code === "validation_failed") return { ok: false, erreur: "email_invalide" };
      return { ok: false, erreur: "envoi" };
    }
    return { ok: true, email: lu.data.email };
  } catch (e) {
    journaliser("envoi du code", e);
    return { ok: false, erreur: "envoi" };
  }
}

// Étape suivant la connexion d'un Compte : l'âge d'abord, puis les questions d'accueil si elles n'ont jamais été vues.
// Un doute sur les questions ne bloque jamais : on termine (elles sont facultatives).
async function etapeApresConnexion(deps: DependancesComptes, compteId: string, complet: boolean): Promise<EtapeApresCode> {
  if (!complet) return "age";
  const etat = await deps.questionsVues(compteId).catch((e) => {
    journaliser("lecture des questions d'accueil", e);
    return { erreur: true as const };
  });
  return "erreur" in etat || etat.vues ? "termine" : "questions";
}

type SuiteCode = { etape: EtapeApresCode; retour: string };

export async function verifierCode(deps: DependancesComptes, entree: VerificationCode): Promise<Resultat<SuiteCode>> {
  const lu = verificationCodeSchema.safeParse(entree);
  if (!lu.success) {
    const champCode = lu.error.issues.some((i) => i.path[0] === "code");
    return { ok: false, erreur: champCode ? "code_format" : "email_invalide" };
  }
  try {
    const { data, error } = await deps.auth.verifyOtp({ email: lu.data.email, token: lu.data.code, type: "email" });
    if (error) {
      journaliser("vérification du code", error);
      if (error.status === 429) return { ok: false, erreur: "limite" };
      const refus = error.code === "otp_expired" || error.code === "validation_failed" || error.status === 403 || error.status === 422;
      if (!refus) return { ok: false, erreur: "generique" };
      // Supabase répond pareil à un code faux et à un code expiré : on ne dit « expiré » que si les 10 minutes
      // sont réellement écoulées depuis l'envoi confirmé.
      const expire = lu.data.envoyeLe !== undefined && deps.maintenant() - lu.data.envoyeLe >= DUREE_CODE_MS;
      return { ok: false, erreur: expire ? "code_expire" : "code_faux" };
    }
    const compteId = data.user?.id ?? data.session?.user.id;
    if (!compteId) return { ok: false, erreur: "generique" };
    if (await garantirProfil(deps, compteId, lu.data.langue)) return { ok: false, erreur: "generique" };
    const etat = await deps.compteComplet(compteId);
    if ("erreur" in etat) return { ok: false, erreur: "generique" };
    const retour = cheminRetourValide(lu.data.retour, lu.data.langue);
    return { ok: true, etape: await etapeApresConnexion(deps, compteId, etat.complet), retour };
  } catch (e) {
    journaliser("vérification du code", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function declarerAge(deps: DependancesComptes, entree: DeclarationAge): Promise<Resultat<{ retour: string; etape: EtapeApresCode }>> {
  const lu = declarationAgeSchema.safeParse(entree);
  if (!lu.success) {
    const champAge = lu.error.issues.some((i) => i.path[0] === "age");
    return { ok: false, erreur: champAge ? "age_invalide" : "generique" };
  }
  try {
    const { data, error: erreurSession } = await deps.auth.getClaims();
    const compteId = data?.claims?.sub;
    if (erreurSession || !compteId) return { ok: false, erreur: "non_connecte" };

    const demande = { auteur: construireAuteur(compteId), compteId, age: lu.data.age };
    let { erreur } = await deps.declarerAge(demande);
    if (erreur?.includes("KS_PROFIL_INTROUVABLE")) {
      // La session est valide mais la ligne profil manque : on la crée une fois, puis on réessaie une fois.
      if (await garantirProfil(deps, compteId, lu.data.langue)) return { ok: false, erreur: "generique" };
      ({ erreur } = await deps.declarerAge(demande));
    }
    if (!erreur) return { ok: true, retour: cheminRetourValide(lu.data.retour, lu.data.langue), etape: await etapeApresConnexion(deps, compteId, true) };

    if (erreur.includes("KS_AGE_MINIMUM")) {
      // Moins de 13 ans : le Compte est supprimé (profil en cascade) et la session fermée ; rien n'est conservé.
      const suppression = await deps.supprimerCompte(compteId);
      try {
        await deps.auth.signOut({ scope: "local" });
      } catch (e) {
        journaliser("fermeture de session", e);
      }
      if (suppression.erreur) {
        console.error("[comptes] suppression d'un Compte de moins de 13 ans impossible");
        return { ok: false, erreur: "suppression_echouee" };
      }
      return { ok: false, erreur: "moins_13" };
    }
    // Double envoi ou second onglet : l'âge est déjà déclaré, on poursuit ; jamais de suppression.
    if (erreur.includes("KS_AGE_DEJA_DECLARE")) return { ok: true, retour: cheminRetourValide(lu.data.retour, lu.data.langue), etape: await etapeApresConnexion(deps, compteId, true) };
    if (erreur.includes("KS_AGE_INVALIDE")) return { ok: false, erreur: "age_invalide" };
    // Seule la cause (code KS_) est journalisée, jamais l'âge ni l'identité.
    console.error(`[comptes] déclaration d'âge refusée : ${/^KS_[A-Z_]+$/.test(erreur) ? erreur : "inconnue"}`);
    return { ok: false, erreur: "generique" };
  } catch (e) {
    journaliser("déclaration d'âge", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function fermerSession(deps: DependancesComptes): Promise<{ ok: boolean }> {
  try {
    // Session de cet appareil seulement ; une session déjà absente ou expirée vaut succès.
    const { error } = await deps.auth.signOut({ scope: "local" });
    const absente = error?.name === "AuthSessionMissingError" || error?.code === "session_not_found" || error?.status === 401 || error?.status === 403 || error?.status === 404;
    if (error && !absente) {
      journaliser("déconnexion", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    journaliser("déconnexion", e);
    return { ok: false };
  }
}

const REDIRECTION_GOOGLE = "/auth/callback";

// Départ vers Google : refusé dans un navigateur intégré (Google y bloque la connexion). L'adresse de Google est celle que
// Supabase renvoie, jamais bâtie ici. La langue et le retour (validé) sont renvoyés pour être gardés le temps de la visite.
export async function demarrerGoogle(
  deps: DependancesComptes,
  entree: DemandeGoogle,
  contexte: { agent: string | null; adresseSite: string },
): Promise<Resultat<{ url: string; langue: Langue; retour: string }>> {
  if (detecterNavigateurIntegre(contexte.agent).integre) return { ok: false, erreur: "navigateur_integre" };
  const lu = demandeGoogleSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "generique" };
  try {
    const { data, error } = await deps.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${contexte.adresseSite}${REDIRECTION_GOOGLE}`, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      if (error) journaliser("départ Google", error);
      return { ok: false, erreur: "google" };
    }
    return { ok: true, url: data.url, langue: lu.data.langue, retour: cheminRetourValide(lu.data.retour, lu.data.langue) };
  } catch (e) {
    journaliser("départ Google", e);
    return { ok: false, erreur: "google" };
  }
}

// Retour de Google : échange du code contre la session, langue de la route sur le profil, étape suivante.
export async function terminerGoogle(
  deps: DependancesComptes,
  entree: { code: string | null; langue: Langue; retour: string },
): Promise<Resultat<{ etape: EtapeApresCode; retour: string }>> {
  if (!entree.code) return { ok: false, erreur: "google" };
  try {
    const { data, error } = await deps.auth.exchangeCodeForSession(entree.code);
    if (error) {
      journaliser("retour Google", error);
      return { ok: false, erreur: "google" };
    }
    const compteId = data?.user?.id ?? data?.session?.user.id;
    if (!compteId) return { ok: false, erreur: "google" };
    if (await garantirProfil(deps, compteId, entree.langue)) return { ok: false, erreur: "generique" };
    const etat = await deps.compteComplet(compteId);
    if ("erreur" in etat) return { ok: false, erreur: "generique" };
    if (!etat.complet) {
      // Nouveau Compte : sa langue est celle de la route (sans effet une fois l'âge déclaré). Un échec ne bloque pas la connexion.
      const { erreur } = await deps.definirLangue({ auteur: construireAuteur(compteId), compteId, langue: entree.langue });
      if (erreur) console.error("[comptes] langue du profil non définie");
    }
    return { ok: true, etape: await etapeApresConnexion(deps, compteId, etat.complet), retour: entree.retour };
  } catch (e) {
    journaliser("retour Google", e);
    return { ok: false, erreur: "generique" };
  }
}

// Questions d'accueil (toutes facultatives). « Passer » envoie un formulaire vide : les questions sont alors marquées comme vues.
// Les questions déjà vues valent succès (double envoi, second onglet) : rien n'est modifié et rien ne bloque.
export async function enregistrerQuestionsAccueil(deps: DependancesComptes, entree: QuestionsAccueil): Promise<Resultat<{ retour: string }>> {
  const lu = questionsAccueilSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "generique" };
  try {
    const { data, error: erreurSession } = await deps.auth.getClaims();
    const compteId = data?.claims?.sub;
    if (erreurSession || !compteId) return { ok: false, erreur: "non_connecte" };

    const { erreur } = await deps.enregistrerQuestions({
      auteur: construireAuteur(compteId),
      compteId,
      origine: lu.data.origine ?? null,
      preference: lu.data.preference ?? null,
    });
    if (!erreur || erreur.includes("KS_QUESTIONS_DEJA_VUES")) return { ok: true, retour: cheminRetourValide(lu.data.retour, lu.data.langue) };
    if (erreur.includes("KS_PROFIL_INTROUVABLE") || erreur.includes("KS_AGE_NON_DECLARE")) return { ok: false, erreur: "non_connecte" };
    console.error("[comptes] questions d'accueil refusées");
    return { ok: false, erreur: "generique" };
  } catch (e) {
    journaliser("questions d'accueil", e);
    return { ok: false, erreur: "generique" };
  }
}
