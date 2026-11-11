import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { annulerEnvoiImage, changerPublication, demanderEnvoiImage, enregistrerEvenement, finaliserImage } from "@/modules/evenements/service";
import type { EntreeEvenement, EntreeType } from "@/modules/evenements/types";
import { creerTestDependancesEvenements } from "../doubles/TEST_dependances-evenements";

const UUID = "11111111-1111-4111-8111-111111111111";
const OBJET = `evenements/${UUID}.jpg`;

const TYPE: EntreeType = { id: null, nomFr: "TEST_Standard", nomEn: null, prixUsd: "15,50", quota: null, inclusFr: null, inclusEn: null, estStand: false };
const EVENEMENT: EntreeEvenement = {
  titreFr: "TEST_Festival de test",
  titreEn: null,
  slug: null,
  descriptionFr: null,
  descriptionEn: null,
  lieuType: null,
  lieuFr: null,
  lieuEn: null,
  debut: null,
  fin: null,
  venteOuvre: null,
  venteFerme: null,
  capacite: null,
  images: [],
  types: [],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function jpeg(): Promise<Uint8Array> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
}

describe("enregistrerEvenement", () => {
  it("création : droit evenements.gerer, écriture puis invalidation du cache, cree vrai", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    expect(await enregistrerEvenement(deps, { id: null, evenement: EVENEMENT })).toEqual({ ok: true, id: "TEST_evenement-0001", cree: true });
    expect(appels.droits).toEqual(["evenements.gerer"]);
    expect(appels.ordre).toEqual(["droit", "evenement", "invalidation"]);
    expect(appels.ordre).not.toContain("lireImages");
  });

  it("rien n'est écrit en dur : aucun Type de pass, aucune date, aucune capacité n'est ajouté par le service", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    await enregistrerEvenement(deps, { id: null, evenement: EVENEMENT });
    expect(appels.evenements[0].types).toEqual([]);
    expect(appels.evenements[0].evenement).toMatchObject({ debut_le: null, fin_le: null, vente_ouvre_le: null, vente_ferme_le: null, capacite: null, lieu_type: null });
  });

  it("adresse vide : déduite du titre ; dates saisies à l'heure de Goma (+02:00)", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    const evenement = { ...EVENEMENT, titreFr: "Festival d'été à Goma", debut: "2027-03-14T10:00", fin: "2027-03-14T22:30", venteOuvre: "2027-01-01T08:00", venteFerme: "2027-03-13T18:00" };
    expect(await enregistrerEvenement(deps, { id: null, evenement })).toMatchObject({ ok: true });
    expect(appels.evenements[0].evenement).toMatchObject({
      slug: "festival-d-ete-a-goma",
      debut_le: "2027-03-14T10:00:00+02:00",
      fin_le: "2027-03-14T22:30:00+02:00",
      vente_ouvre_le: "2027-01-01T08:00:00+02:00",
      vente_ferme_le: "2027-03-13T18:00:00+02:00",
    });
  });

  it("Types de pass : prix converti en centimes, Stand et quota transmis, ordre conservé", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    const types: EntreeType[] = [
      { ...TYPE, prixUsd: "15,50", quota: "200" },
      { ...TYPE, nomFr: "TEST_Stand", prixUsd: "120", quota: "10", estStand: true },
      { ...TYPE, nomFr: "TEST_Offert", prixUsd: "0" },
    ];
    expect(await enregistrerEvenement(deps, { id: null, evenement: { ...EVENEMENT, types } })).toMatchObject({ ok: true });
    const envoyes = appels.evenements[0].types as Array<Record<string, unknown>>;
    expect(envoyes.map((t) => [t.nom_fr, t.prix_cents, t.quota, t.est_stand])).toEqual([
      ["TEST_Standard", 1550, "200", false],
      ["TEST_Stand", 12000, "10", true],
      ["TEST_Offert", 0, null, false],
    ]);
  });

  it.each([
    ["prix négatif", { prixUsd: "-3" }, "prix_invalide"],
    ["prix à trois décimales", { prixUsd: "1,234" }, "prix_invalide"],
    ["prix vide", { prixUsd: "" }, "prix_invalide"],
    ["quota zéro", { quota: "0" }, "quota_invalide"],
    ["quota non numérique", { quota: "beaucoup" }, "quota_invalide"],
    ["nom français vide", { nomFr: "  " }, "type_pass_invalide"],
  ] as const)("Type de pass refusé avant toute écriture : %s", async (_nom, partiel, erreur) => {
    const { deps, appels } = creerTestDependancesEvenements();
    const evenement = { ...EVENEMENT, types: [{ ...TYPE, ...partiel }] };
    expect(await enregistrerEvenement(deps, { id: null, evenement })).toEqual({ ok: false, erreur });
    expect(appels.evenements).toHaveLength(0);
  });

  it.each([
    ["date mal écrite", { debut: "14/03/2027" }, "date_invalide"],
    ["capacité zéro", { capacite: "0" }, "capacite_invalide"],
    ["capacité non numérique", { capacite: "grande" }, "capacite_invalide"],
    ["lieu de type inconnu", { lieuType: "jardin" as never }, "lieu_invalide"],
    ["titre vide", { titreFr: "   " }, "titre_invalide"],
    ["adresse mal formée", { slug: "Mon Festival" }, "slug_invalide"],
  ] as const)("refusé avant toute écriture : %s", async (_nom, partiel, erreur) => {
    const { deps, appels } = creerTestDependancesEvenements();
    expect(await enregistrerEvenement(deps, { id: null, evenement: { ...EVENEMENT, ...partiel } })).toEqual({ ok: false, erreur });
    expect(appels.evenements).toHaveLength(0);
  });

  it("titre sans lettre latine et sans adresse : slug_invalide", async () => {
    const { deps } = creerTestDependancesEvenements();
    expect(await enregistrerEvenement(deps, { id: null, evenement: { ...EVENEMENT, titreFr: "!!! ???" } })).toEqual({ ok: false, erreur: "slug_invalide" });
  });

  it("refus du droit : rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependancesEvenements({ droit: "KS_DROIT_REFUSE" });
    await expect(enregistrerEvenement(deps, { id: null, evenement: EVENEMENT })).rejects.toThrow();
    expect(appels.evenements).toHaveLength(0);
  });

  it.each([
    ["KS_SLUG_PRIS", "slug_pris"],
    ["KS_DATE_INVALIDE", "date_invalide"],
    ["KS_TYPE_PASS_INTROUVABLE", "type_pass_introuvable"],
    ["KS_TYPE_PASS_VENDU", "type_pass_vendu"],
    ["KS_EVENEMENT_INTROUVABLE", "evenement_introuvable"],
    ["23505", "generique"],
  ])("refus de la base %s : %s, cache non invalidé", async (code, erreur) => {
    const { deps, appels } = creerTestDependancesEvenements({ erreurEvenement: code });
    expect(await enregistrerEvenement(deps, { id: null, evenement: EVENEMENT })).toEqual({ ok: false, erreur });
    expect(appels.invalidations).toBe(0);
  });

  it("identifiant mal formé : evenement_introuvable, aucune écriture", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    expect(await enregistrerEvenement(deps, { id: "../../x", evenement: EVENEMENT })).toEqual({ ok: false, erreur: "evenement_introuvable" });
    expect(appels.evenements).toHaveLength(0);
  });

  it("modification : une photo retirée est effacée du bucket public APRÈS l'écriture, une photo gardée jamais", async () => {
    const a = `evenements/${"a".repeat(8)}-aaaa-4aaa-8aaa-${"a".repeat(12)}.jpg`;
    const b = `evenements/${"b".repeat(8)}-bbbb-4bbb-8bbb-${"b".repeat(12)}.jpg`;
    const { deps, appels } = creerTestDependancesEvenements({
      imagesExistantes: [
        { fichier: a, altFr: "A", altEn: "A" },
        { fichier: b, altFr: "B", altEn: "B" },
      ],
    });
    const evenement = { ...EVENEMENT, images: [{ fichier: b, altFr: "B", altEn: "B" }] };
    expect(await enregistrerEvenement(deps, { id: UUID, evenement })).toMatchObject({ ok: true, cree: false });
    expect(appels.suppressions).toEqual([{ bucket: "produits-public", objet: a }]);
    expect(appels.ordre.indexOf("evenement")).toBeLessThan(appels.ordre.indexOf(`supprimer:produits-public`));
  });

  it("une image dont le chemin n'est pas evenements/<uuid>.<ext> est refusée", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    const evenement = { ...EVENEMENT, images: [{ fichier: "articles/x.jpg", altFr: "A", altEn: "A" }] };
    expect(await enregistrerEvenement(deps, { id: null, evenement })).toEqual({ ok: false, erreur: "evenement_invalide" });
    expect(appels.evenements).toHaveLength(0);
  });
});

describe("changerPublication", () => {
  it("publie : droit puis écriture puis invalidation", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    expect(await changerPublication(deps, { id: UUID, publier: true })).toEqual({ ok: true, id: UUID });
    expect(appels.droits).toEqual(["evenements.gerer"]);
    expect(appels.publications[0]).toMatchObject({ id: UUID, publier: true });
    expect(appels.invalidations).toBe(1);
  });

  it("refus de publication : la liste des manques de la base est rendue, seules les clés connues passent", async () => {
    const { deps, appels } = creerTestDependancesEvenements({ erreurPublication: "KS_PUBLICATION_INCOMPLETE:titre_en,photo,type_pass,inconnue" });
    expect(await changerPublication(deps, { id: UUID, publier: true })).toEqual({ ok: false, erreur: "publication_incomplete", manques: ["titre_en", "photo", "type_pass"] });
    expect(appels.invalidations).toBe(0);
  });

  it("identifiant mal formé : evenement_introuvable", async () => {
    const { deps } = creerTestDependancesEvenements();
    expect(await changerPublication(deps, { id: "pas-un-uuid", publier: true })).toEqual({ ok: false, erreur: "evenement_introuvable" });
  });
});

describe("images", () => {
  it("demanderEnvoiImage : chemin evenements/<uuid>.<ext> choisi par le serveur ; format et poids contrôlés", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    const r = await demanderEnvoiImage(deps, { type: "image/png", taille: 1000 });
    expect(r.ok && /^evenements\/[0-9a-f-]{36}\.png$/.test(r.objet)).toBe(true);
    expect(appels.signatures).toHaveLength(1);
    expect(await demanderEnvoiImage(deps, { type: "image/gif", taille: 1000 })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await demanderEnvoiImage(deps, { type: "image/png", taille: 16 * 1024 * 1024 })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await demanderEnvoiImage(deps, { type: "constructor", taille: 10 })).toEqual({ ok: false, erreur: "format_invalide" });
  });

  it("finaliserImage : image valide copiée en public, original d'attente effacé", async () => {
    const { deps, appels } = creerTestDependancesEvenements({ octetsAttente: await jpeg() });
    const r = await finaliserImage(deps, { objet: OBJET, altFr: "Photo", altEn: "Photo EN" });
    expect(r).toMatchObject({ ok: true, altFr: "Photo", altEn: "Photo EN" });
    expect(r.ok && /^evenements\//.test(r.fichier)).toBe(true);
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objet: OBJET }]);
  });

  it("finaliserImage : contenu qui n'est pas une image → format_invalide, rien d'écrit en public", async () => {
    const { deps, appels } = creerTestDependancesEvenements({ octetsAttente: new TextEncoder().encode("<html>pas une image</html>") });
    expect(await finaliserImage(deps, { objet: OBJET, altFr: "Photo", altEn: "Photo" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.ecritsPublics).toHaveLength(0);
  });

  it("finaliserImage : texte alternatif vide ou chemin étranger refusés", async () => {
    const { deps } = creerTestDependancesEvenements({ octetsAttente: await jpeg() });
    expect(await finaliserImage(deps, { objet: OBJET, altFr: " ", altEn: "ok" })).toEqual({ ok: false, erreur: "alt_invalide" });
    expect(await finaliserImage(deps, { objet: `articles/${UUID}.jpg`, altFr: "a", altEn: "a" })).toEqual({ ok: false, erreur: "format_invalide" });
  });

  it("annulerEnvoiImage : efface l'objet d'attente seulement", async () => {
    const { deps, appels } = creerTestDependancesEvenements();
    expect(await annulerEnvoiImage(deps, { objet: OBJET })).toEqual({ ok: true });
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objet: OBJET }]);
    expect(await annulerEnvoiImage(deps, { objet: "evenements/../secret.jpg" })).toEqual({ ok: false, erreur: "format_invalide" });
  });
});
