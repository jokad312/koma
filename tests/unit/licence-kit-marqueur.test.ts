import { describe, expect, it } from "vitest";
import { ESPACES_PUBLICS, trouverMarqueurs } from "@/lib/vitrine/marqueur";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

// Story 3.5 / Q-5 : texte de la case « Licence de kit » fourni le 2026-11-11 ; le contrôle de build de production reste en place.
describe("texte de la case Licence de kit", () => {
  it("l'espace Kit est contrôlé par le build de production", () => {
    expect(ESPACES_PUBLICS).toContain("Kit");
  });
  it("la case Licence de kit porte le texte fourni par Jonathan (2026-11-11), en français et en anglais", () => {
    expect(trouverMarqueurs(fr)).not.toContain("Kit.obtention.licenceCase");
    expect(trouverMarqueurs(en)).not.toContain("Kit.obtention.licenceCase");
    expect(fr.Kit.obtention.licenceCase).toBe("J'accepte la licence des kits : usage personnel, sans partage ni revente des fichiers.");
    expect(en.Kit.obtention.licenceCase).toBe("I accept the kit licence: personal use only, no sharing or reselling of the files.");
  });
  it("la mention photos et vidéos du Pass est fournie, en français et en anglais", () => {
    expect(trouverMarqueurs(fr)).not.toContain("Festival.achat.mention.texte");
    expect(trouverMarqueurs(en)).not.toContain("Festival.achat.mention.texte");
  });
});
