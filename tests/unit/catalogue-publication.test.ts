import { describe, expect, it } from "vitest";
import { manquesPublication } from "@/modules/catalogue/publication";

const complet = { prixCents: 4990, titreEn: "T", descriptionFr: "D", descriptionEn: "E", nbPhotos: 1, nbVariantes: 1 };

describe("manquesPublication", () => {
  it("produit complet : rien ne manque", () => {
    expect(manquesPublication(complet)).toEqual([]);
  });

  it("brouillon vide : tout manque, dans l'ordre d'affichage", () => {
    expect(manquesPublication({ prixCents: null, titreEn: null, descriptionFr: null, descriptionEn: null, nbPhotos: 0, nbVariantes: 0 })).toEqual([
      "prix",
      "photo",
      "description_fr",
      "variante",
    ]);
  });

  it.each([
    [{ prixCents: null }, ["prix"]],
    [{ nbPhotos: 0 }, ["photo"]],
    [{ descriptionFr: "" }, ["description_fr"]],
    [{ nbVariantes: 0 }, ["variante"]],
  ])("un seul manque %#", (partiel, attendu) => {
    expect(manquesPublication({ ...complet, ...partiel })).toEqual(attendu);
  });

  it("site en français uniquement (2026-11-22) : aucun texte anglais n'est exigé", () => {
    expect(manquesPublication({ ...complet, titreEn: null, descriptionEn: null, nbCouleursSansAnglais: 2 })).toEqual([]);
  });
});

describe("manquesPublication d'un Kit (story 3.2)", () => {
  const kit = {
    famille: "kit" as const,
    prixCents: 0,
    titreFr: "Kit",
    titreEn: "Kit",
    descriptionFr: "D",
    descriptionEn: "D",
    materielFr: "Mousse",
    materielEn: "Foam",
    niveau: "debutant" as const,
    nbPhotos: 1,
    nbVariantes: 0,
    nbFichiers: 1,
    videoPrete: true,
    sousTitresFr: true,
  };

  it("Kit complet sans variante, sans sous-titres anglais ni extrait : rien ne manque (prix 0 admis)", () => {
    expect(manquesPublication(kit)).toEqual([]);
  });

  it("Kit sans vidéo ni sous-titres FR : video, sous_titres_fr", () => {
    expect(manquesPublication({ ...kit, videoPrete: false, sousTitresFr: false })).toEqual(["video", "sous_titres_fr"]);
  });

  it("Kit vide : tous les manques du Kit, dans l'ordre d'affichage", () => {
    expect(
      manquesPublication({ famille: "kit", prixCents: null, titreFr: " ", titreEn: null, descriptionFr: null, descriptionEn: null, nbPhotos: 0, nbVariantes: 0 }),
    ).toEqual(["prix", "photo", "titre_fr", "description_fr", "materiel_fr", "niveau", "fichier", "video", "sous_titres_fr"]);
  });

  it.each([
    [{ materielEn: "", titreEn: null, descriptionEn: null }, []],
    [{ niveau: null }, ["niveau"]],
    [{ nbFichiers: 0 }, ["fichier"]],
    [{ nbPhotos: 0 }, ["photo"]],
  ])("un seul manque %#", (partiel, attendu) => {
    expect(manquesPublication({ ...kit, ...partiel })).toEqual(attendu);
  });
});
