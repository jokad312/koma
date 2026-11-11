// Story 7.11 : réglage « délai de paiement d'un Stand » (heures, 1 à 168, entier ; vide = effacé).
import { describe, expect, it } from "vitest";
import { delaiStandHeuresSchema } from "@/modules/admin/schemas";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

describe("delaiStandHeuresSchema", () => {
  it.each([["48", "48"], [" 1 ", "1"], ["168", "168"], ["", null], ["   ", null]])("« %s » → %s", (entree, attendu) => {
    expect(delaiStandHeuresSchema.parse(entree)).toBe(attendu);
  });
  it.each(["0", "169", "4,5", "12h", "-3", "1000", "abc"])("« %s » est refusé", (entree) => {
    expect(delaiStandHeuresSchema.safeParse(entree).success).toBe(false);
  });
  it("textes FR et EN présents et de même forme", () => {
    expect(Object.keys(fr.Admin.reglages.delaiStand).sort()).toEqual(Object.keys(en.Admin.reglages.delaiStand).sort());
    expect(fr.Admin.reglages.erreurs.delai_stand_invalide).toBeTruthy();
    expect(en.Admin.reglages.erreurs.delai_stand_invalide).toBeTruthy();
  });
});
