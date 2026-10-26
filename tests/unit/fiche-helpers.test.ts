import { describe, expect, it } from "vitest";
import { capaciteAtteinte, disponibiliteSchema, taillesChoisissables, tronquerDescription } from "@/modules/catalogue/fiche";
import type { TailleFiche } from "@/modules/catalogue/types";

const t = (taille: TailleFiche["taille"], etat: TailleFiche["etat"], delaiJours: number | null = null): TailleFiche => ({ taille, etat, delaiJours });

describe("tailles de la fiche", () => {
  it("seules les tailles en stock ou fabriquées sur commande sont proposées", () => {
    const tailles = [t("S", "en_stock"), t("M", "sur_commande", 12), t("L", "complet"), t("XL", "indisponible")];
    expect(taillesChoisissables(tailles).map((x) => x.taille)).toEqual(["S", "M"]);
  });

  it("capacité atteinte dès qu'une taille est « complet »", () => {
    expect(capaciteAtteinte([t("S", "en_stock"), t("M", "complet")])).toBe(true);
    expect(capaciteAtteinte([t("S", "en_stock"), t("M", "indisponible")])).toBe(false);
  });

  it("aucune taille choisissable quand tout est complet", () => {
    expect(taillesChoisissables([t("sur_mesure", "complet")])).toEqual([]);
  });
});

describe("disponibilité schema.org", () => {
  it("InStock, MadeToOrder, OutOfStock", () => {
    expect(disponibiliteSchema([t("S", "en_stock"), t("M", "sur_commande")])).toBe("https://schema.org/InStock");
    expect(disponibiliteSchema([t("S", "indisponible"), t("M", "sur_commande")])).toBe("https://schema.org/MadeToOrder");
    expect(disponibiliteSchema([t("S", "complet")])).toBe("https://schema.org/OutOfStock");
    expect(disponibiliteSchema([])).toBe("https://schema.org/OutOfStock");
  });
});

describe("description des métadonnées", () => {
  it("texte court : gardé, espaces simplifiés", () => {
    expect(tronquerDescription("  Un   costume\nfait main.  ")).toBe("Un costume fait main.");
  });

  it("texte long : coupé à la fin d'un mot avec « … », 160 caractères au plus", () => {
    const long = "mot ".repeat(100);
    const court = tronquerDescription(long) ?? "";
    expect(court.length).toBeLessThanOrEqual(160);
    expect(court.endsWith("…")).toBe(true);
    expect(court).not.toMatch(/\s…$/);
    expect(court.replace("…", "").trim().split(" ").every((m) => m === "mot")).toBe(true);
  });

  it("jamais le marqueur « [Texte à fournir] », ni un texte vide", () => {
    expect(tronquerDescription("Début [Texte à fournir]")).toBeNull();
    expect(tronquerDescription("   ")).toBeNull();
    expect(tronquerDescription(null)).toBeNull();
  });
});
