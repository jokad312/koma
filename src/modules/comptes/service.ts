import { construireAuteur } from "@/lib/auth/auteur";
import { cheminRetourValide } from "@/lib/auth/retour";
import { demandeCodeSchema, DUREE_CODE_MS, declarationAgeSchema, verificationCodeSchema } from "./schemas";
import type { DemandeCode, DeclarationAge, VerificationCode } from "./schemas";
import type { DependancesComptes, EtapeApresCode, Resultat } from "./types";

// Seul le nom de l'erreur est journalisé : ni message, ni email, ni jeton.
function journaliser(contexte: string, erreur: unknown) {
  const nom = erreur && typeof erreur === "object" && "name" in erreur ? String((erreur as { name: unknown }).name) : "erreur";
  console.error(`[comptes] ${contexte} : ${nom}`);
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
    const etat = await deps.compteComplet(compteId);
    if ("erreur" in etat) return { ok: false, erreur: "generique" };
    const retour = cheminRetourValide(lu.data.retour, lu.data.langue);
    return { ok: true, etape: etat.complet ? "termine" : "age", retour };
  } catch (e) {
    journaliser("vérification du code", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function declarerAge(deps: DependancesComptes, entree: DeclarationAge): Promise<Resultat<{ retour: string }>> {
  const lu = declarationAgeSchema.safeParse(entree);
  if (!lu.success) {
    const champAge = lu.error.issues.some((i) => i.path[0] === "age");
    return { ok: false, erreur: champAge ? "age_invalide" : "generique" };
  }
  try {
    const { data, error: erreurSession } = await deps.auth.getClaims();
    const compteId = data?.claims?.sub;
    if (erreurSession || !compteId) return { ok: false, erreur: "non_connecte" };

    const { erreur } = await deps.declarerAge({ auteur: construireAuteur(compteId), compteId, age: lu.data.age });
    if (!erreur) return { ok: true, retour: cheminRetourValide(lu.data.retour, lu.data.langue) };

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
    if (erreur.includes("KS_AGE_DEJA_DECLARE")) return { ok: true, retour: cheminRetourValide(lu.data.retour, lu.data.langue) };
    if (erreur.includes("KS_PROFIL_INTROUVABLE")) return { ok: false, erreur: "non_connecte" };
    if (erreur.includes("KS_AGE_INVALIDE")) return { ok: false, erreur: "age_invalide" };
    console.error("[comptes] déclaration d'âge refusée");
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
