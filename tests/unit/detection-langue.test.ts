import { describe, expect, it } from "vitest";
import { choisirLangue } from "@/i18n/detection";

describe("choisirLangue (« / »)", () => {
  it("le cookie passe avant l'en-tête", () => {
    expect(choisirLangue("en", "fr")).toBe("en");
    expect(choisirLangue("fr", "en-US")).toBe("fr");
  });
  it("un navigateur français mène à fr", () => {
    expect(choisirLangue(undefined, "fr-CD")).toBe("fr");
    expect(choisirLangue(undefined, "fr-CD,fr;q=0.9,en;q=0.8")).toBe("fr");
  });
  it("une autre langue mène à en", () => {
    expect(choisirLangue(undefined, "en-US")).toBe("en");
    expect(choisirLangue(undefined, "de")).toBe("en");
    expect(choisirLangue(undefined, "de,fr;q=0.5")).toBe("en");
  });
  it("un en-tête absent ou illisible mène à fr", () => {
    expect(choisirLangue(undefined, undefined)).toBe("fr");
    expect(choisirLangue(undefined, "")).toBe("fr");
    expect(choisirLangue(undefined, ";;;,,,")).toBe("fr");
    expect(choisirLangue(undefined, "*")).toBe("fr");
  });
  it("un cookie invalide est ignoré", () => {
    expect(choisirLangue("xx", "en-US")).toBe("en");
    expect(choisirLangue("xx", "fr-CD")).toBe("fr");
    expect(choisirLangue("xx", undefined)).toBe("fr");
  });
});
