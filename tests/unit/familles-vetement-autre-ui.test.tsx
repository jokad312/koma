// @vitest-environment jsdom
// Story 9.15 : interface des familles « Vêtement » et « Autre article » (admin et fiche). Données de test nommées TEST_.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ enregistrerProduit: vi.fn(), ajouterAuPanier: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({ creerUnivers: vi.fn(), enregistrerProduit: (...a: unknown[]) => faux.enregistrerProduit(...a) }));
vi.mock("@/modules/panier/actions", () => ({ ajouterAuPanier: (...a: unknown[]) => faux.ajouterAuPanier(...a) }));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: faux.refresh, push: faux.push }) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push, refresh: faux.refresh }),
  usePathname: () => "/admin/produits",
  Link: ({ href, children, ...reste }: { href: string; children: ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { ZoneAchat } from "@/components/fiche/ZoneAchat";
import type { TailleFiche } from "@/modules/catalogue/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  faux.enregistrerProduit.mockReset();
  faux.ajouterAuPanier.mockReset();
  faux.enregistrerProduit.mockResolvedValue({ statut: "succes", id: "TEST_id", cree: false });
  faux.ajouterAuPanier.mockResolvedValue({ ok: true, nombre: 1 });
});

describe("FormulaireProduit : Vêtement", () => {
  it("grille tailles × couleurs : nom FR/EN, pastille, suggestions, et chaque couleur envoie ses tailles", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={[]} couleursUtilisees={[{ fr: "Noir", en: "Black", hex: "#1B1713" }]} />);
    await user.click(screen.getByRole("radio", { name: /Vêtement/ }));
    // Sans couleur : les tailles XS à XXL, jamais « Sur mesure » ni « Taille unique ».
    expect(screen.queryByRole("checkbox", { name: "Proposer la taille Sur mesure" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Proposer la taille XXL" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ajouter une couleur" }));
    const nomFr = screen.getByRole("combobox", { name: "Nom de la couleur en français" });
    // Couleur déjà utilisée : son nom anglais et sa pastille sont repris.
    await user.type(nomFr, "Noir");
    expect((screen.getByLabelText("Nom de la couleur en anglais") as HTMLInputElement).value).toBe("Black");
    expect((screen.getByLabelText("Pastille (code #RRGGBB), facultative") as HTMLInputElement).value).toBe("#1B1713");
    const groupe = screen.getByRole("group", { name: "Tailles et stock : Noir" });
    await user.click(within(groupe).getByRole("checkbox", { name: "Proposer la taille M" }));
    await user.clear(within(groupe).getByLabelText("Stock"));
    await user.type(within(groupe).getByLabelText("Stock"), "2");

    await user.type(screen.getByLabelText("Titre en français"), "TEST_Polo");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerProduit).toHaveBeenCalledWith(
      expect.objectContaining({
        famille: "vetement",
        variantes: [{ taille: "M", stock: "2", surCommande: false, delai: "", couleurFr: "Noir", couleurEn: "Black", couleurHex: "#1B1713" }],
      }),
    );
  });

  it("retirer la couleur rend les tailles sans couleur", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={[]} />);
    await user.click(screen.getByRole("radio", { name: /Vêtement/ }));
    await user.click(screen.getByRole("button", { name: "Ajouter une couleur" }));
    await user.type(screen.getByLabelText("Nom de la couleur en français"), "Blanc");
    await user.click(screen.getByRole("button", { name: "Retirer la couleur Blanc" }));
    expect(screen.queryByLabelText("Nom de la couleur en français")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Proposer la taille M" })).toBeTruthy();
  });
});

describe("FormulaireProduit : Autre article", () => {
  it("une seule ligne « Taille unique », sans case à cocher, envoyée d'office", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={[]} />);
    await user.click(screen.getByRole("radio", { name: /Autre article/ }));
    expect(screen.getByRole("group", { name: "Taille unique" })).toBeTruthy();
    expect(screen.queryAllByRole("checkbox", { name: /Proposer la taille/ })).toHaveLength(0);
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Objet");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerProduit).toHaveBeenCalledWith(expect.objectContaining({ famille: "autre", variantes: [{ taille: "unique", stock: "0", surCommande: false, delai: "" }] }));
  });
});

const noir = { cle: "Noir", nom: "Noir", hex: "#1B1713" };
const blanc = { cle: "Blanc", nom: "Blanc", hex: null };
const commun = { produitId: PRODUIT, locale: "fr" as const, forfaitGoma: null, forfaitBukavu: null, retraitGoma: null };

describe("ZoneAchat : Vêtement en couleurs", () => {
  const tailles: TailleFiche[] = [
    { taille: "M", etat: "disponible", delaiJours: null, couleur: noir },
    { taille: "M", etat: "epuise", delaiJours: null, couleur: blanc },
    { taille: "L", etat: "epuise", delaiJours: null, couleur: noir },
    { taille: "L", etat: "sur_commande", delaiJours: 7, couleur: blanc },
  ];

  it("M puis Noir : « Ajouter » possible ; Blanc ne propose que ses tailles (L, sur commande), jamais M", async () => {
    const user = userEvent.setup();
    rendre(<ZoneAchat {...commun} tailles={tailles} />);
    const couleurs = screen.getByRole("group", { name: "Couleur" });
    // Nom de la couleur toujours écrit : nom accessible du bouton radio.
    expect(within(couleurs).getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["Noir", "Blanc"]);
    expect(within(couleurs).getByRole("radio", { name: "Noir" })).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "M" }));
    expect(screen.getByRole("button", { name: "Ajouter au panier" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Choisis d'abord une couleur.")).toBeTruthy();
    await user.click(within(couleurs).getByRole("radio", { name: "Noir" }));
    await user.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(faux.ajouterAuPanier).toHaveBeenCalledWith({ produitId: PRODUIT, taille: "M", couleur: "Noir", nombre: 1 });

    // Clavier : les flèches changent de couleur sans rien envoyer.
    within(couleurs).getByRole("radio", { name: "Noir" }).focus();
    await user.keyboard("{ArrowRight}");
    expect((within(couleurs).getByRole("radio", { name: "Blanc" }) as HTMLInputElement).checked).toBe(true);
    // M n'existe pas (achetable) en Blanc : la taille n'est plus proposée et l'ajout redemande une taille.
    expect(screen.queryByRole("radio", { name: "M" })).toBeNull();
    expect(screen.getByText("Choisis d'abord une taille.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Épuisé/i);
    await user.click(screen.getByRole("radio", { name: "L" }));
    expect(within(screen.getByRole("group", { name: "Taille" })).getByRole("status").textContent).toContain("Fabrication sur commande");
    expect(faux.ajouterAuPanier).toHaveBeenCalledTimes(1);
  });

  it("une seule couleur : son nom est écrit, sans sélecteur", () => {
    rendre(<ZoneAchat {...commun} tailles={[{ taille: "M", etat: "disponible", delaiJours: null, couleur: noir }]} />);
    expect(screen.getByText("Couleur : Noir")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Couleur" })).toBeNull();
  });
});

describe("ZoneAchat : Autre article", () => {
  it("aucun sélecteur ; l'ajout envoie la taille « unique »", async () => {
    const user = userEvent.setup();
    rendre(<ZoneAchat {...commun} tailles={[{ taille: "unique", etat: "disponible", delaiJours: null, couleur: null }]} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("En stock")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(faux.ajouterAuPanier).toHaveBeenCalledWith({ produitId: PRODUIT, taille: "unique", nombre: 1 });
  });

  it("variante sans stock ni fabrication : « Commandes complètes pour le moment », jamais « Épuisé », aucun bouton d'ajout", () => {
    rendre(<ZoneAchat {...commun} tailles={[{ taille: "unique", etat: "epuise", delaiJours: null, couleur: null }]} />);
    expect(screen.getByText("Commandes complètes pour le moment")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Épuisé/i);
    expect(screen.queryByRole("button", { name: "Ajouter au panier" })).toBeNull();
  });
});

describe("FormulaireProduit : couleurs jamais perdues en silence", () => {
  it("couleur sans nom ou sans taille : envoi refusé, erreur sur la couleur ; erreur KS_VARIANTE_COMMANDEE affichée", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={[]} />);
    await user.click(screen.getByRole("radio", { name: /Vêtement/ }));
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Polo");
    await user.click(screen.getByRole("button", { name: "Ajouter une couleur" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerProduit).not.toHaveBeenCalled();
    expect(screen.getByText("Donne un nom français à cette couleur, ou retire-la.")).toBeTruthy();

    await user.type(screen.getByLabelText("Nom de la couleur en français"), "Gris");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerProduit).not.toHaveBeenCalled();
    expect(screen.getByText("Coche au moins une taille pour cette couleur, ou retire-la.")).toBeTruthy();

    await user.click(within(screen.getByRole("group", { name: "Tailles et stock : Gris" })).getByRole("checkbox", { name: "Proposer la taille S" }));
    faux.enregistrerProduit.mockResolvedValueOnce({ statut: "erreur", erreur: "variante_commandee", champ: "variantes" });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerProduit).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/a déjà été commandée/)).toBeTruthy();
  });

  it("une variante existante renvoie son identifiant (renommage de couleur sur place)", async () => {
    const user = userEvent.setup();
    const produit = {
      id: "00000000-0000-4000-8000-0000000000aa",
      famille: "vetement" as const,
      slug: "polo-test",
      titreFr: "TEST_Polo",
      titreEn: null,
      descriptionFr: null,
      descriptionEn: null,
      universId: null,
      prixCents: 2000,
      delaiFabricationJours: null,
      publieLe: null,
      variantes: [{ id: "00000000-0000-4000-8000-00000000a001", taille: "M" as const, stock: 1, fabricationSurCommande: false, delaiFabricationJours: null, couleur: { fr: "Noir", en: "Black", hex: null } }],
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
    rendre(<FormulaireProduit univers={[]} produit={produit} />);
    const nom = screen.getByLabelText("Nom de la couleur en français");
    await user.clear(nom);
    await user.type(nom, "Anthracite");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerProduit).toHaveBeenCalledWith(
      expect.objectContaining({ variantes: [expect.objectContaining({ id: "00000000-0000-4000-8000-00000000a001", taille: "M", couleurFr: "Anthracite", couleurEn: "Black" })] }),
    );
  });
});
