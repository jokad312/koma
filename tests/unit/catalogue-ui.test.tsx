// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  creerUnivers: vi.fn(),
  enregistrerProduit: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  creerUnivers: (...a: unknown[]) => faux.creerUnivers(...a),
  enregistrerProduit: (...a: unknown[]) => faux.enregistrerProduit(...a),
}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: faux.refresh }) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push, refresh: faux.refresh }),
  usePathname: () => "/admin/produits",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return {
    getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages, namespace: namespace as never }),
    getLocale: async () => "fr",
  };
});

import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { FormulaireUnivers } from "@/components/admin/FormulaireUnivers";
import type { ProduitAdmin } from "@/modules/catalogue/types";

beforeEach(() => vi.clearAllMocks());

const UNIVERS = [
  { id: "TEST_univers-1", nomFr: "Univers de test A", nomEn: "Test universe A" },
  { id: "TEST_univers-2", nomFr: "Univers de test B", nomEn: "Test universe B" },
];

// ListeProduits (refonte 9.16 e) : tests/unit/produits-admin-liste.test.tsx.

describe("FormulaireUnivers", () => {
  async function remplir(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Nom"), "Univers FR");
  }

  it("site en français uniquement (2026-11-22) : aucun champ anglais", () => {
    rendre(<FormulaireUnivers />);
    expect(screen.queryByLabelText("Nom en anglais")).toBeNull();
  });

  it("le succès n'apparaît qu'après la réponse réelle ; la liste est relue puis les champs vidés", async () => {
    let repondre: (v: unknown) => void = () => {};
    faux.creerUnivers.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    const user = userEvent.setup();
    rendre(<FormulaireUnivers />);
    await remplir(user);
    await user.click(screen.getByRole("button", { name: "Créer l'univers" }));

    expect(await screen.findByRole("button", { name: "Création…" })).toBeTruthy();
    expect(screen.queryByText("Univers créé.")).toBeNull();
    expect(faux.creerUnivers).toHaveBeenCalledWith({ nomFr: "Univers FR", nomEn: "" });

    await act(async () => repondre({ statut: "succes" }));
    expect(await screen.findByText("Univers créé.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
    expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("");
  });

  it("erreur de champ : message sous le champ relié par aria-describedby, saisie conservée, focus sur le résumé, aucun succès", async () => {
    faux.creerUnivers.mockResolvedValue({ statut: "erreur", erreur: "nom_invalide", champ: "nom_fr" });
    const user = userEvent.setup();
    rendre(<FormulaireUnivers />);
    await remplir(user);
    await user.click(screen.getByRole("button", { name: "Créer l'univers" }));

    const alertes = await screen.findAllByRole("alert");
    expect(alertes[0].textContent).toContain("Il y a une erreur à corriger");
    const champ = screen.getByLabelText("Nom") as HTMLInputElement;
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const erreur = screen.getByText("Le nom doit avoir de 1 à 60 caractères.");
    expect(champ.getAttribute("aria-describedby")).toContain(erreur.id);
    expect(champ.value).toBe("Univers FR");
    expect(screen.queryByText("Univers créé.")).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("erreur visant le nom anglais (sans champ, copie du français) : montrée sous le nom français", async () => {
    faux.creerUnivers.mockResolvedValue({ statut: "erreur", erreur: "nom_invalide", champ: "nom_en" });
    const user = userEvent.setup();
    rendre(<FormulaireUnivers />);
    await remplir(user);
    await user.click(screen.getByRole("button", { name: "Créer l'univers" }));
    await screen.findAllByRole("alert");
    const champ = screen.getByLabelText(/^Nom/) as HTMLInputElement;
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toContain(screen.getByText("Le nom doit avoir de 1 à 60 caractères.").id);
  });

  it("nom_invalide sans champ : message propre, pas le message générique", async () => {
    faux.creerUnivers.mockResolvedValue({ statut: "erreur", erreur: "nom_invalide" });
    const user = userEvent.setup();
    rendre(<FormulaireUnivers />);
    await remplir(user);
    await user.click(screen.getByRole("button", { name: "Créer l'univers" }));
    expect((await screen.findAllByText("Le nom doit avoir de 1 à 60 caractères."))[0]).toBeTruthy();
    expect(screen.queryByText(/n'a pas pu être créé/)).toBeNull();
  });

  it("doublon et échec serveur : message, saisie conservée, aucun succès", async () => {
    faux.creerUnivers.mockResolvedValueOnce({ statut: "erreur", erreur: "univers_existe" });
    const user = userEvent.setup();
    rendre(<FormulaireUnivers />);
    await remplir(user);
    await user.click(screen.getByRole("button", { name: "Créer l'univers" }));
    expect(await screen.findByText(/Un univers porte déjà ce nom/, undefined, { timeout: 8000 })).toBeTruthy();

    faux.creerUnivers.mockRejectedValueOnce(new Error("TEST_reseau"));
    await user.click(screen.getByRole("button", { name: "Créer l'univers" }));
    expect(await screen.findByText(/n'a pas pu être créé/, undefined, { timeout: 8000 })).toBeTruthy();
    expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Univers FR");
    expect(screen.queryByText("Univers créé.")).toBeNull();
  });
});

describe("FormulaireProduit", () => {
  const brouillon: ProduitAdmin = {
    id: "00000000-0000-4000-8000-0000000000bb",
    famille: "cosplay",
    slug: "test-cosplay",
    titreFr: "TEST_Cosplay",
    titreEn: null,
    descriptionFr: null,
    descriptionEn: null,
    universId: "TEST_univers-2",
    prixCents: 4990,
    delaiFabricationJours: 14,
    publieLe: null,
    variantes: [{ id: "00000000-0000-4000-8000-00000000a001", taille: "M", stock: 2, fabricationSurCommande: false, delaiFabricationJours: null, couleur: null }],
    photos: [],
    materielFr: null,
    materielEn: null,
    niveau: null,
    produitLieId: null,
    fichiers: [],
    video: null,
    chapitres: [],
    sousTitres: [],
  };

  it("création : adresse proposée depuis le titre français tant qu'elle n'est pas modifiée à la main", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} />);
    const slug = screen.getByLabelText("Adresse du produit") as HTMLInputElement;
    await user.type(screen.getByLabelText("Titre"), "Costume d'Été");
    expect(slug.value).toBe("costume-d-ete");
    await user.clear(slug);
    await user.type(slug, "mon-adresse");
    await user.type(screen.getByLabelText("Titre"), " bis");
    expect(slug.value).toBe("mon-adresse");
  });

  it("modification : l'adresse enregistrée n'est jamais recalculée", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    await user.type(screen.getByLabelText("Titre"), " bis");
    expect((screen.getByLabelText("Adresse du produit") as HTMLInputElement).value).toBe("test-cosplay");
    expect((screen.getByLabelText("Prix en dollars US (USD)") as HTMLInputElement).value).toBe("49.90");
    expect((screen.getByLabelText("Stock") as HTMLInputElement).value).toBe("2");
  });

  it("famille et tailles en cases natives, sans action au choix ; Sur mesure seulement pour un cosplay", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["cosplay", "accessoire", "vetement", "autre", "kit"]);
    // Aucune famille choisie par défaut.
    expect(radios.some((r) => (r as HTMLInputElement).checked)).toBe(false);
    await user.click(screen.getByRole("radio", { name: /Cosplay/ }));
    expect(screen.getByRole("checkbox", { name: "Proposer la taille Sur mesure" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox").length).toBe(7);
    await user.click(screen.getByRole("radio", { name: "Accessoire" }));
    expect(screen.queryByRole("checkbox", { name: "Proposer la taille Sur mesure" })).toBeNull();
    expect(screen.getAllByRole("checkbox").length).toBe(6);
    expect(faux.enregistrerProduit).not.toHaveBeenCalled();
  });

  it("sans univers : le formulaire le dit et renvoie vers /admin/univers", () => {
    rendre(<FormulaireProduit univers={[]} />);
    expect(screen.getByText(/Aucun univers n'existe encore/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Aller aux univers" }).getAttribute("href")).toBe("/admin/univers");
    expect(screen.queryByRole("combobox", { name: "Univers" })).toBeNull();
  });

  it("noms d'univers dans la langue de la route", () => {
    rendre(<FormulaireProduit univers={UNIVERS} />, "en");
    const liste = screen.getByLabelText("Universe") as HTMLSelectElement;
    expect(Array.from(liste.options).map((o) => o.textContent)).toEqual(["No universe", "Test universe A", "Test universe B"]);
  });

  it("création réussie : envoi des seules tailles cochées, redirection vers la fiche seulement après la réponse", async () => {
    let repondre: (v: unknown) => void = () => {};
    faux.enregistrerProduit.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} />);
    await user.click(screen.getByRole("radio", { name: /Cosplay/ }));
    await user.type(screen.getByLabelText("Titre"), "Mon cosplay");
    await user.type(screen.getByLabelText("Prix en dollars US (USD)"), "49,90");
    await user.click(screen.getByRole("checkbox", { name: "Proposer la taille M" }));
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "2");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("button", { name: "Enregistrement…" })).toBeTruthy();
    expect(faux.push).not.toHaveBeenCalled();
    expect(screen.queryByText("Produit enregistré.")).toBeNull();
    expect(faux.enregistrerProduit).toHaveBeenCalledWith({
      id: "",
      famille: "cosplay",
      slug: "mon-cosplay",
      titreFr: "Mon cosplay",
      titreEn: "",
      descriptionFr: "",
      descriptionEn: "",
      universId: "",
      prix: "49,90",
      delai: "",
      variantes: [{ taille: "M", stock: "2", surCommande: false, delai: "" }],
    });

    await act(async () => repondre({ statut: "succes", id: "TEST_nouveau", cree: true }));
    expect(faux.push).toHaveBeenCalledWith("/admin/produits/TEST_nouveau?cree=1");
  });

  it.each([
    ["produit_publie_verrouille", /son adresse et sa famille ne peuvent plus changer/],
    ["publication_incomplete", /il doit rester complet/],
  ])("produit publié : le refus %s s'affiche en français", async (erreur, motif) => {
    faux.enregistrerProduit.mockResolvedValueOnce({ statut: "erreur", erreur });
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={{ ...brouillon, publieLe: "2026-01-01T00:00:00Z" }} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(motif);
    expect(screen.queryByText("Produit enregistré.")).toBeNull();
  });

  it("modification réussie : succès affiché après la réponse seulement, saisie gardée", async () => {
    let repondre: (v: unknown) => void = () => {};
    faux.enregistrerProduit.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "5");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.queryByText("Produit enregistré.")).toBeNull();
    expect(faux.enregistrerProduit.mock.calls[0][0]).toMatchObject({ id: brouillon.id, variantes: [{ taille: "M", stock: "5" }] });
    await act(async () => repondre({ statut: "succes", id: brouillon.id, cree: false }));
    expect(await screen.findByText("Produit enregistré.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
    expect((screen.getByLabelText("Stock") as HTMLInputElement).value).toBe("5");
  });

  it("le message de succès disparaît dès que l'admin modifie un champ", async () => {
    faux.enregistrerProduit.mockResolvedValue({ statut: "succes", id: brouillon.id, cree: false });
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Produit enregistré.")).toBeTruthy();
    await user.type(screen.getByLabelText("Titre"), "x");
    expect(screen.queryByText("Produit enregistré.")).toBeNull();
  });

  it("erreur de champ : sous le champ, aria-describedby, résumé en alerte avec le focus, saisie conservée, aucun succès", async () => {
    faux.enregistrerProduit.mockResolvedValue({ statut: "erreur", erreur: "prix_invalide", champ: "prix" });
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    const prix = screen.getByLabelText("Prix en dollars US (USD)") as HTMLInputElement;
    await user.clear(prix);
    await user.type(prix, "12,345");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const resume = await screen.findByText(/Il y a des erreurs à corriger/);
    expect(document.activeElement).toBe(resume.closest("[tabindex]"));
    const message = screen.getByText(/Saisis un prix en dollars supérieur à 0/);
    expect(prix.getAttribute("aria-invalid")).toBe("true");
    expect(prix.getAttribute("aria-describedby")).toContain(message.id);
    expect(prix.value).toBe("12,345");
    expect(screen.queryByText("Produit enregistré.")).toBeNull();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("adresse déjà prise : erreur sous le champ avec la première adresse libre, un bouton l'applique", async () => {
    faux.enregistrerProduit.mockResolvedValue({ statut: "erreur", erreur: "slug_pris", champ: "slug", slugPropose: "test-cosplay-2" });
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/Première adresse libre : test-cosplay-2/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Utiliser test-cosplay-2" }));
    expect((screen.getByLabelText("Adresse du produit") as HTMLInputElement).value).toBe("test-cosplay-2");
    expect(screen.queryByText(/Première adresse libre/)).toBeNull();
  });

  it("erreur d'une variante : sous le stock de la taille concernée", async () => {
    faux.enregistrerProduit.mockResolvedValue({ statut: "erreur", erreur: "stock_invalide", champ: "variantes", taille: "M" });
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    const message = await screen.findByText("Le stock doit être un nombre entier, 0 ou plus.");
    expect(screen.getByLabelText("Stock").getAttribute("aria-describedby")).toContain(message.id);
  });

  it("échec serveur : message, saisie conservée, aucun succès ni redirection", async () => {
    faux.enregistrerProduit.mockRejectedValue(new Error("TEST_reseau"));
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} produit={brouillon} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/n'a pas pu être enregistré/)).toBeTruthy();
    expect((screen.getByLabelText("Titre") as HTMLInputElement).value).toBe("TEST_Cosplay");
    expect(screen.queryByText("Produit enregistré.")).toBeNull();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("existe en anglais", () => {
    rendre(<FormulaireProduit univers={UNIVERS} />, "en");
    expect(screen.getByLabelText("Title in French")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
