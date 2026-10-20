import { describe, expect, it } from "vitest";
import { lireEnvServeur } from "./env";

const valide = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "TEST_cle_publique",
  SUPABASE_SECRET_KEY: "TEST_cle_secrete",
};

describe("lireEnvServeur", () => {
  it("accepte un environnement complet", () => {
    expect(lireEnvServeur(valide).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("nomme la variable absente", () => {
    const incomplet: Record<string, string | undefined> = { ...valide, SUPABASE_SECRET_KEY: undefined };
    expect(() => lireEnvServeur(incomplet)).toThrow("SUPABASE_SECRET_KEY");
  });

  it("n'affiche aucune valeur dans le message d'erreur", () => {
    const invalide = { ...valide, NEXT_PUBLIC_SITE_URL: "TEST_valeur_secrete_invalide" };
    expect(() => lireEnvServeur(invalide)).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => lireEnvServeur(invalide)).not.toThrow("TEST_valeur_secrete_invalide");
  });
});
