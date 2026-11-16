// Story 9.15 : familles « Vêtement » et « Autre article ». Données de test nommées TEST_ ; aucun appel réel.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cheminAutreLangue, cheminPublic, redirectionsAdresses } from "@/i18n/adresses";
import { construireAuteur } from "@/lib/auth/auteur";
import { couleursDistinctes, taillesPourCouleur } from "@/modules/catalogue/fiche";
import { analyserAdresseFiche } from "@/modules/catalogue/existence";
import { manquesPublication } from "@/modules/catalogue/publication";
import { lireProduit } from "@/modules/catalogue/schemas";
import {
  DOSSIER_PAR_FAMILLE,
  estFamillePhysique,
  estPhysique,
  FAMILLES_PHYSIQUES,
  FAMILLES_PRODUIT,
  taillesDeLaFamille,
  type EntreeProduit,
  type TailleFiche,
} from "@/modules/catalogue/types";
import { contenuAnnulable } from "@/modules/commande/annulable";
import { lireRecapitulatif } from "@/modules/commande/service";
import type { DependancesCommande, RecapBrut } from "@/modules/commande/types";
import { choisirPrestataire, type EntreeAiguillage } from "@/modules/paiement/aiguillage";
import type { Achat, CodePrestataire } from "@/modules/paiement/types";
import { ajouter, lire } from "@/modules/panier/service";
import type { DependancesPanier, LigneBrute } from "@/modules/panier/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";
const PANIER = "5b0e7b0e-6c1c-4c43-9c5e-7d6c2d1b8a11";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("familles : seul le Kit est numérique", () => {
  it("estPhysique et estFamillePhysique pour chaque famille, et pour une famille inconnue", () => {
    expect(FAMILLES_PRODUIT).toEqual(["cosplay", "accessoire", "vetement", "autre", "kit"]);
    for (const f of FAMILLES_PRODUIT) {
      expect(estFamillePhysique(f)).toBe(f !== "kit");
      expect(estPhysique(f)).toBe(f !== "kit");
    }
    expect(FAMILLES_PHYSIQUES).toEqual(["cosplay", "accessoire", "vetement", "autre"]);
    // Une famille inconnue n'est pas une famille physique connue (elle est refusée avant d'être écrite).
    expect(estPhysique("TEST_famille")).toBe(false);
  });

  it("une seule table des dossiers, et les adresses FR/EN des nouveaux catalogues", () => {
    expect(DOSSIER_PAR_FAMILLE.vetement).toBe("/vetements");
    expect(DOSSIER_PAR_FAMILLE.autre).toBe("/autres-articles");
    expect(cheminPublic("fr", "/vetements")).toBe("/vetements");
    expect(cheminPublic("en", "/vetements/polo-test")).toBe("/clothing/polo-test");
    expect(cheminPublic("en", "/autres-articles")).toBe("/other-items");
    expect(cheminAutreLangue("/clothing/x", "en", "fr")).toBe("/vetements/x");
    expect(redirectionsAdresses()).toContainEqual({ source: "/en/vetements/:chemin*", destination: "/en/clothing/:chemin*", permanent: true });
  });

  it("existence des fiches : l'adresse propre de chaque langue est reconnue", () => {
    expect(analyserAdresseFiche("/fr/vetements/polo-test")).toEqual({ locale: "fr", famille: "vetement", segment: "polo-test" });
    expect(analyserAdresseFiche("/en/clothing/polo-test")).toEqual({ locale: "en", famille: "vetement", segment: "polo-test" });
    expect(analyserAdresseFiche("/en/other-items/x")).toEqual({ locale: "en", famille: "autre", segment: "x" });
    expect(analyserAdresseFiche("/fr/autres-articles/x")).toEqual({ locale: "fr", famille: "autre", segment: "x" });
  });

  it("tailles proposées par famille : sur mesure pour un cosplay, « unique » pour un Autre article", () => {
    expect(taillesDeLaFamille("cosplay")).toContain("sur_mesure");
    expect(taillesDeLaFamille("vetement")).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
    expect(taillesDeLaFamille("accessoire")).not.toContain("unique");
    expect(taillesDeLaFamille("autre")).toEqual(["unique"]);
    expect(taillesDeLaFamille("kit")).toEqual([]);
  });
});

describe("aiguillage : un panier physique ne part jamais chez Polar", () => {
  const TOUS: CodePrestataire[] = ["pawapay", "maishapay", "polar"];
  const entree = (achat: Achat): EntreeAiguillage => ({ achat, moyen: "carte", pays: null, operateur: null, prestatairesActifs: TOUS, couverture: [], ordre: ["pawapay", "maishapay"], exclus: [] });
  it("Vêtement seul, Autre article seul, mixtes avec un Kit, Pass : MaishaPay", () => {
    for (const familles of [["vetement"], ["autre"], ["kit", "vetement"], ["autre", "kit"]] as const) {
      expect(choisirPrestataire(entree({ familles, estPass: false }))).toEqual({ statut: "ok", prestataire: "maishapay" });
    }
    expect(choisirPrestataire(entree({ familles: [], estPass: true }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("MaishaPay coupé : carte indisponible, jamais Polar", () => {
    const r = choisirPrestataire({ ...entree({ familles: ["vetement", "kit"], estPass: false }), prestatairesActifs: ["pawapay", "polar"] });
    expect(r).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
  });
});

const entreeProduit = (s: Partial<EntreeProduit>): EntreeProduit => ({
  id: "",
  famille: "vetement",
  slug: "polo-test",
  titreFr: "TEST_Polo",
  titreEn: "",
  descriptionFr: "",
  descriptionEn: "",
  universId: "",
  prix: "20",
  delai: "",
  variantes: [],
  ...s,
});

describe("lireProduit : Vêtement et Autre article", () => {
  it("Vêtement : tailles × couleurs, pastille mise en majuscules", () => {
    const r = lireProduit(
      entreeProduit({
        variantes: [
          { taille: "M", stock: "2", surCommande: false, delai: "", couleurFr: " Noir ", couleurEn: "Black", couleurHex: "#1b1713" },
          { taille: "M", stock: "0", surCommande: false, delai: "", couleurFr: "Blanc", couleurEn: "White", couleurHex: "" },
        ],
      }),
    );
    expect(r.ok && r.variantes).toEqual([
      { taille: "M", couleur_fr: "Noir", couleur_en: "Black", couleur_hex: "#1B1713", stock: 2, fabrication_sur_commande: false, delai_fabrication_jours: null },
      { taille: "M", couleur_fr: "Blanc", couleur_en: "White", couleur_hex: null, stock: 0, fabrication_sur_commande: false, delai_fabrication_jours: null },
    ]);
  });

  it("refus : couleur hors Vêtement, pastille mal formée, doublon taille × couleur, couleurs mélangées, sur mesure", () => {
    const v = (s: object) => ({ taille: "M", stock: "1", surCommande: false, delai: "", ...s });
    expect(lireProduit(entreeProduit({ famille: "accessoire", variantes: [v({ couleurFr: "Noir" })] }))).toMatchObject({ ok: false, erreur: "couleur_invalide" });
    expect(lireProduit(entreeProduit({ variantes: [v({ couleurFr: "Noir", couleurHex: "noir" })] }))).toMatchObject({ ok: false, erreur: "couleur_invalide", couleur: "Noir" });
    expect(lireProduit(entreeProduit({ variantes: [v({ couleurFr: "Noir" }), v({ couleurFr: "Noir" })] }))).toMatchObject({ ok: false, erreur: "taille_invalide" });
    // Deux orthographes d'une même couleur : refusées.
    expect(lireProduit(entreeProduit({ variantes: [v({ couleurFr: "Noir" }), v({ taille: "L", couleurFr: "noir" })] }))).toMatchObject({ ok: false, erreur: "couleur_invalide" });
    expect(lireProduit(entreeProduit({ variantes: [v({ couleurFr: "Noir" }), v({ taille: "L" })] }))).toMatchObject({ ok: false, erreur: "couleur_invalide" });
    expect(lireProduit(entreeProduit({ variantes: [v({ couleurFr: "Noir", couleurEn: "Black" }), v({ taille: "L", couleurFr: "Noir", couleurEn: "Dark" })] }))).toMatchObject({
      ok: false,
      erreur: "couleur_invalide",
    });
    expect(lireProduit(entreeProduit({ variantes: [v({ taille: "sur_mesure" })] }))).toMatchObject({ ok: false, erreur: "taille_invalide" });
    expect(lireProduit(entreeProduit({ variantes: [v({ couleurEn: "Black" })] }))).toMatchObject({ ok: false, erreur: "couleur_invalide" });
  });

  it("Vêtement sans couleur : variantes valides comme celles d'un accessoire", () => {
    const r = lireProduit(entreeProduit({ variantes: [{ taille: "L", stock: "3", surCommande: false, delai: "" }] }));
    expect(r.ok && r.variantes).toEqual([{ taille: "L", couleur_fr: null, couleur_en: null, couleur_hex: null, stock: 3, fabrication_sur_commande: false, delai_fabrication_jours: null }]);
  });

  it("Autre article sans taille : une variante « Taille unique » est créée ; une autre taille est refusée", () => {
    const r = lireProduit(entreeProduit({ famille: "autre" }));
    expect(r.ok && r.variantes).toEqual([{ taille: "unique", couleur_fr: null, couleur_en: null, couleur_hex: null, stock: 0, fabrication_sur_commande: false, delai_fabrication_jours: null }]);
    expect(lireProduit(entreeProduit({ famille: "autre", variantes: [{ taille: "M", stock: "1", surCommande: false, delai: "" }] }))).toMatchObject({ ok: false, erreur: "taille_invalide" });
    expect(lireProduit(entreeProduit({ famille: "cosplay", variantes: [{ taille: "unique", stock: "1", surCommande: false, delai: "" }] }))).toMatchObject({ ok: false, erreur: "taille_invalide" });
  });
});

describe("manques à la publication", () => {
  const base = { prixCents: 2000, titreEn: "t", descriptionFr: "d", descriptionEn: "e", nbPhotos: 1, nbVariantes: 2, famille: "vetement" as const };
  it("au moins une variante ; chaque couleur nommée en anglais", () => {
    expect(manquesPublication({ ...base, nbCouleursSansAnglais: 0 })).toEqual([]);
    expect(manquesPublication({ ...base, nbCouleursSansAnglais: 1 })).toEqual(["couleurs"]);
    expect(manquesPublication({ ...base, nbVariantes: 0 })).toEqual(["variante"]);
    expect(manquesPublication({ ...base, famille: "autre", nbVariantes: 1 })).toEqual([]);
  });
});

describe("fiche : couleurs et tailles d'un Vêtement", () => {
  const noir = { cle: "Noir", nom: "Black", hex: "#1B1713" };
  const blanc = { cle: "Blanc", nom: "White", hex: null };
  const tailles: TailleFiche[] = [
    { taille: "M", etat: "epuise", delaiJours: null, couleur: blanc },
    { taille: "M", etat: "disponible", delaiJours: null, couleur: noir },
    { taille: "L", etat: "epuise", delaiJours: null, couleur: blanc },
    { taille: "L", etat: "epuise", delaiJours: null, couleur: noir },
  ];
  it("couleurs sans doublon, tailles achetables dans au moins une couleur, état du couple choisi", () => {
    expect(couleursDistinctes(tailles).map((c) => c.cle)).toEqual(["Blanc", "Noir"]);
    expect(taillesPourCouleur(tailles, null)).toEqual([{ taille: "M", etat: "disponible", delaiJours: null, couleur: noir }]);
    expect(taillesPourCouleur(tailles, "Noir")).toEqual([{ taille: "M", etat: "disponible", delaiJours: null, couleur: noir }]);
    // Blanc : aucune taille ne s'achète dans cette couleur, aucune n'est proposée (jamais une taille d'une autre couleur).
    expect(taillesPourCouleur(tailles, "Blanc")).toEqual([]);
  });
});

describe("panier avec couleur", () => {
  function faux(s: Partial<DependancesPanier> = {}): DependancesPanier {
    return {
      lireCookie: vi.fn(async () => null),
      poserCookie: vi.fn(async () => undefined),
      effacerCookie: vi.fn(async () => undefined),
      accessible: vi.fn(async () => ({ accessible: true })),
      secret: () => "TEST_secret-du-panier-de-test-0123456789",
      compteId: vi.fn(async () => null),
      creerPanier: vi.fn(async () => ({ id: PANIER })),
      ajouter: vi.fn(async () => ({ erreur: null })),
      modifier: vi.fn(async () => ({ erreur: null })),
      retirer: vi.fn(async () => ({ erreur: null })),
      lire: vi.fn(async () => ({ lignes: [] as LigneBrute[] })),
      compter: vi.fn(async () => ({ nombre: 2 })),
      fusionner: vi.fn(async () => ({ panierId: null })),
      avis: vi.fn(async () => ({ avis: false })),
      ...s,
    };
  }

  it("la couleur part à la base avec la taille ; sans couleur, elle vaut null", async () => {
    const deps = faux();
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M", couleur: "Noir", nombre: 2 })).resolves.toEqual({ ok: true, nombre: 2 });
    expect(deps.ajouter).toHaveBeenCalledWith(expect.objectContaining({ produitId: PRODUIT, taille: "M", couleur: "Noir", nombre: 2 }));
    await ajouter(deps, { produitId: PRODUIT, taille: "unique", nombre: 1 });
    expect(deps.ajouter).toHaveBeenLastCalledWith(expect.objectContaining({ taille: "unique", couleur: null }));
  });

  it("couleur en jeu : le refus parle de la combinaison taille × couleur ; sans couleur, de la taille ; panier inchangé", async () => {
    const deps = faux({ ajouter: vi.fn(async () => ({ erreur: "KS_VARIANTE_INTROUVABLE" })) });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M", couleur: "TEST_Rose", nombre: 1 })).resolves.toEqual({ ok: false, erreur: "combinaison_inconnue" });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M", nombre: 1 })).resolves.toEqual({ ok: false, erreur: "taille" });
    const indispo = faux({ ajouter: vi.fn(async () => ({ erreur: "KS_INDISPONIBLE" })) });
    await expect(ajouter(indispo, { produitId: PRODUIT, taille: "M", couleur: "Noir", nombre: 1 })).resolves.toEqual({ ok: false, erreur: "combinaison_indisponible" });
    expect(deps.compter).not.toHaveBeenCalled();
  });

  it("lecture : la couleur de la langue de la page, repli sur le français ; famille vêtement reconnue", async () => {
    const ligne: LigneBrute = {
      ligne_id: "00000000-0000-4000-8000-0000000000cc",
      produit_id: PRODUIT,
      famille: "vetement",
      slug: "polo-test",
      titre_fr: "TEST_Polo",
      titre_en: null,
      taille: "M",
      nombre: 2,
      prix_cents: 2000,
      etat: "disponible",
      delai_jours: null,
      couleur_fr: "Noir",
      couleur_en: "Black",
    };
    const { signerPanier } = await import("@/lib/panier/cookie");
    const deps = faux({ lireCookie: vi.fn(async () => signerPanier(PANIER, "TEST_secret-du-panier-de-test-0123456789")), lire: vi.fn(async () => ({ lignes: [ligne, { ...ligne, famille: "autre", taille: "unique", couleur_fr: null, couleur_en: null }] })) });
    const en = await lire(deps, "en");
    expect(en?.lignes.map((l) => [l.famille, l.taille, l.couleur])).toEqual([
      ["vetement", "M", "Black"],
      ["autre", "unique", null],
    ]);
    expect(en?.sousTotalCents).toBe(8000);
    const fr = await lire(deps, "fr");
    expect(fr?.lignes[0].couleur).toBe("Noir");
  });
});

describe("récapitulatif avec couleur", () => {
  it("les lignes Vêtement et Autre article sont gardées, avec la couleur", async () => {
    const recap: RecapBrut = {
      lignes: [
        { ligne_id: "l1", produit_id: PRODUIT, famille: "vetement", slug: "polo-test", titre_fr: "TEST_Polo", titre_en: null, taille: "M", couleur_fr: "Noir", couleur_en: "Black", nombre: 2, prix_cents: 2000, etat: "disponible", origine: "stock", delai_fabrication_jours: null },
        { ligne_id: "l2", produit_id: PRODUIT, famille: "autre", slug: "objet-test", titre_fr: "TEST_Objet", titre_en: null, taille: "unique", nombre: 1, prix_cents: 1000, etat: "disponible", origine: "stock", delai_fabrication_jours: null },
      ],
      physique: true,
      kit: false,
      sur_mesure: false,
      sous_total_cents: 5000,
      forfait_cents: 500,
      total_cents: 5500,
      indisponible: false,
      remise_manquante: false,
      empreinte: "0123456789abcdef0123456789abcdef",
    };
    const deps = {
      exigerCompte: vi.fn(async () => ({ compteId: "TEST_compte", auteur: construireAuteur("TEST_compte") })),
      panierDuCompte: vi.fn(async () => PANIER),
      recapitulatif: vi.fn(async () => ({ recap })),
      creerCommande: vi.fn(async () => ({ erreur: "x" })),
      offrirCommande: vi.fn(async () => ({ erreur: null, numero: "KS-2026-000001" })),
      donnerConsentementEmails: vi.fn(async () => undefined),
    } as unknown as DependancesCommande;
    const r = await lireRecapitulatif(deps, { zone: "goma", mode: "retrait" }, "en");
    expect(r.ok && r.recap.lignes.map((l) => [l.famille, l.taille, l.couleur])).toEqual([
      ["vetement", "M", "Black"],
      ["autre", "unique", null],
    ]);
  });
});

describe("annulation (décision 10)", () => {
  it("Cosplay (en stock compris) ou ligne physique fabriquée sur commande ; jamais des articles en stock seuls ni un Kit", () => {
    expect(contenuAnnulable([{ famille: "cosplay", origine: "stock" }])).toBe(true);
    for (const famille of ["accessoire", "vetement", "autre"]) {
      expect(contenuAnnulable([{ famille, origine: "fabrication" }])).toBe(true);
      expect(contenuAnnulable([{ famille, origine: "stock" }])).toBe(false);
    }
    expect(contenuAnnulable([{ famille: "kit", origine: null }])).toBe(false);
    expect(contenuAnnulable([{ famille: "kit", origine: null }, { famille: "vetement", origine: "stock" }])).toBe(false);
    expect(contenuAnnulable([{ famille: "kit", origine: null }, { famille: "autre", origine: "fabrication" }])).toBe(true);
  });
});

describe("libellés de disponibilité : jamais « Épuisé » (C-4)", () => {
  it("aucune clé de disponibilité ne dit « Épuisé » ou « Sold out » ; stock à zéro et capacité atteinte ont chacun leur libellé (2026-11-16)", async () => {
    const fr = (await import("../../messages/fr.json")).default;
    const en = (await import("../../messages/en.json")).default;
    for (const m of [fr, en]) {
      const textes = [...Object.values(m.Catalogue.disponibilite), ...Object.values(m.Fiche.tailles), ...Object.values(m.Admin.produits.grille.stock)];
      expect(textes.filter((t) => /épuisé|sold out/i.test(String(t)))).toEqual([]);
      // Même libellé sur la carte et sur la fiche, distinct de « Commandes complètes ».
      expect(m.Fiche.tailles.epuise).toBe(m.Catalogue.disponibilite.epuise);
      expect(m.Catalogue.disponibilite.epuise).not.toBe(m.Catalogue.disponibilite.complet);
    }
    expect(fr.Catalogue.disponibilite.epuise).toBe("Plus en stock pour le moment");
    expect(en.Catalogue.disponibilite.epuise).toBe("Out of stock for now");
    expect(fr.Catalogue.disponibilite.complet).toBe("Commandes complètes pour le moment");
    // Capacité atteinte : même libellé sur la carte et sur la fiche, en français comme en anglais.
    for (const m of [fr, en]) expect(m.Fiche.tailles.complet).toBe(m.Catalogue.disponibilite.complet);
    expect(en.Fiche.tailles.complet).toBe("Orders full for now");
  });
});

describe("JSON-LD et identifiants de variantes", () => {
  it("color n'est émis que pour une seule couleur", async () => {
    const { produitJsonLd } = await import("@/lib/seo/jsonld");
    const base = { nom: "TEST_Polo", description: "d", images: [], url: "u", langue: "fr", prixCents: 2000, disponibilite: "https://schema.org/InStock" };
    expect(produitJsonLd({ ...base, couleurs: ["Noir"] })).toMatchObject({ color: "Noir" });
    expect("color" in produitJsonLd({ ...base, couleurs: ["Noir", "Blanc"] })).toBe(false);
    expect("color" in produitJsonLd(base)).toBe(false);
  });

  it("l'identifiant d'une variante existante part à la base (mise à jour sur place) ; un identifiant mal formé est refusé", () => {
    const id = "00000000-0000-4000-8000-00000000a001";
    const r = lireProduit(entreeProduit({ variantes: [{ id, taille: "M", stock: "1", surCommande: false, delai: "", couleurFr: "Gris", couleurEn: "Grey" }] }));
    expect(r.ok && r.variantes[0]).toMatchObject({ id, taille: "M", couleur_fr: "Gris" });
    expect(lireProduit(entreeProduit({ variantes: [{ id: "TEST_pas-un-uuid", taille: "M", stock: "1", surCommande: false, delai: "" }] }))).toMatchObject({ ok: false, erreur: "taille_invalide" });
  });
});
