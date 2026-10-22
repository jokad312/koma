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
    expect(await lireReglagesAdmin()).toEqual({ nomSite: "Nom de test", numeroWhatsapp: "+243970000000" });
    expect(faux.cles).toEqual(["nom_site", "numero_whatsapp"]);
  });

  it("ligne absente, valeur nulle ou vide : null, aucune valeur de repli", async () => {
    faux.resultat = { data: [{ cle: "numero_whatsapp", valeur: "  " }], error: null };
    expect(await lireReglagesAdmin()).toEqual({ nomSite: null, numeroWhatsapp: null });
  });

  it("erreur de lecture : lève", async () => {
    faux.resultat = { data: null, error: { message: "x" } };
    await expect(lireReglagesAdmin()).rejects.toThrow();
  });
});
