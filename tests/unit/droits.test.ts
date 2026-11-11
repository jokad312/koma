import { describe, expect, it } from "vitest";
import { DROITS, DROITS_ASSISTANT, droitAutorise, type Droit } from "@/lib/auth/matrice-droits";

// Droits de l'Assistant (FR-53), écrits en toutes lettres : la matrice ne doit jamais s'élargir sans que ce test change.
const ACCORDES_ASSISTANT: Droit[] = [
  "commandes.voir",
  "commandes.changer_statut",
  "mesures.verifier",
  "galerie.valider",
  "blog.gerer",
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
  "messages.traiter",
  "admin.acceder",
  // Décision de Jonathan du 2026-11-10 : les Événements restent à l'Admin seul pour l'instant (écart avec FR-53, noté dans deferred-work.md).
  "evenements.gerer",
  // Story 7.6 : le Scan est à l'Admin seul dans la matrice. Le bénévole (story 7.7) ne l'obtient PAS par la matrice : seulement par son accès par Événement.
  "pass.scanner",
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

  it("story 7.7 : « pass.scanner » reste réservé à l'Admin dans la matrice ; le bénévole ne le tient que d'un accès par Événement (base)", () => {
    expect(droitAutorise("admin", "pass.scanner")).toBe(true);
    expect(droitAutorise("assistant", "pass.scanner")).toBe(false);
    expect(droitAutorise("benevole", "pass.scanner")).toBe(false);
    expect(droitAutorise(null, "pass.scanner")).toBe(false);
    // Donner ou retirer un accès bénévole est un droit de l'Admin seul.
    expect(droitAutorise("assistant", "benevoles.acces")).toBe(false);
    expect(droitAutorise("benevole", "benevoles.acces")).toBe(false);
  });

  it("refus par défaut : un droit inconnu ou un rôle inconnu n'est jamais accordé", () => {
    expect(droitAutorise("admin", "inconnu" as Droit)).toBe(false);
    expect(droitAutorise("assistant", "inconnu" as Droit)).toBe(false);
    expect(droitAutorise("roi" as never, "commandes.voir")).toBe(false);
  });
});
