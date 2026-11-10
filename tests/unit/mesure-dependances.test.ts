// Story 9.7, correctifs de la revue : l'hôte de comparaison vient de NEXT_PUBLIC_SITE_URL (jamais d'un en-tête du client),
// l'adresse IP retenue est la dernière de X-Forwarded-For (celle du proxy), et seule son empreinte HMAC sort : jamais l'adresse.
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ entetes: new Headers(), appels: [] as { nom: string; args: Record<string, unknown> }[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => etat.entetes }));
vi.mock("@/lib/env", () => ({
  lireEnvPublique: () => ({ NEXT_PUBLIC_SITE_URL: "https://boutique.test" }),
  lireEnvServeur: () => ({ SUPABASE_SECRET_KEY: "TEST_cle_hmac" }),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async (nom: string, args: Record<string, unknown>) => {
      etat.appels.push({ nom, args });
      return { data: true, error: null };
    },
  }),
}));

import { dependancesMesure, derniereAdresse, hoteDuSite } from "@/modules/mesure/dependances";

beforeEach(() => {
  etat.entetes = new Headers();
  etat.appels = [];
});

describe("dépendances de la mesure", () => {
  it("hôte : celui de NEXT_PUBLIC_SITE_URL, même si Host et X-Forwarded-Host disent autre chose", async () => {
    etat.entetes = new Headers({ host: "evil.test", "x-forwarded-host": "evil.test" });
    expect(await dependancesMesure().hote()).toBe("boutique.test");
    expect(hoteDuSite("pas une adresse")).toBeNull();
  });

  it("adresse : la dernière de X-Forwarded-For (ajoutée par le proxy), jamais la première (fixée par le client)", () => {
    expect(derniereAdresse("1.2.3.4, 10.0.0.9")).toBe("10.0.0.9");
    expect(derniereAdresse(" 10.0.0.9 ")).toBe("10.0.0.9");
    expect(derniereAdresse(null)).toBeNull();
    expect(derniereAdresse(" , ")).toBeNull();
  });

  it("empreinte : HMAC de l'adresse retenue, jamais l'adresse en clair ; aucune adresse : aucune empreinte", async () => {
    etat.entetes = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.9" });
    const empreinte = await dependancesMesure().empreinteClient();
    expect(empreinte).toBe(createHmac("sha256", "TEST_cle_hmac").update("10.0.0.9").digest("hex"));
    expect(empreinte).not.toContain("10.0.0.9");
    etat.entetes = new Headers();
    expect(await dependancesMesure().empreinteClient()).toBeNull();
  });

  it("écriture : aucune adresse ni empreinte transmise à la base", async () => {
    etat.entetes = new Headers({ "x-forwarded-for": "10.0.0.9" });
    await dependancesMesure().enregistrer({ action: "vue_fiche", page: "/cosplays", origine: null, referent: null, langue: "fr", appareil: "mobile", session: "00000000-0000-4000-8000-000000000001", dureeMs: null });
    const ecriture = etat.appels.find((a) => a.nom === "enregistrer_evenement_mesure");
    expect(ecriture).toBeDefined();
    expect(JSON.stringify(ecriture)).not.toContain("10.0.0.9");
    expect(Object.keys(ecriture!.args).some((k) => /ip|empreinte/i.test(k))).toBe(false);
  });
});
