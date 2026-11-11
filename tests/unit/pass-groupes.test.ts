// Story 7.5 : regroupement de « Mes Pass » par Événement, à venir d'abord. Données de test seulement.
import { describe, expect, it } from "vitest";
import { grouperParEvenement, statutAffiche } from "@/modules/evenements/pass-groupes";
import type { PassLu } from "@/modules/evenements/pass-types";

const MAINTENANT = Date.parse("2026-11-11T10:00:00Z");

function pass(id: string, evenement: string, debutLe: string | null, finLe: string | null = null): PassLu {
  return {
    id,
    nomTitulaire: `TEST_${id}`,
    statut: "valide",
    typeNom: "TEST_Type",
    jeton: "0".repeat(48),
    codeCourt: "ABCD2345",
    offert: false,
    evenement: { id: evenement, slug: evenement, titre: `TEST_${evenement}`, debutLe, finLe, lieu: null },
  };
}

describe("grouperParEvenement", () => {
  it("met les Événements à venir d'abord (le plus proche en premier), puis les passés (le plus récent en premier)", () => {
    const groupes = grouperParEvenement(
      [
        pass("a", "passe-ancien", "2026-01-10T10:00:00Z"),
        pass("b", "futur-lointain", "2027-03-01T10:00:00Z"),
        pass("c", "passe-recent", "2026-10-01T10:00:00Z"),
        pass("d", "futur-proche", "2026-12-01T10:00:00Z"),
      ],
      MAINTENANT,
    );
    expect(groupes.map((g) => g.evenement.id)).toEqual(["futur-proche", "futur-lointain", "passe-recent", "passe-ancien"]);
    expect(groupes.map((g) => g.avenir)).toEqual([true, true, false, false]);
  });

  it("garde ensemble, dans l'ordre reçu, les Pass d'un même Événement", () => {
    const groupes = grouperParEvenement([pass("a", "e1", "2026-12-01T10:00:00Z"), pass("b", "e2", "2026-12-05T10:00:00Z"), pass("c", "e1", "2026-12-01T10:00:00Z")], MAINTENANT);
    expect(groupes).toHaveLength(2);
    expect(groupes[0].pass.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("un Événement en cours (fin non atteinte) reste à venir", () => {
    const [g] = grouperParEvenement([pass("a", "en-cours", "2026-11-11T08:00:00Z", "2026-11-11T20:00:00Z")], MAINTENANT);
    expect(g.avenir).toBe(true);
  });

  it("sans date, l'Événement reste à venir : aucune date n'est inventée", () => {
    const [g] = grouperParEvenement([pass("a", "sans-date", null)], MAINTENANT);
    expect(g.avenir).toBe(true);
  });

  it("une liste vide donne aucun groupe", () => {
    expect(grouperParEvenement([], MAINTENANT)).toEqual([]);
  });
});

describe("statutAffiche", () => {
  it("garde le statut du Pass quand la Commande est payée ou offerte", () => {
    expect(statutAffiche("valide", "payee")).toBe("valide");
    expect(statutAffiche("scanne", "offerte")).toBe("scanne");
  });
  it("un Pass valide d'une Commande annulée, expirée ou remboursée n'est plus valide", () => {
    expect(statutAffiche("valide", "annulee")).toBe("annule");
    expect(statutAffiche("valide", "expiree")).toBe("annule");
    expect(statutAffiche("valide", "remboursee")).toBe("rembourse");
    expect(statutAffiche("scanne", "annulee")).toBe("annule");
  });
  it("un statut annulé ou remboursé du Pass est conservé", () => {
    expect(statutAffiche("rembourse", "annulee")).toBe("rembourse");
    expect(statutAffiche("annule", "remboursee")).toBe("annule");
  });
});
