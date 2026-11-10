import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: () => undefined }));
vi.mock("@/lib/supabase/public", () => ({ creerClientPublic: () => ({ rpc: (...a: unknown[]) => faux.rpc(...a) }) }));

import { decoderCurseurMurs } from "@/modules/communaute/adresse";
import { listerMurs, lireMurPublie, lireMurs } from "@/modules/communaute/queries";

const ID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const ligne = (i: number) => ({
  id: ID(i),
  fichier: `galerie/${i}.jpg`,
  alt_fr: `alt ${i}`,
  alt_en: `alt ${i}`,
  pseudo: null,
  valide_le: "2026-11-10T08:15:30.123456+00:00",
  type: "photo",
  fait_avec_kit: false,
  kit_slug: null,
  kit_titre_fr: null,
  kit_titre_en: null,
  curseur_date: `2026-11-10T08:15:30.${String(100000 + i)}Z`,
});
const page = (n: number) => Array.from({ length: n }, (_, i) => ligne(i + 1));

beforeEach(() => faux.rpc.mockReset());

describe("lireMurs et listerMurs : lecture publique par lister_mur_public uniquement", () => {
  it("n'appelle que lister_mur_public, avec la limite de 24", async () => {
    faux.rpc.mockResolvedValue({ data: page(3), error: null });
    const r = await lireMurs(null);
    expect(faux.rpc).toHaveBeenCalledTimes(1);
    expect(faux.rpc).toHaveBeenCalledWith("lister_mur_public", { p_limite: 24 });
    expect(r.murs).toHaveLength(3);
    expect(r.suite).toBeNull();
  });

  it("page pleine avec une suite réelle : curseur construit sur curseur_date de la dernière ligne", async () => {
    faux.rpc.mockResolvedValueOnce({ data: page(24), error: null }).mockResolvedValueOnce({ data: [ligne(25)], error: null });
    const r = await lireMurs(null);
    expect(faux.rpc).toHaveBeenLastCalledWith("lister_mur_public", { p_curseur_date: ligne(24).curseur_date, p_curseur_id: ID(24), p_limite: 1 });
    expect(decoderCurseurMurs(r.suite)).toEqual({ date: ligne(24).curseur_date, id: ID(24), n: 24 });
  });

  it("page pleine mais rien après : jamais de « Voir plus » devant une liste vide", async () => {
    faux.rpc.mockResolvedValueOnce({ data: page(24), error: null }).mockResolvedValueOnce({ data: [], error: null });
    expect((await lireMurs(null)).suite).toBeNull();
  });

  it("page suivante : le curseur est transmis et le nombre affiché cumulé", async () => {
    faux.rpc.mockResolvedValueOnce({ data: page(24), error: null }).mockResolvedValueOnce({ data: [ligne(99)], error: null });
    const r = await lireMurs({ date: "2026-11-10T08:00:00.000000Z", id: ID(500), n: 24 }, { cumul: true });
    expect(faux.rpc.mock.calls[0][1]).toEqual({ p_curseur_date: "2026-11-10T08:00:00.000000Z", p_curseur_id: ID(500), p_limite: 24 });
    expect(decoderCurseurMurs(r.suite)?.n).toBe(48);
  });

  it("erreur de lecture : relancée, jamais une liste vide inventée", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listerMurs()).rejects.toThrow();
  });

  it("lireMurPublie : faux sur une liste vide ou une erreur, vrai sinon", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    faux.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await lireMurPublie()).toBe(false);
    faux.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await lireMurPublie()).toBe(false);
    faux.rpc.mockResolvedValueOnce({ data: page(1), error: null });
    expect(await lireMurPublie()).toBe(true);
    erreurs.mockRestore();
  });

  it("une ligne inconnue de type : traitée comme une photo ; kit_slug nul : pas de lien Kit", async () => {
    faux.rpc.mockResolvedValue({ data: [{ ...ligne(1), type: "autre", fait_avec_kit: true }], error: null });
    const [m] = (await lireMurs(null)).murs;
    expect(m.type).toBe("photo");
    expect(m.kitSlug).toBeNull();
  });
});
