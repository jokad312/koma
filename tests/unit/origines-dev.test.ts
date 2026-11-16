import { describe, expect, it } from "vitest";
import { lireOriginesDev } from "@/lib/securite/origines-dev";

describe("lireOriginesDev (allowedDevOrigins)", () => {
  it("variable absente ou vide : aucune origine", () => {
    expect(lireOriginesDev(undefined)).toEqual([]);
    expect(lireOriginesDev("")).toEqual([]);
    expect(lireOriginesDev(" , ")).toEqual([]);
  });

  it("hôtes séparés par des virgules, espaces retirés", () => {
    expect(lireOriginesDev("TEST_hote-a.local, TEST_hote-b.local")).toEqual(["TEST_hote-a.local", "TEST_hote-b.local"]);
  });
});
