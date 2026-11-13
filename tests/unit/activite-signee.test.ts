import { describe, expect, it } from "vitest";
import { heureConnexion, lienSession, lireActiviteSignee, lireSecretActivite, signerActivite } from "@/lib/auth/activite-signee";
import { evaluerActivite } from "@/lib/auth/inactivite";

// Cookie d'activité signé (story 9.14, décision du 2026-11-13). Valeurs de test uniquement.
const SECRET = "TEST_secret_activite_de_trente_deux_caracteres_au_moins";
const H = 3_600_000;

describe("cookie d'activité signé", () => {
  it("secret : absent ou trop court → null, jamais de valeur de repli", () => {
    expect(lireSecretActivite({})).toBeNull();
    expect(lireSecretActivite({ ACTIVITE_COOKIE_SECRET: "court" })).toBeNull();
    expect(lireSecretActivite({ ACTIVITE_COOKIE_SECRET: SECRET })).toBe(SECRET);
  });

  it("signé puis relu pour la même session : l'heure revient", () => {
    const v = signerActivite(1_700_000_000_000, "TEST_session", SECRET);
    expect(lireActiviteSignee(v, "TEST_session", SECRET)).toBe("1700000000000");
  });

  it("refusé : autre session, autre secret, heure modifiée, signature absente ou valeur illisible", () => {
    const v = signerActivite(1_700_000_000_000, "TEST_session", SECRET);
    expect(lireActiviteSignee(v, "TEST_autre", SECRET)).toBeUndefined();
    expect(lireActiviteSignee(v, "TEST_session", `${SECRET}x`)).toBeUndefined();
    expect(lireActiviteSignee(v.replace("1700000000000", "1800000000000"), "TEST_session", SECRET)).toBeUndefined();
    expect(lireActiviteSignee("1700000000000", "TEST_session", SECRET)).toBeUndefined();
    expect(lireActiviteSignee("abc.def", "TEST_session", SECRET)).toBeUndefined();
    expect(lireActiviteSignee(undefined, "TEST_session", SECRET)).toBeUndefined();
  });

  it("lien de session : session_id, sinon le Compte ; heure de connexion : la plus récente des amr", () => {
    expect(lienSession({ sub: "TEST_c", session_id: "TEST_s" })).toBe("TEST_s");
    expect(lienSession({ sub: "TEST_c" })).toBe("TEST_c");
    expect(lienSession(null)).toBeNull();
    expect(heureConnexion({ amr: [{ method: "otp", timestamp: 100 }, { method: "oauth", timestamp: 200 }] })).toBe(200_000);
    expect(heureConnexion({ amr: "x" })).toBeNull();
    expect(heureConnexion({})).toBeNull();
  });

  it("sans cookie valable : expire si la connexion date de plus que le délai, sinon cookie posé", () => {
    const maintenant = Date.now();
    const base = { valeur: undefined, maintenant, aSession: true, delaiMs: 4 * H };
    expect(evaluerActivite({ ...base, connexionLe: maintenant - 5 * H })).toBe("expire");
    expect(evaluerActivite({ ...base, connexionLe: maintenant - 1 * H })).toBe("poser");
    expect(evaluerActivite({ ...base, connexionLe: null })).toBe("poser");
    expect(evaluerActivite({ ...base, valeur: String(maintenant + 10 * H), connexionLe: maintenant - 5 * H })).toBe("expire");
  });
});
