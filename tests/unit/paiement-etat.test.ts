import { describe, expect, it } from "vitest";
import { adresseRetourPrestataire, deriverEtat, DELAI_VERIFICATION_SECONDES, INTERVALLE_SONDAGE_MS } from "@/modules/paiement/etat";

const MAINTENANT = Date.parse("2026-11-02T12:00:00Z");
const FUTUR = "2026-11-02T13:00:00Z";
const PASSE = "2026-11-02T11:00:00Z";

function brut(s: Record<string, unknown> = {}) {
  return { statut: "en_attente", expire_le: FUTUR, total_cents: 1500, kit: false, tentative_en_cours: null, derniere_echec: null, exclus: [], trop_percu: null, ...s };
}

describe("deriverEtat : phases", () => {
  it("en attente sans Tentative : choix du moyen de paiement", () => {
    expect(deriverEtat(brut(), MAINTENANT)).toMatchObject({ phase: "a_payer", attenteDepuisSecondes: null });
  });
  it("Tentative en cours : attente, avec son ancienneté, jamais un choix (retour arrière, rechargement, autre onglet)", () => {
    const e = deriverEtat(brut({ tentative_en_cours: { moyen: "carte", age_secondes: 42, prestataire: "TEST_K-Pay", telephone_masque: null } }), MAINTENANT);
    expect(e).toMatchObject({ phase: "attente", attenteDepuisSecondes: 42 });
  });
  it("Commande échouée mais nouvelle Tentative en cours : attente", () => {
    expect(deriverEtat(brut({ statut: "echouee", tentative_en_cours: { moyen: "mobile_money", age_secondes: 3, prestataire: "TEST_PawaPay", telephone_masque: "+243•••••678" } }), MAINTENANT)?.phase).toBe("attente");
  });
  it("« payee » seulement avec un statut payé en base (payee, en_fabrication, expediee, livree)", () => {
    for (const statut of ["payee", "en_fabrication", "expediee", "livree"]) expect(deriverEtat(brut({ statut }), MAINTENANT)?.phase).toBe("payee");
  });
  it("une Commande offerte, annulée ou remboursée n'est jamais « payée »", () => {
    for (const statut of ["offerte", "annulee", "remboursee"]) expect(deriverEtat(brut({ statut }), MAINTENANT)?.phase).toBe("autre");
  });
  it("échec confirmé : phase d'échec avec sa cause", () => {
    expect(deriverEtat(brut({ statut: "echouee", derniere_echec: { cause: "client", prestataire: "pawapay", moyen: "mobile_money", pays: "TZ", operateur: "TEST_op" } }), MAINTENANT)).toMatchObject({ phase: "echec", causeEchec: "client" });
    expect(deriverEtat(brut({ statut: "echouee", derniere_echec: { cause: "prestataire", prestataire: "pawapay", moyen: "mobile_money", pays: "TZ", operateur: "TEST_op" } }), MAINTENANT)).toMatchObject({ phase: "echec", causeEchec: "prestataire" });
  });
  it("échéance passée : expirée même si la tâche planifiée n'est pas passée", () => {
    expect(deriverEtat(brut({ expire_le: PASSE }), MAINTENANT)?.phase).toBe("expiree");
    expect(deriverEtat(brut({ statut: "echouee", expire_le: PASSE }), MAINTENANT)?.phase).toBe("expiree");
    expect(deriverEtat(brut({ statut: "expiree", expire_le: null }), MAINTENANT)?.phase).toBe("expiree");
  });
  it("une Commande payée dont l'échéance est passée reste payée", () => {
    expect(deriverEtat(brut({ statut: "payee", expire_le: PASSE }), MAINTENANT)?.phase).toBe("payee");
  });
  it("un Kit dans la Commande est signalé (« Ouvrir dans ma bibliothèque »)", () => {
    expect(deriverEtat(brut({ statut: "payee", kit: true }), MAINTENANT)?.kit).toBe(true);
  });
});

describe("deriverEtat : Trop-perçu et lecture invalide", () => {
  it("Trop-perçu enregistré : motif transmis, la Commande garde son statut (FR-19)", () => {
    const e = deriverEtat(brut({ statut: "expiree", expire_le: null, trop_percu: "expiree" }), MAINTENANT);
    expect(e).toMatchObject({ phase: "expiree", tropPercu: "expiree", statut: "expiree" });
    expect(deriverEtat(brut({ statut: "payee", trop_percu: "deja_payee" }), MAINTENANT)).toMatchObject({ phase: "payee", tropPercu: "deja_payee" });
  });
  it("lecture mal formée ou statut de paiement inattendu : null, rien n'est inventé", () => {
    expect(deriverEtat(null, MAINTENANT)).toBeNull();
    expect(deriverEtat({ statut: "en_attente" }, MAINTENANT)).toBeNull();
    expect(deriverEtat(brut({ trop_percu: "autre_chose" }), MAINTENANT)).toBeNull();
  });
  it("n'expose ni référence de transaction ni montant reçu ni identifiant", () => {
    const e = deriverEtat(brut({ tentative_en_cours: { moyen: "carte", age_secondes: 1, prestataire: "TEST_K-Pay", telephone_masque: null } }), MAINTENANT) as Record<string, unknown>;
    expect(Object.keys(e).sort()).toEqual(["attente", "attenteDepuisSecondes", "causeEchec", "echec", "exclus", "expireLe", "kit", "montantCents", "phase", "repli", "statut", "tropPercu"]);
    // Le numéro de téléphone n'est jamais en clair : seulement sa forme masquée.
    expect(JSON.stringify(e)).not.toMatch(/\+243[0-9]{6}/);
  });
});

describe("constantes de la page d'attente et adresse de retour", () => {
  it("sondage toutes les 3 secondes, vérification après 2 minutes", () => {
    expect(INTERVALLE_SONDAGE_MS).toBe(3000);
    expect(DELAI_VERIFICATION_SECONDES).toBe(120);
  });
  it("l'adresse de retour ne contient que le numéro de Commande", () => {
    expect(adresseRetourPrestataire("https://TEST.invalid/", "kpay", "KS-2026-000042")).toBe("https://TEST.invalid/api/paiement/retour/kpay?numero=KS-2026-000042");
  });
});
