import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ageSchema, demandeCodeSchema, verificationCodeSchema } from "@/modules/comptes/schemas";
import { declarerAge, demanderCode, enregistrerQuestionsAccueil, fermerSession, verifierCode } from "@/modules/comptes/service";
import { creerTestDependances, TEST_COMPTE_ID } from "../doubles/TEST_dependances-comptes";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("schémas", () => {
  it("email : nettoyé et validé", () => {
    expect(demandeCodeSchema.safeParse({ email: "  Moi@Example.COM ", langue: "fr" }).data?.email).toBe("moi@example.com");
    expect(demandeCodeSchema.safeParse({ email: "pas-un-email", langue: "fr" }).success).toBe(false);
    expect(demandeCodeSchema.safeParse({ email: "a@b.cd", langue: "de" }).success).toBe(false);
  });
  it("code : six chiffres exactement", () => {
    const base = { email: "a@b.cd", langue: "fr" as const };
    expect(verificationCodeSchema.safeParse({ ...base, code: "123456" }).success).toBe(true);
    for (const code of ["12345", "1234567", "12345a", "", "12 456"]) {
      expect(verificationCodeSchema.safeParse({ ...base, code }).success).toBe(false);
    }
  });
  it("âge : entier de 0 à 120, une saisie vide ne vaut jamais 0", () => {
    expect(ageSchema.safeParse("13").data).toBe(13);
    expect(ageSchema.safeParse(" 120 ").data).toBe(120);
    expect(ageSchema.safeParse("0").data).toBe(0);
    for (const v of ["", " ", "121", "-1", "12.5", "abc", "1e2"]) expect(ageSchema.safeParse(v).success).toBe(false);
  });
});

describe("demanderCode", () => {
  it("envoie le code avec la langue de la route et ne dit ok qu'après la réponse", async () => {
    const { deps, appels } = creerTestDependances();
    const r = await demanderCode(deps, { email: "Moi@Example.com", langue: "en" });
    expect(r).toEqual({ ok: true, email: "moi@example.com" });
    expect(appels.envois).toEqual([
      { email: "moi@example.com", options: { shouldCreateUser: true, data: { langue: "en" } } },
    ]);
  });
  it("email invalide : rien n'est envoyé", async () => {
    const { deps, appels } = creerTestDependances();
    expect(await demanderCode(deps, { email: "x", langue: "fr" })).toEqual({ ok: false, erreur: "email_invalide" });
    expect(appels.envois).toHaveLength(0);
  });
  it("limite d'envoi : message de patience, pas de succès", async () => {
    const { deps } = creerTestDependances({ envoi: { code: "over_email_send_rate_limit", status: 429, name: "AuthApiError" } });
    expect(await demanderCode(deps, { email: "a@b.cd", langue: "fr" })).toEqual({ ok: false, erreur: "limite" });
  });
  it("autre échec : erreur d'envoi, journal sans email", async () => {
    const { deps } = creerTestDependances({ envoi: { status: 500, name: "AuthApiError" } });
    expect(await demanderCode(deps, { email: "secret@example.com", langue: "fr" })).toEqual({ ok: false, erreur: "envoi" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret@example.com");
  });
});

describe("verifierCode", () => {
  const base = { email: "a@b.cd", code: "123456", langue: "fr" as const };

  it("Compte sans âge : étape âge", async () => {
    const { deps } = creerTestDependances({ complet: false });
    expect(await verifierCode(deps, base)).toEqual({ ok: true, etape: "age", retour: "/fr" });
  });
  it("Compte complet, questions vues : retour à la page quittée (validé)", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: true });
    expect(await verifierCode(deps, { ...base, retour: "/fr/cosplays" })).toEqual({ ok: true, etape: "termine", retour: "/fr/cosplays" });
    expect(await verifierCode(deps, { ...base, retour: "https://x.fr" })).toEqual({ ok: true, etape: "termine", retour: "/fr" });
  });
  it("code faux", async () => {
    const { deps } = creerTestDependances({ verification: { code: "otp_expired", status: 403, name: "AuthApiError" } });
    expect(await verifierCode(deps, { ...base, envoyeLe: Date.now() - 60_000 })).toEqual({ ok: false, erreur: "code_faux" });
  });
  it("code expiré : seulement si 10 minutes se sont écoulées depuis l'envoi confirmé", async () => {
    const maintenant = 2_000_000_000_000;
    const { deps } = creerTestDependances({
      verification: { code: "otp_expired", status: 403, name: "AuthApiError" },
      maintenant,
    });
    expect(await verifierCode(deps, { ...base, envoyeLe: maintenant - 10 * 60 * 1000 })).toEqual({ ok: false, erreur: "code_expire" });
    expect(await verifierCode(deps, { ...base, envoyeLe: maintenant - 9 * 60 * 1000 })).toEqual({ ok: false, erreur: "code_faux" });
  });
  it("code mal formé : refusé avant tout appel", async () => {
    const { deps } = creerTestDependances();
    expect(await verifierCode(deps, { ...base, code: "12" })).toEqual({ ok: false, erreur: "code_format" });
    expect(deps.auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("panne de Supabase : erreur générique", async () => {
    const { deps } = creerTestDependances({ verification: { status: 500, name: "AuthRetryableFetchError" } });
    expect(await verifierCode(deps, base)).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("declarerAge", () => {
  it("13 ans et plus : enregistré avec un auteur issu de la session, retour validé", async () => {
    const { deps, appels } = creerTestDependances();
    const r = await declarerAge(deps, { age: "25", langue: "en", retour: "/en/blog" });
    expect(r).toEqual({ ok: true, retour: "/en/blog", etape: "questions" });
    expect(appels.ages).toEqual([
      { auteur: { type: "compte", id: TEST_COMPTE_ID, role: null }, compteId: TEST_COMPTE_ID, age: 25 },
    ]);
    expect(appels.suppressions).toHaveLength(0);
  });
  it("moins de 13 ans : Compte supprimé, session fermée", async () => {
    const { deps, appels } = creerTestDependances({ erreurAge: "KS_AGE_MINIMUM" });
    expect(await declarerAge(deps, { age: "12", langue: "fr" })).toEqual({ ok: false, erreur: "moins_13" });
    expect(appels.suppressions).toEqual([TEST_COMPTE_ID]);
    expect(appels.fermetures).toBe(1);
  });
  it("échec de suppression : erreur affichée, session fermée quand même", async () => {
    const { deps, appels } = creerTestDependances({ erreurAge: "KS_AGE_MINIMUM", suppressionEchoue: true });
    expect(await declarerAge(deps, { age: "5", langue: "fr" })).toEqual({ ok: false, erreur: "suppression_echouee" });
    expect(appels.fermetures).toBe(1);
  });
  it("hors bornes ou non entier : erreur sur le champ, aucun appel", async () => {
    const { deps } = creerTestDependances();
    for (const age of ["", "200", "12.5", "-3"]) {
      expect(await declarerAge(deps, { age, langue: "fr" })).toEqual({ ok: false, erreur: "age_invalide" });
    }
    expect(deps.declarerAge).not.toHaveBeenCalled();
  });
  it("âge déjà déclaré (double envoi) : on poursuit, rien n'est supprimé", async () => {
    const { deps, appels } = creerTestDependances({ erreurAge: "KS_AGE_DEJA_DECLARE" });
    expect(await declarerAge(deps, { age: "5", langue: "fr", retour: "/fr/blog" })).toEqual({ ok: true, retour: "/fr/blog", etape: "questions" });
    expect(appels.suppressions).toHaveLength(0);
    expect(appels.fermetures).toBe(0);
  });
  it("profil absent puis reconnexion : le profil est créé, l'âge est réessayé une fois, le Compte n'est pas supprimé", async () => {
    const { deps, appels } = creerTestDependances({ profilAbsent: true });
    expect(await declarerAge(deps, { age: "24", langue: "en", retour: "/en/blog" })).toEqual({ ok: true, retour: "/en/blog", etape: "questions" });
    expect(appels.ordre.filter((o) => o !== "complet")).toEqual(["age", "profil", "age"]);
    expect(appels.profils).toEqual([{ auteur: { type: "compte", id: TEST_COMPTE_ID, role: null }, compteId: TEST_COMPTE_ID, langue: "en" }]);
    expect(appels.suppressions).toHaveLength(0);
  });
  it("profil toujours introuvable après le filet : erreur générique, jamais « session expirée », cause journalisée", async () => {
    const { deps, appels } = creerTestDependances({ erreurAge: "KS_PROFIL_INTROUVABLE" });
    expect(await declarerAge(deps, { age: "20", langue: "fr" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.ages).toHaveLength(2);
    expect(appels.suppressions).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith("[comptes] déclaration d'âge refusée : KS_PROFIL_INTROUVABLE");
  });
  it("filet refusé : erreur générique avec la vraie cause dans le journal, sans second essai", async () => {
    const { deps, appels } = creerTestDependances({ profilAbsent: true, erreurProfil: "42501" });
    expect(await declarerAge(deps, { age: "20", langue: "fr" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.ages).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith("[comptes] profil non garanti : 42501");
  });
  it("refus inconnu : erreur générique, texte du refus non journalisé", async () => {
    const { deps } = creerTestDependances({ erreurAge: "message avec ana@exemple.org" });
    expect(await declarerAge(deps, { age: "20", langue: "fr" })).toEqual({ ok: false, erreur: "generique" });
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("ana@");
  });
  it("sans session : refusé", async () => {
    const { deps } = creerTestDependances({ sub: null });
    expect(await declarerAge(deps, { age: "20", langue: "fr" })).toEqual({ ok: false, erreur: "non_connecte" });
    expect(deps.declarerAge).not.toHaveBeenCalled();
  });
});

describe("filet du profil à la connexion", () => {
  it("code email : le profil est garanti avant la lecture de l'état du Compte", async () => {
    const { deps, appels } = creerTestDependances({ profilAbsent: true });
    const r = await verifierCode(deps, { email: "test@example.invalid", code: "123456", langue: "fr" });
    expect(r).toMatchObject({ ok: true, etape: "age" });
    expect(appels.ordre).toEqual(["profil", "complet"]);
  });
  it("code email : profil impossible à garantir → erreur générique", async () => {
    const { deps } = creerTestDependances({ erreurProfil: "KS_DROIT_REFUSE" });
    expect(await verifierCode(deps, { email: "test@example.invalid", code: "123456", langue: "fr" })).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("étape après la connexion", () => {
  const base = { email: "a@b.cd", code: "123456", langue: "fr" as const };
  it("Compte complet qui n'a jamais vu les questions : étape « questions »", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: false });
    expect(await verifierCode(deps, { ...base, retour: "/fr/kits" })).toEqual({ ok: true, etape: "questions", retour: "/fr/kits" });
  });
  it("doute sur les questions : on termine, un Compte complet n'est jamais bloqué", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: "erreur" });
    expect(await verifierCode(deps, base)).toMatchObject({ ok: true, etape: "termine" });
    const rejet = creerTestDependances({ complet: true });
    vi.mocked(rejet.deps.questionsVues).mockRejectedValueOnce(new Error("TEST_reseau"));
    expect(await verifierCode(rejet.deps, base)).toMatchObject({ ok: true, etape: "termine" });
  });
  it("âge déclaré, questions déjà vues : termine", async () => {
    const { deps } = creerTestDependances({ questionsVues: true });
    expect(await declarerAge(deps, { age: "25", langue: "fr" })).toEqual({ ok: true, retour: "/fr", etape: "termine" });
  });
});

describe("enregistrerQuestionsAccueil", () => {
  const base = { langue: "fr" as const };
  it("réponses valides : enregistrées avec un auteur issu de la session, retour validé", async () => {
    const { deps, appels } = creerTestDependances();
    const r = await enregistrerQuestionsAccueil(deps, { ...base, origine: "tiktok", preference: "fabriquer", retour: "/fr/kits" });
    expect(r).toEqual({ ok: true, retour: "/fr/kits" });
    expect(appels.questions).toEqual([
      { auteur: { type: "compte", id: TEST_COMPTE_ID, role: null }, compteId: TEST_COMPTE_ID, origine: "tiktok", preference: "fabriquer", univers: null },
    ]);
  });
  it("« Passer » : réponses vides enregistrées comme absentes, retour validé", async () => {
    const { deps, appels } = creerTestDependances();
    expect(await enregistrerQuestionsAccueil(deps, { ...base, origine: "", preference: "", retour: "https://x.fr" })).toEqual({ ok: true, retour: "/fr" });
    expect(appels.questions).toMatchObject([{ origine: null, preference: null }]);
  });
  it("univers : l'identifiant est transmis, vide = absent, valeur qui n'est pas un identifiant refusée", async () => {
    const id = "00000000-0000-4000-8000-0000000000bb";
    const a = creerTestDependances();
    expect(await enregistrerQuestionsAccueil(a.deps, { ...base, univers: id })).toMatchObject({ ok: true });
    expect(a.appels.questions).toMatchObject([{ univers: id }]);
    const b = creerTestDependances();
    expect(await enregistrerQuestionsAccueil(b.deps, { ...base, univers: "" })).toMatchObject({ ok: true });
    expect(b.appels.questions).toMatchObject([{ univers: null }]);
    const c = creerTestDependances();
    expect(await enregistrerQuestionsAccueil(c.deps, { ...base, univers: "pas-un-identifiant" })).toEqual({ ok: false, erreur: "generique" });
    expect(c.appels.questions).toHaveLength(0);
  });
  it("univers périmé (KS_REPONSE_INVALIDE) : nouvel essai sans univers, le visiteur n'est jamais bloqué", async () => {
    const { deps } = creerTestDependances();
    vi.mocked(deps.enregistrerQuestions).mockResolvedValueOnce({ erreur: "KS_REPONSE_INVALIDE" });
    expect(await enregistrerQuestionsAccueil(deps, { ...base, origine: "ami", univers: "00000000-0000-4000-8000-0000000000bb", retour: "/fr/blog" })).toEqual({ ok: true, retour: "/fr/blog" });
    expect(vi.mocked(deps.enregistrerQuestions).mock.calls.map((c) => c[0].univers)).toEqual(["00000000-0000-4000-8000-0000000000bb", null]);
    expect(vi.mocked(deps.enregistrerQuestions).mock.calls[1][0].origine).toBe("ami");
  });
  it("univers inexistant (refus de la base, même sans univers) : erreur générique, rien d'enregistré côté interface", async () => {
    const { deps } = creerTestDependances({ erreurQuestions: "KS_REPONSE_INVALIDE" });
    expect(await enregistrerQuestionsAccueil(deps, { ...base, univers: "00000000-0000-4000-8000-0000000000bb" })).toEqual({ ok: false, erreur: "generique" });
  });
  it("une seule réponse est possible", async () => {
    const { deps, appels } = creerTestDependances();
    expect(await enregistrerQuestionsAccueil(deps, { ...base, preference: "porter" })).toMatchObject({ ok: true });
    expect(appels.questions).toMatchObject([{ origine: null, preference: "porter" }]);
  });
  it("valeur hors liste : refus, rien n'est enregistré", async () => {
    const { deps, appels } = creerTestDependances();
    expect(await enregistrerQuestionsAccueil(deps, { ...base, origine: "radio" })).toEqual({ ok: false, erreur: "generique" });
    expect(await enregistrerQuestionsAccueil(deps, { ...base, preference: "les deux" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.questions).toHaveLength(0);
  });
  it("questions déjà vues (double envoi, second onglet) : succès", async () => {
    const { deps } = creerTestDependances({ erreurQuestions: "KS_QUESTIONS_DEJA_VUES" });
    expect(await enregistrerQuestionsAccueil(deps, { ...base, origine: "ami", retour: "/fr/blog" })).toEqual({ ok: true, retour: "/fr/blog" });
  });
  it("sans session : non_connecte, rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependances({ sub: null });
    expect(await enregistrerQuestionsAccueil(deps, base)).toEqual({ ok: false, erreur: "non_connecte" });
    expect(appels.questions).toHaveLength(0);
  });
  it("profil introuvable ou âge non déclaré : non_connecte ; autre refus : erreur générique sans journaliser de réponse", async () => {
    const a = creerTestDependances({ erreurQuestions: "KS_PROFIL_INTROUVABLE" });
    expect(await enregistrerQuestionsAccueil(a.deps, base)).toEqual({ ok: false, erreur: "non_connecte" });
    const c = creerTestDependances({ erreurQuestions: "KS_AGE_NON_DECLARE" });
    expect(await enregistrerQuestionsAccueil(c.deps, base)).toEqual({ ok: false, erreur: "non_connecte" });
    const b = creerTestDependances({ erreurQuestions: "KS_QUELCONQUE" });
    expect(await enregistrerQuestionsAccueil(b.deps, { ...base, origine: "tiktok" })).toEqual({ ok: false, erreur: "generique" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("tiktok");
  });
});

describe("fermerSession", () => {
  it("ferme la session", async () => {
    const { deps, appels } = creerTestDependances();
    expect(await fermerSession(deps)).toEqual({ ok: true });
    expect(appels.fermetures).toBe(1);
  });
  it("ferme la session de cet appareil seulement (portée locale)", async () => {
    const { deps } = creerTestDependances();
    await fermerSession(deps);
    expect(deps.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("session déjà absente ou expirée : succès", async () => {
    for (const erreur of [{ name: "AuthSessionMissingError" }, { code: "session_not_found", status: 403, name: "AuthApiError" }]) {
      const { deps } = creerTestDependances();
      vi.mocked(deps.auth.signOut).mockResolvedValueOnce({ error: erreur });
      expect(await fermerSession(deps)).toEqual({ ok: true });
    }
  });
  it("signale un échec", async () => {
    const { deps } = creerTestDependances();
    vi.mocked(deps.auth.signOut).mockResolvedValueOnce({ error: { name: "AuthApiError", status: 500 } });
    expect(await fermerSession(deps)).toEqual({ ok: false });
  });
});
