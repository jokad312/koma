import { describe, expect, it } from "vitest";
import { construireFrise } from "@/modules/commande/frise";

const DATES = { payee: "2026-11-01T10:00:00Z", en_fabrication: "2026-11-02T10:00:00Z", expediee: "2026-11-05T10:00:00Z", livree: "2026-11-06T10:00:00Z" };
const base = { physique: true, fabrication: true, dates: DATES };

describe("construireFrise (story 6.1)", () => {
  it("Commande payée : première étape en cours, les autres à venir sans date", () => {
    expect(construireFrise({ ...base, statut: "payee" })).toEqual([
      { cle: "payee", etat: "en_cours", date: DATES.payee },
      { cle: "en_fabrication", etat: "a_venir", date: null },
      { cle: "expediee", etat: "a_venir", date: null },
      { cle: "livree", etat: "a_venir", date: null },
    ]);
  });
  it("en fabrication : payée faite, fabrication en cours", () => {
    const e = construireFrise({ ...base, statut: "en_fabrication" });
    expect(e.map((x) => x.etat)).toEqual(["fait", "en_cours", "a_venir", "a_venir"]);
  });
  it("livrée : toutes les étapes sont faites, avec leurs dates", () => {
    const e = construireFrise({ ...base, statut: "livree" });
    expect(e.map((x) => x.etat)).toEqual(["fait", "fait", "fait", "fait"]);
    expect(e[3].date).toBe(DATES.livree);
  });
  it("sans ligne fabriquée à la demande : pas d'étape de fabrication", () => {
    expect(construireFrise({ ...base, fabrication: false, statut: "expediee" }).map((x) => x.cle)).toEqual(["payee", "expediee", "livree"]);
  });
  it("Kit seul, offerte, en attente, annulée : aucune frise (jamais de statut inventé)", () => {
    for (const statut of ["payee", "livree"] as const) expect(construireFrise({ ...base, physique: false, statut })).toEqual([]);
    for (const statut of ["offerte", "en_attente", "echouee", "expiree", "annulee", "remboursee"] as const) expect(construireFrise({ ...base, statut })).toEqual([]);
  });
});
