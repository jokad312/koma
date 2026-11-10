// Story 8.3 : « Voir plus » du mur — Server Action qui recharge la suite après le curseur.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chargerPlusMurs } from "@/modules/communaute/voir-plus";
import { decoderCurseurMurs, encoderCurseurMurs } from "@/modules/communaute/adresse";
import { TAILLE_PAGE_MURS } from "@/modules/communaute/types";

const ID = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-11-10 08:15:30.123456+00";
const CURSEUR = encoderCurseurMurs({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });

const faux = vi.hoisted(() => vi.fn());
vi.mock("@/modules/communaute/queries", () => ({ lireMurs: (...a: unknown[]) => faux(...a) }));

beforeEach(() => {
  faux.mockReset();
});

describe("chargerPlusMurs", () => {
  it("curseur illisible : refus, sans lire", async () => {
    expect(await chargerPlusMurs("!!!")).toEqual({ ok: false });
    expect(faux).not.toHaveBeenCalled();
  });

  it("curseur illisible via le décodage : refus", async () => {
    expect(await chargerPlusMurs(Buffer.from("pas du json").toString("base64url"))).toEqual({ ok: false });
    expect(faux).not.toHaveBeenCalled();
  });

  it("suite : charge les entrées suivantes et renvoie la suite", async () => {
    const murs = [{ id: "00000000-0000-4000-8000-000000000002" }];
    faux.mockResolvedValue({ murs, suite: "CUR2" });
    expect(await chargerPlusMurs(CURSEUR)).toEqual({ ok: true, murs, suite: "CUR2" });
    expect(faux).toHaveBeenCalledWith(decoderCurseurMurs(CURSEUR), { cumul: true });
  });

  it("erreur de lecture : ok false, jamais une liste inventée", async () => {
    faux.mockImplementation(() => {
      throw new Error("base indisponible");
    });
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await chargerPlusMurs(CURSEUR)).toEqual({ ok: false });
    expect(journal).toHaveBeenCalledTimes(1);
  });
});
