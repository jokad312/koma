import { describe, expect, it, vi } from "vitest";
import { demarrerTentative, masquerTelephone, MAXIMUM_TENTATIVES, type DependancesTentative } from "@/modules/paiement/tentative";
import { proposerRepli } from "@/modules/paiement/service";
import type { EtatPaiement } from "@/modules/paiement/etat";
import type { Achat, CodePrestataire, Couverture, Prestataire } from "@/modules/paiement/types";
import { creerPrestataireTest } from "../doubles/TEST_prestataire";

const NUMERO = "KS-2026-000042";
const COUVERTURE: Couverture = [
  { prestataire: "pawapay", pays: "TZ", operateur: "TEST_op" },
  { prestataire: "maishapay", pays: "TZ", operateur: "TEST_op" },
  { prestataire: "maishapay", pays: "TZ", operateur: "TEST_op" },
];

function p(code: CodePrestataire, s: Partial<Prestataire> = {}): Prestataire {
  const base: Record<CodePrestataire, Prestataire> = {
    pawapay: { code: "pawapay", nom: "TEST_PawaPay", type: "agregateur", mobileMoney: true, carte: false, actif: true, ordre: 1 },
    maishapay: { code: "maishapay", nom: "TEST_MaishaPay", type: "agregateur", mobileMoney: true, carte: true, actif: true, ordre: 2 },
    polar: { code: "polar", nom: "TEST_Polar", type: "carte", mobileMoney: false, carte: true, actif: true, ordre: null },
  };
  return { ...base[code], ...s };
}
const TOUS = (["pawapay", "maishapay", "polar"] as const).map((c) => p(c));

function deps(s: Partial<DependancesTentative> = {}, adaptateurs: Partial<Record<CodePrestataire, ReturnType<typeof creerPrestataireTest>>> = {}): DependancesTentative {
  const physique: Achat = { familles: ["cosplay"], estPass: false };
  return {
    compteId: vi.fn(async () => "TEST_compte"),
    limiter: vi.fn(async () => true),
    commande: vi.fn(async () => ({ id: "TEST_commande", achat: physique, contact: { email: "TEST@example.invalid", nom: null } })),
    prestataires: vi.fn(async () => TOUS),
    couverture: vi.fn(async () => COUVERTURE),
    exclus: vi.fn(async () => []),
    adaptateursBranches: new Set<CodePrestataire>(["pawapay", "maishapay", "polar"]),
    adaptateur: vi.fn((code: CodePrestataire) => adaptateurs[code] ?? null),
    demarrer: vi.fn(async () => ({ tentativeId: "TEST_tentative", montantAttenduCents: 1500 })),
    enregistrerInitiation: vi.fn(async () => ({ erreur: null })),
    echouer: vi.fn(async () => undefined),
    referenceInterne: vi.fn(() => "TEST-REF-INTERNE-0001"),
    adresseRetour: vi.fn((code, numero) => `https://TEST.invalid/retour/${code}?numero=${numero}`),
    adresseNotification: vi.fn((code) => `https://TEST.invalid/notification/${code}`),
    ...s,
  };
}

const MM = { numero: NUMERO, moyen: "mobile_money", pays: "tz", operateur: "TEST_op", telephone: "+255 712 345 678" };

describe("masquerTelephone", () => {
  it("garde l'indicatif et les trois derniers chiffres", () => {
    expect(masquerTelephone("+255712345678")).toBe("+255••••••678");
  });
  it("ne révèle jamais le numéro en clair", () => {
    expect(masquerTelephone("+255712345678")).not.toContain("712345");
  });
});

describe("demarrerTentative : mobile money", () => {
  it("le serveur choisit le premier Agrégateur de l'ordre qui couvre le couple, démarre la Tentative et appelle SON adaptateur", async () => {
    const pawapay = creerPrestataireTest({ code: "pawapay" });
    const maishapay = creerPrestataireTest({ code: "maishapay" });
    const d = deps({}, { pawapay, maishapay });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: true, redirection: null });
    expect(d.demarrer).toHaveBeenCalledWith({
      compteId: "TEST_compte",
      numero: NUMERO,
      prestataire: "pawapay",
      moyen: "mobile_money",
      pays: "TZ",
      operateur: "TEST_op",
      referenceInterne: "TEST-REF-INTERNE-0001",
      telephoneMasque: "+255••••••678",
    });
    expect(pawapay.appels).toHaveLength(1);
    expect(maishapay.appels).toHaveLength(0);
    expect(pawapay.appels[0]).toMatchObject({ montantAttenduCents: 1500, pays: "TZ", contact: { telephone: "+255712345678" } });
  });
  it("le numéro en clair n'est jamais transmis à la base : seulement sa forme masquée", async () => {
    const d = deps({}, { pawapay: creerPrestataireTest({ code: "pawapay" }) });
    await demarrerTentative(d, MM);
    expect(JSON.stringify((d.demarrer as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("712345678");
  });
  it("repli : un Agrégateur exclu (échec confirmé côté Prestataire) n'est pas rappelé, le suivant du même couple l'est", async () => {
    const maishapay = creerPrestataireTest({ code: "maishapay" });
    const d = deps({ exclus: vi.fn(async () => ["pawapay" as const]) }, { pawapay: creerPrestataireTest({ code: "pawapay" }), maishapay });
    await demarrerTentative(d, MM);
    expect(maishapay.appels).toHaveLength(1);
    expect((d.demarrer as ReturnType<typeof vi.fn>).mock.calls[0][0].prestataire).toBe("maishapay");
  });
  it("une Famille ou un Prestataire envoyé par le navigateur est ignoré : seul le choix (moyen, pays, opérateur, numéro) compte", async () => {
    const d = deps({}, { pawapay: creerPrestataireTest({ code: "pawapay" }), polar: creerPrestataireTest({ code: "polar" }) });
    await demarrerTentative(d, { ...MM, prestataire: "polar", familles: ["kit"], montant: 1 });
    expect((d.demarrer as ReturnType<typeof vi.fn>).mock.calls[0][0].prestataire).toBe("pawapay");
  });
  it("numéro invalide : refusé avant tout appel", async () => {
    const d = deps();
    for (const telephone of ["", "712345678", "+12", "+abc", "+255 (0)7"]) {
      await expect(demarrerTentative(d, { ...MM, telephone })).resolves.toEqual({ ok: false, erreur: "telephone_invalide" });
    }
    expect(d.demarrer).not.toHaveBeenCalled();
  });
  it("pays ou opérateur absent : refusé", async () => {
    const d = deps();
    await expect(demarrerTentative(d, { ...MM, pays: null })).resolves.toEqual({ ok: false, erreur: "pays_operateur_requis" });
    await expect(demarrerTentative(d, { ...MM, operateur: null })).resolves.toEqual({ ok: false, erreur: "pays_operateur_requis" });
  });
  it("couple qu'aucun Agrégateur actif ne couvre : indisponible, aucun Prestataire inventé, rien n'est démarré", async () => {
    const d = deps({}, { pawapay: creerPrestataireTest({ code: "pawapay" }) });
    await expect(demarrerTentative(d, { ...MM, operateur: "TEST_inconnu" })).resolves.toEqual({ ok: false, erreur: "indisponible" });
    expect(d.demarrer).not.toHaveBeenCalled();
  });
  it("Agrégateur actif sans adaptateur branché : jamais proposé", async () => {
    const d = deps({ adaptateursBranches: new Set<CodePrestataire>() });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "indisponible" });
    expect(d.demarrer).not.toHaveBeenCalled();
  });
});

describe("demarrerTentative : carte (règle 10)", () => {
  const carte = { numero: NUMERO, moyen: "carte" };
  it("panier avec un Produit physique : MaishaPay, la redirection du Prestataire est renvoyée", async () => {
    const maishapay = creerPrestataireTest({ code: "maishapay", initiation: { statut: "initie", referenceTransaction: "TEST-TX-9", redirection: "https://TEST.invalid/payer" } });
    const d = deps({}, { maishapay, polar: creerPrestataireTest({ code: "polar" }) });
    await expect(demarrerTentative(d, { ...carte, reseauCarte: "VISA", nomPayeur: "Test Payeur", telephone: "+243990000000" })).resolves.toEqual({ ok: true, redirection: "https://TEST.invalid/payer" });
    expect(d.enregistrerInitiation).toHaveBeenCalledWith("TEST_tentative", "TEST-TX-9");
    expect((d.demarrer as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ prestataire: "maishapay", moyen: "carte", pays: null, operateur: null, telephoneMasque: "+243••••••000" });
  });
  it("carte MaishaPay : réseau, nom et téléphone du payeur validés côté serveur puis transmis ; le téléphone n'est gardé que masqué", async () => {
    const maishapay = creerPrestataireTest({ code: "maishapay", initiation: { statut: "initie", referenceTransaction: "TEST-TX-9", redirection: "https://TEST.invalid/payer" } });
    const d = deps({}, { maishapay });
    const saisie = { ...carte, reseauCarte: "mastercard", nomPayeur: "  Test   Payeur ", telephone: "+243 990 000 000" };
    await expect(demarrerTentative(d, saisie)).resolves.toEqual({ ok: true, redirection: "https://TEST.invalid/payer" });
    expect(maishapay.appels[0]).toMatchObject({ reseauCarte: "MASTERCARD", contact: { nom: "Test Payeur", telephone: "+243990000000" } });
    expect((d.demarrer as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ telephoneMasque: "+243••••••000" });
  });
  it("carte MaishaPay : réseau, nom ou téléphone invalides refusés avant toute Tentative", async () => {
    const ok = { ...carte, reseauCarte: "VISA", nomPayeur: "Test Payeur", telephone: "+243990000000" };
    const cas: Array<[Record<string, unknown>, string]> = [
      [{ reseauCarte: "AMEX" }, "reseau_carte_invalide"],
      [{ reseauCarte: null }, "reseau_carte_invalide"],
      [{ nomPayeur: "A" }, "nom_payeur_invalide"],
      [{ nomPayeur: "<script>" }, "nom_payeur_invalide"],
      [{ nomPayeur: "x".repeat(101) }, "nom_payeur_invalide"],
      [{ telephone: "0990000000" }, "telephone_invalide"],
    ];
    for (const [modif, erreur] of cas) {
      const maishapay = creerPrestataireTest({ code: "maishapay" });
      const d = deps({}, { maishapay });
      await expect(demarrerTentative(d, { ...ok, ...modif })).resolves.toEqual({ ok: false, erreur });
      expect(d.demarrer).not.toHaveBeenCalled();
      expect(maishapay.appels).toHaveLength(0);
    }
  });
  it("carte Polar (panier 100 % Kits) : aucune donnée d'identité n'est demandée ni transmise", async () => {
    const polar = creerPrestataireTest({ code: "polar" });
    const d = deps({ commande: vi.fn(async () => ({ id: "c", achat: { familles: ["kit" as const], estPass: false }, contact: { email: null, nom: null } })) }, { polar, maishapay: creerPrestataireTest({ code: "maishapay" }) });
    await demarrerTentative(d, { ...carte, reseauCarte: "VISA", nomPayeur: "Test Payeur", telephone: "+243990000000" });
    expect(polar.appels[0]).toMatchObject({ reseauCarte: null, contact: { telephone: null } });
  });
  it("panier mixte ou Pass : jamais Polar", async () => {
    const polar = creerPrestataireTest({ code: "polar" });
    for (const achat of [{ familles: ["cosplay", "kit"] as const, estPass: false }, { familles: [] as const, estPass: true }]) {
      const d = deps({ commande: vi.fn(async () => ({ id: "c", achat, contact: { email: null, nom: null } })) }, { polar });
      await expect(demarrerTentative(d, carte)).resolves.toEqual({ ok: false, erreur: "indisponible" });
    }
    expect(polar.appels).toHaveLength(0);
  });
  it("panier 100 % Kits : Polar", async () => {
    const polar = creerPrestataireTest({ code: "polar" });
    const d = deps({ commande: vi.fn(async () => ({ id: "c", achat: { familles: ["kit" as const], estPass: false }, contact: { email: null, nom: null } })) }, { polar, maishapay: creerPrestataireTest({ code: "maishapay" }) });
    await demarrerTentative(d, carte);
    expect(polar.appels).toHaveLength(1);
  });
});

describe("demarrerTentative : garde-fous", () => {
  it("non connecté : rien n'est lu", async () => {
    const d = deps({ compteId: vi.fn(async () => null) });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "non_connecte" });
    expect(d.limiter).not.toHaveBeenCalled();
  });
  it("limite d'essais (AD-22) : au-delà du maximum, refusé avant tout travail", async () => {
    const d = deps({ limiter: vi.fn(async () => false) });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "limite" });
    expect(d.limiter).toHaveBeenCalledWith("tentative:TEST_compte", 600, MAXIMUM_TENTATIVES);
    expect(d.commande).not.toHaveBeenCalled();
  });
  it("Commande d'un autre Compte : introuvable", async () => {
    const d = deps({ commande: vi.fn(async () => null) });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "commande_introuvable" });
  });
  it("entrée mal formée (numéro, moyen) : refusée", async () => {
    const d = deps();
    await expect(demarrerTentative(d, { numero: "x", moyen: "carte" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    await expect(demarrerTentative(d, { numero: NUMERO, moyen: "cheque" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("une seule Tentative en cours par Commande : le refus de la base est traduit", async () => {
    const d = deps({ demarrer: vi.fn(async () => ({ erreur: "KS_TENTATIVE_EN_COURS" })) }, { pawapay: creerPrestataireTest({ code: "pawapay" }) });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "tentative_en_cours" });
  });
  it("Commande expirée ou déjà payée : non payable, le Prestataire n'est pas appelé", async () => {
    const pawapay = creerPrestataireTest({ code: "pawapay" });
    const d = deps({ demarrer: vi.fn(async () => ({ erreur: "KS_COMMANDE_NON_PAYABLE" })) }, { pawapay });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "non_payable" });
    expect(pawapay.appels).toHaveLength(0);
  });
});

describe("demarrerTentative : réponse du Prestataire", () => {
  it("refus confirmé : la Tentative échoue avec sa cause", async () => {
    const pawapay = creerPrestataireTest({ code: "pawapay", initiation: { statut: "refuse", cause: "prestataire" } });
    const d = deps({}, { pawapay });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "refuse" });
    expect(d.echouer).toHaveBeenCalledWith("TEST_tentative", "prestataire");
  });
  it("délai ou coupure de l'appel : ce n'est PAS un échec — la Tentative reste en cours, aucun repli", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pawapay = creerPrestataireTest({ code: "pawapay", initiation: new Error("TEST_delai") });
    const d = deps({}, { pawapay });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: true, redirection: null });
    expect(d.echouer).not.toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_delai");
    spy.mockRestore();
  });
  it("référence de transaction déjà utilisée : refusée, la Tentative échoue côté Prestataire", async () => {
    const pawapay = creerPrestataireTest({ code: "pawapay", initiation: { statut: "initie", referenceTransaction: "TEST-TX-DEJA", redirection: null } });
    const d = deps({ enregistrerInitiation: vi.fn(async () => ({ erreur: "KS_REFERENCE_DEJA_UTILISEE" })) }, { pawapay });
    await expect(demarrerTentative(d, MM)).resolves.toEqual({ ok: false, erreur: "generique" });
    expect(d.echouer).toHaveBeenCalledWith("TEST_tentative", "prestataire");
  });
});

function etat(s: Partial<EtatPaiement> = {}): EtatPaiement {
  return {
    phase: "echec",
    statut: "echouee",
    kit: false,
    attenteDepuisSecondes: null,
    causeEchec: "prestataire",
    tropPercu: null,
    montantCents: 1500,
    expireLe: null,
    attente: null,
    echec: { moyen: "mobile_money", prestataire: "pawapay", pays: "TZ", operateur: "TEST_op" },
    exclus: ["pawapay"],
    repli: null,
    ...s,
  };
}
const BRANCHES = new Set<CodePrestataire>(["pawapay", "maishapay", "polar"]);

describe("proposerRepli (story 5.3)", () => {
  it("échec confirmé côté Prestataire : l'Agrégateur suivant du même couple est proposé", () => {
    expect(proposerRepli(etat(), TOUS, COUVERTURE, BRANCHES)).toEqual({ type: "suivant", code: "maishapay", nom: "TEST_MaishaPay" });
  });
  it("tous les Agrégateurs du couple en échec ou désactivés : « aucun »", () => {
    expect(proposerRepli(etat({ exclus: ["pawapay", "maishapay"] }), TOUS, COUVERTURE, BRANCHES)).toEqual({ type: "aucun" });
    expect(proposerRepli(etat(), TOUS.map((x) => ({ ...x, actif: x.code === "pawapay" })), COUVERTURE, BRANCHES)).toEqual({ type: "aucun" });
  });
  it("un échec côté client ne bascule jamais (E-27)", () => {
    expect(proposerRepli(etat({ causeEchec: "client" }), TOUS, COUVERTURE, BRANCHES)).toBeNull();
  });
  it("pas de repli sans échec, ni pour une carte", () => {
    expect(proposerRepli(etat({ phase: "attente" }), TOUS, COUVERTURE, BRANCHES)).toBeNull();
    expect(proposerRepli(etat({ echec: { moyen: "carte", prestataire: "maishapay", pays: null, operateur: null } }), TOUS, COUVERTURE, BRANCHES)).toBeNull();
  });
  it("un opérateur couvert seulement par l'Agrégateur en échec : « aucun »", () => {
    const seul: Couverture = [{ prestataire: "pawapay", pays: "TZ", operateur: "TEST_op" }];
    expect(proposerRepli(etat(), TOUS, seul, BRANCHES)).toEqual({ type: "aucun" });
  });
});
