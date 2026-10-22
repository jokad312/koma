import { describe, expect, it } from "vitest";
import { DROITS, DROITS_ASSISTANT, droitAutorise, type Droit } from "@/lib/auth/matrice-droits";

// Droits de l'Assistant (FR-53), écrits en toutes lettres : la matrice ne doit jamais s'élargir sans que ce test change.
const ACCORDES_ASSISTANT: Droit[] = [
  "commandes.voir",
  "commandes.changer_statut",
  "mesures.verifier",
  "galerie.valider",
  "blog.gerer",
  "evenements.gerer",
  "remboursement.preparer",
  "activite.propre",
];

// Interdits de l'Assistant (FR-53) : produits et prix, codes promo et commissions, prestataires, chiffre d'affaires et
// graphiques de paiement, accès bénévoles, validation de remboursement, réglages, rôles ; et l'accès à l'écran admin au lancement.
const INTERDITS_ASSISTANT: Droit[] = [
  "produits.modifier",
  "prix.modifier",
  "codes_promo.gerer",
  "commissions.gerer",
  "prestataires.gerer",
  "chiffre_affaires.voir",
  "paiements.graphiques",
  "benevoles.acces",
  "remboursement.valider",
  "reglages.modifier",
  "roles.gerer",
  "age.corriger",
  "admin.acceder",
];

describe("matrice des droits", () => {
  it("l'admin a tous les droits", () => {
    for (const droit of DROITS) expect(droitAutorise("admin", droit), droit).toBe(true);
  });

  it("l'assistant a exactement les droits de FR-53", () => {
    expect([...DROITS_ASSISTANT].sort()).toEqual([...ACCORDES_ASSISTANT].sort());
    for (const droit of ACCORDES_ASSISTANT) expect(droitAutorise("assistant", droit), droit).toBe(true);
  });

  it("l'assistant n'a aucun de ses interdits", () => {
    for (const droit of INTERDITS_ASSISTANT) expect(droitAutorise("assistant", droit), droit).toBe(false);
  });

  it("chaque droit est soit accordé soit interdit à l'assistant : rien n'est oublié", () => {
    expect([...ACCORDES_ASSISTANT, ...INTERDITS_ASSISTANT].sort()).toEqual([...DROITS].sort());
  });

  it("le bénévole et un Compte sans rôle n'ont aucun droit admin", () => {
    for (const droit of DROITS) {
      expect(droitAutorise("benevole", droit), droit).toBe(false);
      expect(droitAutorise(null, droit), droit).toBe(false);
    }
  });

  it("refus par défaut : un droit inconnu ou un rôle inconnu n'est jamais accordé", () => {
    expect(droitAutorise("admin", "inconnu" as Droit)).toBe(false);
    expect(droitAutorise("assistant", "inconnu" as Droit)).toBe(false);
    expect(droitAutorise("roi" as never, "commandes.voir")).toBe(false);
  });
});
