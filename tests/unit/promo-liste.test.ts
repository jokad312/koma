import { describe, expect, it } from "vitest";
import {
  adresseCodes,
  filtrerCodes,
  filtreCodesValide,
  idCodeValide,
  pageCodesValide,
  paginerCodes,
  rechercheCodesValide,
} from "@/modules/promo/liste";
import type { CodePromo } from "@/modules/promo/types";

const base: CodePromo = {
  id: "00000000-0000-4000-8000-0000000000d1",
  code: "SOLDES10",
  affilie: "TEST_Affilié",
  reductionPct: 20,
  commissionPct: 5,
  plafond: 50,
  actif: true,
  creeLe: "2026-11-04T10:00:00Z",
  modifieLe: "2026-11-04T10:00:00Z",
  ventes: 0,
  montantCents: 0,
  commissionCents: 0,
};

describe("liste des Codes promo (9.16 i) : valeurs lues dans l'adresse", () => {
  it("filtre : liste fermée, « tous » par défaut", () => {
    expect(filtreCodesValide("actifs")).toBe("actifs");
    expect(filtreCodesValide(["inactifs", "actifs"])).toBe("inactifs");
    expect(filtreCodesValide("supprimes")).toBe("tous");
    expect(filtreCodesValide(undefined)).toBe("tous");
  });

  it("recherche : bornée à 100 caractères, vide = aucune", () => {
    expect(rechercheCodesValide("  sol  ")).toBe("sol");
    expect(rechercheCodesValide("   ")).toBeUndefined();
    expect(rechercheCodesValide("é".repeat(150))).toHaveLength(100);
  });

  it("page : entier positif, sinon 1", () => {
    expect(pageCodesValide("3")).toBe(3);
    expect(pageCodesValide("0")).toBe(1);
    expect(pageCodesValide("2.5")).toBe(1);
    expect(pageCodesValide("-1")).toBe(1);
  });

  it("identifiant à modifier : UUID seulement", () => {
    expect(idCodeValide(base.id.toUpperCase())).toBe(base.id);
    expect(idCodeValide("1 or 1=1")).toBeUndefined();
  });
});

describe("filtrage, pagination et adresses", () => {
  const codes = [base, { ...base, id: "2", code: "AUTRE", affilie: "Gun", actif: false }];

  it("actifs, inactifs, recherche sur le code ou l'affilié, sans casse ni accents", () => {
    expect(filtrerCodes(codes, "actifs").map((c) => c.code)).toEqual(["SOLDES10"]);
    expect(filtrerCodes(codes, "inactifs").map((c) => c.code)).toEqual(["AUTRE"]);
    expect(filtrerCodes(codes, "tous", "affilie").map((c) => c.code)).toEqual(["SOLDES10"]);
    expect(filtrerCodes(codes, "tous", "gUN").map((c) => c.code)).toEqual(["AUTRE"]);
    expect(filtrerCodes(codes, "tous", "soldes").map((c) => c.code)).toEqual(["SOLDES10"]);
  });

  it("25 lignes : 2 pages de 20 ; la page 2 commence au rang 20 ; une page trop grande revient à la dernière", () => {
    const lignes = Array.from({ length: 25 }, (_, i) => i);
    expect(paginerCodes(lignes, 1)).toMatchObject({ page: 1, pages: 2, debut: 0 });
    expect(paginerCodes(lignes, 2)).toEqual({ lignes: [20, 21, 22, 23, 24], page: 2, pages: 2, debut: 20 });
    expect(paginerCodes(lignes, 9).page).toBe(2);
    expect(paginerCodes([], 1)).toEqual({ lignes: [], page: 1, pages: 1, debut: 0 });
  });

  it("adresses : page 1 et « tous » omis ; fenêtres sur la même route", () => {
    expect(adresseCodes({ filtre: "tous", page: 1 })).toBe("/admin/codes-promo");
    expect(adresseCodes({ filtre: "actifs", q: "a b", page: 2 })).toBe("/admin/codes-promo?q=a+b&filtre=actifs&page=2");
    expect(adresseCodes({ filtre: "tous", page: 1 }, { nouveau: true })).toBe("/admin/codes-promo?nouveau=1");
    expect(adresseCodes({ filtre: "tous", page: 1 }, { modifier: base.id })).toBe(`/admin/codes-promo?modifier=${base.id}`);
  });
});
