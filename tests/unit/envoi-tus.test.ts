import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({
  options: null as null | Record<string, unknown>,
  fichier: null as unknown,
  start: vi.fn(),
  abort: vi.fn(),
}));
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(fichier: unknown, options: Record<string, unknown>) {
      faux.fichier = fichier;
      faux.options = options;
    }
    start = faux.start;
    abort = faux.abort;
  },
}));

import { demarrerEnvoiTus, MESSAGE_ANNULE, TAILLE_MORCEAU_TUS } from "@/lib/supabase/envoi-tus";

const reponse = (statut: number) => ({ originalResponse: { getStatus: () => statut } });

async function lancer() {
  const onProgression = vi.fn();
  const onReprise = vi.fn();
  const blob = new Blob(["x"]);
  const envoi = await demarrerEnvoiTus({
    fichier: blob,
    contentType: "image/jpeg",
    objet: "P/U.jpg",
    jeton: "TEST_jeton",
    adresseSupabase: "https://exemple.invalid/",
    clePublique: "TEST_cle",
    onProgression,
    onReprise,
  });
  // Options du faux Upload relues par les tests : forme libre.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { envoi, onProgression, onReprise, blob, options: faux.options as Record<string, any> };
}

beforeEach(() => {
  vi.clearAllMocks();
  faux.options = null;
});

describe("demarrerEnvoiTus", () => {
  it("options : point d'accès signé, x-signature, apikey, métadonnées, morceaux de 6 Mo, reprise", async () => {
    const { options, blob } = await lancer();
    expect(faux.fichier).toBe(blob);
    expect(options.endpoint).toBe("https://exemple.invalid/storage/v1/upload/resumable/sign");
    expect(options.headers).toEqual({ "x-signature": "TEST_jeton", apikey: "TEST_cle" });
    expect(options.metadata).toEqual({ bucketName: "galerie-attente", objectName: "P/U.jpg", contentType: "image/jpeg", cacheControl: "3600" });
    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(TAILLE_MORCEAU_TUS).toBe(6 * 1024 * 1024);
    expect(options.retryDelays.length).toBeGreaterThan(0);
    expect(faux.start).toHaveBeenCalledTimes(1);
  });

  it("onShouldRetry : 403 non ; 429, 500 et coupure réseau oui avec onReprise ; plus de reprise une fois les essais épuisés", async () => {
    const { options, onReprise } = await lancer();
    expect(options.onShouldRetry(reponse(403), 0, options)).toBe(false);
    expect(options.onShouldRetry(reponse(400), 0, options)).toBe(false);
    expect(onReprise).not.toHaveBeenCalled();
    expect(options.onShouldRetry(reponse(429), 0, options)).toBe(true);
    expect(options.onShouldRetry(reponse(500), 1, options)).toBe(true);
    expect(options.onShouldRetry({}, 2, options)).toBe(true);
    expect(onReprise).toHaveBeenCalledTimes(3);
    expect(options.onShouldRetry({}, options.retryDelays.length, options)).toBe(false);
  });

  it("progression transmise ; succès résout ; erreur rejette", async () => {
    const a = await lancer();
    a.options.onProgress(5, 10);
    expect(a.onProgression).toHaveBeenCalledWith(5, 10);
    a.options.onSuccess();
    await expect(a.envoi.terminer).resolves.toBeUndefined();

    const b = await lancer();
    b.options.onError(new Error("TEST_echec"));
    await expect(b.envoi.terminer).rejects.toThrow("TEST_echec");
  });

  it("annuler : abort(true) puis terminer est rejeté (annulation), même si abort échoue", async () => {
    const a = await lancer();
    faux.abort.mockResolvedValueOnce(undefined);
    await a.envoi.annuler();
    expect(faux.abort).toHaveBeenCalledWith(true);
    await expect(a.envoi.terminer).rejects.toThrow(MESSAGE_ANNULE);

    const b = await lancer();
    faux.abort.mockRejectedValueOnce(new Error("TEST_reseau"));
    await b.envoi.annuler();
    await expect(b.envoi.terminer).rejects.toThrow(MESSAGE_ANNULE);
  });
});
