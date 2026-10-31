import { describe, expect, it } from "vitest";
import { ESPACES_PUBLICS, trouverMarqueurs } from "@/lib/vitrine/marqueur";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

// Story 3.5 / Q-5 : tant que Jonathan n'a pas fourni le texte de la case « Licence de kit », le marqueur reste visible en développement
// et le contrôle de build de production le refuse (scripts/verifier-marqueurs.mjs, KOMA_VERIFIER_TEXTES=true).
describe("texte de la case Licence de kit", () => {
  it("l'espace Kit est contrôlé par le build de production", () => {
    expect(ESPACES_PUBLICS).toContain("Kit");
  });
  it("le marqueur « [Texte à fournir] » est détecté en français et en anglais tant que le texte manque", () => {
    expect(trouverMarqueurs(fr)).toContain("Kit.obtention.licenceCase");
    expect(trouverMarqueurs(en)).toContain("Kit.obtention.licenceCase");
  });
});
