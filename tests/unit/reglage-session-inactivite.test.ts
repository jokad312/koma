// Story 9.14 : réglage « déconnexion après inactivité » (heures, 1 à 24, entier ; vide = effacé, 4 h appliquées par le serveur).
import { describe, expect, it } from "vitest";
import { sessionInactiviteHeuresSchema } from "@/modules/admin/schemas";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

describe("sessionInactiviteHeuresSchema", () => {
  it.each([["1", "1"], ["24", "24"], [" 4 ", "4"], ["", null], ["   ", null]])("« %s » → %s", (entree, attendu) => {
    expect(sessionInactiviteHeuresSchema.parse(entree)).toBe(attendu);
  });
  it.each(["0", "25", "4,5", "4.5", "abc", "-3", "100"])("« %s » est refusé", (entree) => {
    expect(sessionInactiviteHeuresSchema.safeParse(entree).success).toBe(false);
  });
  it("textes FR et EN présents et de même forme", () => {
    expect(Object.keys(fr.Admin.reglages.sessionInactivite).sort()).toEqual(Object.keys(en.Admin.reglages.sessionInactivite).sort());
    expect(fr.Admin.reglages.erreurs.session_inactivite_invalide).toBeTruthy();
    expect(en.Admin.reglages.erreurs.session_inactivite_invalide).toBeTruthy();
  });
});
