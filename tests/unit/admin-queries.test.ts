import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ resultat: { data: null as unknown, error: null as unknown }, cles: null as unknown }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: () => ({
      select: () => ({
        in: (_colonne: string, cles: unknown) => {
          faux.cles = cles;
          return Promise.resolve(faux.resultat);
        },
      }),
    }),
  }),
}));

import { lireReglagesAdmin } from "@/modules/admin/queries";

beforeEach(() => {
  faux.resultat = { data: null, error: null };
});

describe("lireReglagesAdmin", () => {
  it("les valeurs vont à la bonne clé", async () => {
    faux.resultat = {
      data: [
        { cle: "numero_whatsapp", valeur: "+243970000000" },
        { cle: "nom_site", valeur: "Nom de test" },
      ],
      error: null,
    };
    expect(await lireReglagesAdmin()).toEqual({
      nomSite: "Nom de test",
      numeroWhatsapp: "+243970000000",
      forfaitLivraisonGomaCents: null,
      forfaitLivraisonBukavuCents: null,
      retraitGomaFr: null,
      retraitGomaEn: null,
      plafondFabrication: null,
    });
    expect(faux.cles).toEqual([
      "nom_site",
      "numero_whatsapp",
      "forfait_livraison_goma_cents",
      "forfait_livraison_bukavu_cents",
      "retrait_goma_fr",
      "retrait_goma_en",
      "plafond_fabrication",
    ]);
  });

  it("ligne absente, valeur nulle ou vide : null, aucune valeur de repli", async () => {
    faux.resultat = { data: [{ cle: "numero_whatsapp", valeur: "  " }], error: null };
    expect(await lireReglagesAdmin()).toEqual({
      nomSite: null,
      numeroWhatsapp: null,
      forfaitLivraisonGomaCents: null,
      forfaitLivraisonBukavuCents: null,
      retraitGomaFr: null,
      retraitGomaEn: null,
      plafondFabrication: null,
    });
  });

  it("les nouvelles clés vont aux bons champs ; un forfait de 0 reste 0", async () => {
    faux.resultat = {
      data: [
        { cle: "forfait_livraison_goma_cents", valeur: "0" },
        { cle: "forfait_livraison_bukavu_cents", valeur: "550" },
        { cle: "retrait_goma_fr", valeur: "Texte FR" },
        { cle: "retrait_goma_en", valeur: "Texte EN" },
        { cle: "plafond_fabrication", valeur: "40" },
      ],
      error: null,
    };
    expect(await lireReglagesAdmin()).toMatchObject({
      forfaitLivraisonGomaCents: "0",
      forfaitLivraisonBukavuCents: "550",
      retraitGomaFr: "Texte FR",
      retraitGomaEn: "Texte EN",
      plafondFabrication: "40",
    });
  });

  it("erreur de lecture : lève", async () => {
    faux.resultat = { data: null, error: { message: "x" } };
    await expect(lireReglagesAdmin()).rejects.toThrow();
  });
});
