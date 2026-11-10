// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Story 9.7 : module navigateur. Aucun cookie, aucun envoi depuis une page exclue, aucune chaîne de requête transmise.

const envoi = vi.fn();

async function charger() {
  vi.resetModules();
  return import("@/modules/mesure/client");
}

function corpsEnvoye() {
  const [, init] = envoi.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

beforeEach(() => {
  envoi.mockReset();
  envoi.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", envoi);
  window.sessionStorage.clear();
  document.documentElement.lang = "fr";
  window.history.replaceState({}, "", "/fr/cosplays/nezuko");
  Object.defineProperty(document, "referrer", { value: "", configurable: true });
});

describe("session et origine", () => {
  it("crée une session aléatoire une seule fois et la garde en sessionStorage", async () => {
    const { demarrerMesure } = await charger();
    demarrerMesure();
    const premier = JSON.parse(window.sessionStorage.getItem("ks-mesure-etat") ?? "{}") as { session?: string };
    expect(premier.session).toMatch(/^[0-9a-f-]{36}$/);
    demarrerMesure();
    const second = JSON.parse(window.sessionStorage.getItem("ks-mesure-etat") ?? "{}") as { session?: string };
    expect(second.session).toBe(premier.session);
  });

  it("retient l'origine normalisée de l'adresse, jamais la chaîne de requête", async () => {
    window.history.replaceState({}, "", "/fr/cosplays/nezuko?origine=WhatsApp&c=secret&s=signature");
    const { mesurer } = await charger();
    mesurer("vue_fiche");
    const corps = corpsEnvoye();
    expect(corps.origine).toBe("whatsapp");
    expect(JSON.stringify(corps)).not.toContain("secret");
    expect(JSON.stringify(corps)).not.toContain("signature");
  });

  it("retient le domaine du référent seulement", async () => {
    Object.defineProperty(document, "referrer", { value: "https://www.tiktok.com/@koma/video/12?x=1", configurable: true });
    const { mesurer } = await charger();
    mesurer("clic_heros");
    expect(corpsEnvoye().provenance).toBe("tiktok.com");
  });
});

describe("envoi", () => {
  it("envoie un événement public, sans champ « page » (le serveur la recalcule du Referer)", async () => {
    const { mesurer } = await charger();
    mesurer("vue_fiche");
    expect(envoi).toHaveBeenCalledTimes(1);
    const [url, init] = envoi.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/mesure");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(corpsEnvoye()).toMatchObject({ action: "vue_fiche", langue: "fr", appareil: "ordinateur" });
  });

  it("n'envoie qu'une vue de fiche par onglet et par page", async () => {
    const { mesurer } = await charger();
    mesurer("vue_fiche");
    mesurer("vue_fiche");
    expect(envoi).toHaveBeenCalledTimes(1);
    window.history.replaceState({}, "", "/fr/cosplays/giyu");
    mesurer("vue_fiche");
    expect(envoi).toHaveBeenCalledTimes(2);
  });

  it("n'envoie rien depuis une page exclue", async () => {
    const { mesurer } = await charger();
    for (const chemin of ["/fr/admin", "/fr/admin/commandes", "/fr/connexion", "/fr/commande/KS-2026-000001", "/en/checkout", "/fr/desinscription"]) {
      window.history.replaceState({}, "", chemin);
      mesurer("vue_fiche");
      mesurer("clic_heros");
    }
    expect(envoi).not.toHaveBeenCalled();
  });

  it("envoie les actions de la liste fermée depuis /compte, et refuse les autres", async () => {
    window.history.replaceState({}, "", "/fr/compte/bibliotheque/onigiri");
    const { mesurer } = await charger();
    mesurer("video_kit_demarree");
    mesurer("video_kit_terminee");
    mesurer("vue_fiche");
    mesurer("clic_heros");
    expect(envoi).toHaveBeenCalledTimes(2);
    expect(corpsEnvoye().action).toBe("video_kit_demarree");
  });

  it("transmet la durée du héros, bornée, et seulement pour chargement_heros", async () => {
    const { mesurer } = await charger();
    mesurer("chargement_heros", { dureeMs: 1234.7 });
    expect(corpsEnvoye().duree).toBe(1235);
    envoi.mockClear();
    window.history.replaceState({}, "", "/fr/a-propos");
    mesurer("chargement_heros", { dureeMs: 999999 });
    expect(corpsEnvoye().duree).toBe(60000);
  });

  it("ne lève jamais quand l'envoi échoue", async () => {
    envoi.mockRejectedValue(new Error("réseau coupé"));
    const { mesurer } = await charger();
    expect(() => mesurer("vue_fiche")).not.toThrow();
    expect(envoi).toHaveBeenCalledTimes(1);
  });
});
