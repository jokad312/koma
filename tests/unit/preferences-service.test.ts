// Story 9.4 : lien de désinscription signé, service des Préférences et désinscription par le lien.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lienDesinscription, signerDesinscription, verifierDesinscription } from "@/modules/preferences/lien-desinscription";
import { desinscrireParLien, lirePreferences, reglerPreference } from "@/modules/preferences/service";
import type { DependancesPreferences } from "@/modules/preferences/types";
import { construireAuteur } from "@/lib/auth/auteur";

const SECRET = { DESINSCRIPTION_SECRET: "TEST_secret_de_desinscription_assez_long_0123456789" };
const COMPTE = "00000000-0000-4000-8000-0000000000e1";

beforeEach(() => {
  process.env.DESINSCRIPTION_SECRET = SECRET.DESINSCRIPTION_SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid/";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
});

function faux(s: Partial<DependancesPreferences> = {}): DependancesPreferences {
  return {
    compte: vi.fn(async () => ({ compteId: COMPTE, auteur: construireAuteur(COMPTE) })),
    lire: vi.fn(async () => ({ preferences: { relances: true, nouveautes: false, alertesFestival: false, mineurBloque: false } })),
    regler: vi.fn(async (_a, _o, actif) => ({ actif })),
    desinscrire: vi.fn(async () => ({ fait: true })),
    ...s,
  };
}

describe("lien de désinscription signé", () => {
  it("propre au destinataire : la signature d'un Compte ne vaut pas pour un autre", () => {
    const s = signerDesinscription(COMPTE, SECRET);
    expect(verifierDesinscription(COMPTE, s, SECRET)).toBe(true);
    expect(verifierDesinscription("00000000-0000-4000-8000-0000000000e2", s, SECRET)).toBe(false);
  });

  it("refuse une signature altérée, absente, trop longue ou un identifiant mal formé", () => {
    const s = signerDesinscription(COMPTE, SECRET);
    expect(verifierDesinscription(COMPTE, s.replace(/^./, (c) => (c === "A" ? "B" : "A")), SECRET)).toBe(false);
    expect(verifierDesinscription(COMPTE, undefined, SECRET)).toBe(false);
    expect(verifierDesinscription(COMPTE, "x".repeat(200), SECRET)).toBe(false);
    expect(verifierDesinscription("pas-un-uuid", s, SECRET)).toBe(false);
  });

  it("une autre clé ne valide pas la signature ; une clé absente ou courte arrête net, sans afficher sa valeur", () => {
    const s = signerDesinscription(COMPTE, SECRET);
    expect(verifierDesinscription(COMPTE, s, { DESINSCRIPTION_SECRET: "TEST_autre_secret_assez_long_0123456789abcdef" })).toBe(false);
    expect(() => signerDesinscription(COMPTE, { DESINSCRIPTION_SECRET: "court" })).toThrow(/DESINSCRIPTION_SECRET/);
    expect(() => signerDesinscription(COMPTE, {})).toThrow(/DESINSCRIPTION_SECRET/);
  });

  it("l'adresse vient de NEXT_PUBLIC_SITE_URL, dans la langue du destinataire, et se vérifie", () => {
    const url = new URL(lienDesinscription(COMPTE, "en", SECRET));
    expect(url.origin + url.pathname).toBe("https://test.example.invalid/en/desinscription");
    expect(verifierDesinscription(url.searchParams.get("c"), url.searchParams.get("s"), SECRET)).toBe(true);
  });
});

describe("désinscription par le lien", () => {
  it("lien valide : la base enregistre la désinscription", async () => {
    const deps = faux();
    expect(await desinscrireParLien(deps, { c: COMPTE, s: signerDesinscription(COMPTE) })).toBe("desinscrit");
    expect(deps.desinscrire).toHaveBeenCalledWith(COMPTE);
  });

  it("lien invalide : la base n'est jamais appelée", async () => {
    const deps = faux();
    expect(await desinscrireParLien(deps, { c: COMPTE, s: "TEST_faux" })).toBe("lien_invalide");
    expect(await desinscrireParLien(deps, {})).toBe("lien_invalide");
    expect(deps.desinscrire).not.toHaveBeenCalled();
  });

  it("Compte disparu : lien invalide ; panne : erreur (jamais un faux succès)", async () => {
    expect(await desinscrireParLien(faux({ desinscrire: vi.fn(async () => ({ fait: false })) }), { c: COMPTE, s: signerDesinscription(COMPTE) })).toBe("lien_invalide");
    expect(await desinscrireParLien(faux({ desinscrire: vi.fn(async () => ({ erreur: "TEST" })) }), { c: COMPTE, s: signerDesinscription(COMPTE) })).toBe("erreur");
  });
});

describe("Préférences", () => {
  it("lecture : non connecté, ou préférences de la base", async () => {
    expect(await lirePreferences(faux({ compte: vi.fn(async () => null) }))).toEqual({ ok: false, erreur: "non_connecte" });
    expect(await lirePreferences(faux())).toMatchObject({ ok: true, preferences: { relances: true } });
  });

  it("réglage : l'état renvoyé est celui de la base ; un objet inconnu est refusé sans appel", async () => {
    const deps = faux({ regler: vi.fn(async () => ({ actif: false })) });
    expect(await reglerPreference(deps, { objet: "relances", actif: true })).toEqual({ ok: true, actif: false });
    expect(await reglerPreference(deps, { objet: "tout", actif: true })).toEqual({ ok: false, erreur: "invalide" });
    expect(deps.regler).toHaveBeenCalledTimes(1);
  });

  it("réglage en panne : erreur, l'interface garde l'état précédent", async () => {
    expect(await reglerPreference(faux({ regler: vi.fn(async () => ({ erreur: "TEST" })) }), { objet: "nouveautes", actif: true })).toEqual({ ok: false, erreur: "erreur" });
  });
});
