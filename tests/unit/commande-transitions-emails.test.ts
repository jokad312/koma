import { describe, expect, it } from "vitest";
import { rendreCommandeEnFabrication, rendreCommandeExpediee, rendreCommandeLivree } from "@/modules/envois/modeles/statut-commande";
import { transitionsPossibles } from "@/modules/commande/transitions";

const base = { offerte: false, lignesPhysiques: 1, lignesFabriquees: 0 };

describe("transitionsPossibles (story 6.3)", () => {
  it("payée avec toutes les lignes en stock : expédition directe, fabrication ABSENTE", () => {
    expect(transitionsPossibles({ ...base, statut: "payee" })).toEqual(["expediee"]);
  });
  it("payée avec une ligne fabriquée : fabrication seulement, expédition directe ABSENTE", () => {
    expect(transitionsPossibles({ ...base, lignesFabriquees: 1, statut: "payee" })).toEqual(["en_fabrication"]);
  });
  it("en fabrication : expédiée seulement ; expédiée : livrée seulement ; livrée : rien", () => {
    expect(transitionsPossibles({ ...base, statut: "en_fabrication" })).toEqual(["expediee"]);
    expect(transitionsPossibles({ ...base, statut: "expediee" })).toEqual(["livree"]);
    expect(transitionsPossibles({ ...base, statut: "livree" })).toEqual([]);
  });
  it("jamais de transition vers payee, offerte, echouee, expiree, ni de retour en arrière", () => {
    for (const statut of ["en_attente", "echouee", "expiree", "annulee", "remboursee", "offerte"] as const) expect(transitionsPossibles({ ...base, statut })).toEqual([]);
    const toutes = (["payee", "en_fabrication", "expediee", "livree"] as const).flatMap((statut) => transitionsPossibles({ ...base, statut }));
    expect(toutes).not.toContain("payee");
  });
  it("Commande offerte ou sans ligne physique : aucune transition", () => {
    expect(transitionsPossibles({ ...base, offerte: true, statut: "payee" })).toEqual([]);
    expect(transitionsPossibles({ ...base, lignesPhysiques: 0, statut: "payee" })).toEqual([]);
  });
});

const donnees = { nomSite: "TEST_site", numero: "KS-2026-000042", url: "https://TEST.invalid/fr/commande/KS-2026-000042" };

describe("emails d'avancement (story 6.3)", () => {
  it("en fabrication : numéro dans le sujet, lien en bouton et en texte", () => {
    const m = rendreCommandeEnFabrication("fr", donnees);
    expect(m.sujet).toContain("KS-2026-000042");
    expect(m.html).toContain(donnees.url);
    expect(m.texte).toContain(donnees.url);
  });
  it("expédiée : le numéro de suivi est écrit tel quel s'il existe, absent sinon", () => {
    expect(rendreCommandeExpediee("fr", { ...donnees, numeroSuivi: "AB-123 x" }).texte).toContain("AB-123 x");
    expect(rendreCommandeExpediee("fr", { ...donnees, numeroSuivi: null }).texte).not.toMatch(/suivi/i);
    expect(rendreCommandeExpediee("en", { ...donnees, numeroSuivi: "AB-123" }).texte).toContain("Tracking number: AB-123");
  });
  it("expédiée en retrait à Goma : « prête à retirer »", () => {
    expect(rendreCommandeExpediee("fr", { ...donnees, retrait: true }).sujet).toContain("prête à retirer");
  });
  it("le numéro de suivi est échappé dans le HTML (jamais interprété)", () => {
    expect(rendreCommandeExpediee("fr", { ...donnees, numeroSuivi: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });
  it("livrée : invitation WhatsApp avec le lien du numéro réglé ; sans numéro, aucune invitation", () => {
    expect(rendreCommandeLivree("fr", { ...donnees, lienWhatsapp: "https://wa.me/243000000000" }).texte).toContain("https://wa.me/243000000000");
    expect(rendreCommandeLivree("fr", { ...donnees, lienWhatsapp: null }).texte).not.toMatch(/whatsapp/i);
  });
});
