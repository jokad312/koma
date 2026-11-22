// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre, texteComplet } from "./aides-dom";

// Story 9.16 e) : liste des produits selon la maquette 03-produits (C1 à C17), corbeille = archivage (Q22), compteurs (Q20).
const faux = vi.hoisted(() => ({
  commandesEnCoursProduit: vi.fn<(entree: { id: string }) => Promise<{ ok: boolean; nombre?: number; erreur?: string }>>(async () => ({ ok: true, nombre: 0 })),
  archiverProduit: vi.fn(),
  restaurerProduit: vi.fn(),
  publierProduit: vi.fn(),
  depublierProduit: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  archiverProduit: (...a: unknown[]) => faux.archiverProduit(...a),
  // Point 4 : nombre de Commandes en cours lu à l'ouverture de la confirmation (simulé ici : 0, puis 2 dans un test dédié).
  commandesEnCoursProduit: (entree: { id: string }) => faux.commandesEnCoursProduit(entree),
  restaurerProduit: (...a: unknown[]) => faux.restaurerProduit(...a),
  publierProduit: (...a: unknown[]) => faux.publierProduit(...a),
  depublierProduit: (...a: unknown[]) => faux.depublierProduit(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: faux.refresh }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { ListeProduits } from "@/components/admin/ListeProduits";
import type { ProduitListe } from "@/modules/catalogue/types";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

const base = { slug: "test", publieLe: null, universFr: null, photo: null, archiveLe: null, compteur: 0 } as const;
const PRODUITS: ProduitListe[] = [
  { ...base, id: "TEST_c", famille: "cosplay", titreFr: "TEST_Cosplay", prixCents: 4990, universFr: "TEST_Univers", photo: { url: "https://test.invalid/c.jpg", alt: "TEST_alt" }, stock: "en_stock", compteur: 3 },
  { ...base, id: "TEST_k", famille: "kit", titreFr: "TEST_Kit", prixCents: 0, publieLe: "2026-11-01T00:00:00Z", stock: "numerique", compteur: 2 },
  { ...base, id: "TEST_v", famille: "vetement", titreFr: "TEST_Polo", prixCents: null, stock: "epuise" },
  { ...base, id: "TEST_a", famille: "autre", titreFr: "TEST_Archive", prixCents: 1000, stock: "en_stock", archiveLe: "2026-11-10T00:00:00Z", compteur: 1 },
];

const carte = (titre: string) => screen.getByRole("heading", { level: 2, name: titre }).closest("li") as HTMLElement;
// Deux régions « status » : le compteur (la première) et l'annonce d'archivage ou de restauration.
const compteur = () => screen.getAllByRole("status")[0];
const texte = (el: HTMLElement) => (el.textContent ?? "").replace(/\s/g, " ");

describe("ListeProduits (9.16 e)", () => {
  it("barre : recherche, compteur annoncé, UNIVERS vers /admin/univers, + NOUVEAU PRODUIT ; grille de 1 colonne puis 2", () => {
    rendre(<ListeProduits produits={PRODUITS} />);
    expect(screen.getByRole("searchbox", { name: "Rechercher un produit" })).toBeTruthy();
    expect(compteur().textContent).toBe("3 produits");
    expect(screen.getByRole("link", { name: "Univers" }).getAttribute("href")).toBe("/admin/univers");
    expect(screen.getByRole("link", { name: "+ Nouveau produit" }).getAttribute("href")).toBe("/admin/produits/nouveau");
    const grille = screen.getByRole("list", { name: "Liste des produits" });
    expect(grille.className).toContain("grid-cols-1");
    expect(grille.className).toContain("xl:grid-cols-2");
    expect(within(grille).getAllByRole("listitem")).toHaveLength(3);
  });

  it("pastilles selon la famille : VENDUS pour un physique, TÉLÉCHARGEMENTS pour un Kit ; prix, Gratuit, Prix à fixer ; univers, type, stock", () => {
    rendre(<ListeProduits produits={PRODUITS} />);
    const cosplay = carte("TEST_Cosplay");
    expect(within(cosplay).getByText(texteComplet("Vendus : 3"))).toBeTruthy();
    expect(within(cosplay).queryByText(/Téléchargements/)).toBeNull();
    expect(within(cosplay).getByText((_, el) => el?.tagName === "SPAN" && texte(el as HTMLElement) === "Prix : 49,90 $US")).toBeTruthy();
    expect(within(cosplay).getByText("Univers : TEST_Univers")).toBeTruthy();
    expect(within(cosplay).getByText("Cosplay")).toBeTruthy();
    expect(within(cosplay).getByText("En stock")).toBeTruthy();
    expect(within(cosplay).getByRole("img", { name: "TEST_alt" }).getAttribute("src")).toBe("https://test.invalid/c.jpg");
    const kit = carte("TEST_Kit");
    expect(within(kit).getByText(texteComplet("Téléchargements : 2"))).toBeTruthy();
    expect(within(kit).queryByText(/Vendus/)).toBeNull();
    expect(within(kit).getByText("Prix : Gratuit")).toBeTruthy();
    expect(within(kit).getByText("Univers : aucun")).toBeTruthy();
    expect(within(kit).getByText("Numérique")).toBeTruthy();
    const polo = carte("TEST_Polo");
    expect(within(polo).getByText(texteComplet("Vendus : 0"))).toBeTruthy();
    expect(within(polo).getByText("Prix à fixer")).toBeTruthy();
    expect(within(polo).getByText("Vêtement")).toBeTruthy();
    // Sans photo : icône et texte, jamais une image inventée.
    expect(within(polo).queryByRole("img")).toBeNull();
    expect(within(polo).getByText("Pas de photo")).toBeTruthy();
  });

  it("icônes nommées : « Modifier X » (lien vers la fiche), « Archiver X » ; statut écrit en toutes lettres ; Publier / Dépublier gardés", () => {
    rendre(<ListeProduits produits={PRODUITS} />);
    const cosplay = carte("TEST_Cosplay");
    expect(within(cosplay).getByRole("link", { name: "Modifier TEST_Cosplay" }).getAttribute("href")).toBe("/admin/produits/TEST_c");
    expect(within(cosplay).getByRole("button", { name: "Archiver TEST_Cosplay" })).toBeTruthy();
    expect(within(cosplay).getByText("Brouillon")).toBeTruthy();
    expect(within(cosplay).getByRole("button", { name: /^Publier/ })).toBeTruthy();
    const kit = carte("TEST_Kit");
    expect(within(kit).getByText("Publié")).toBeTruthy();
    expect(within(kit).getByRole("button", { name: /^Dépublier/ })).toBeTruthy();
  });

  it("filtre « Archivés » : l'archivé n'est pas dans la liste par défaut ; il y apparaît avec « Restaurer », sans corbeille ni Publier", async () => {
    const user = userEvent.setup();
    rendre(<ListeProduits produits={PRODUITS} />);
    expect(screen.queryByRole("heading", { name: "TEST_Archive" })).toBeNull();
    const filtres = screen.getByRole("list", { name: "Afficher les produits" });
    expect(within(filtres).getByRole("button", { name: "Tous" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(within(filtres).getByRole("button", { name: "Archivés" }));
    expect(within(filtres).getByRole("button", { name: "Archivés" }).getAttribute("aria-pressed")).toBe("true");
    expect(compteur().textContent).toBe("1 produit");
    const archive = carte("TEST_Archive");
    expect(within(archive).getByText("Archivé")).toBeTruthy();
    expect(within(archive).getByRole("button", { name: "Restaurer TEST_Archive" })).toBeTruthy();
    expect(within(archive).queryByRole("button", { name: /Archiver/ })).toBeNull();
    expect(within(archive).queryByRole("button", { name: /Publier/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "TEST_Cosplay" })).toBeNull();
  });

  it("archiver : confirmation d'abord ; Annuler n'appelle rien ; Archiver appelle l'action puis relit la liste", async () => {
    const user = userEvent.setup();
    faux.archiverProduit.mockResolvedValue({ statut: "succes" });
    rendre(<ListeProduits produits={PRODUITS} />);
    await user.click(within(carte("TEST_Cosplay")).getByRole("button", { name: "Archiver TEST_Cosplay" }));
    const dialogue = await screen.findByRole("dialog", { name: "Archiver « TEST_Cosplay » ?" });
    expect(within(dialogue).getByText(/Rien n'est supprimé/)).toBeTruthy();
    await user.click(within(dialogue).getByRole("button", { name: "Annuler" }));
    expect(faux.archiverProduit).not.toHaveBeenCalled();
    await user.click(within(carte("TEST_Cosplay")).getByRole("button", { name: "Archiver TEST_Cosplay" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Archiver" }));
    await waitFor(() => expect(faux.refresh).toHaveBeenCalledTimes(1));
    expect(faux.archiverProduit).toHaveBeenCalledWith({ id: "TEST_c" });
    // Succès annoncé, focus sur le compteur (élément stable : la carte va quitter la vue).
    expect(screen.getAllByRole("status")[1].textContent).toBe("Produit archivé.");
    await waitFor(() => expect(document.activeElement).toBe(compteur()));
  });

  it("point 4 : produit dans 2 commandes en cours : l'alerte le dit dans la confirmation, l'archivage reste possible", async () => {
    const user = userEvent.setup();
    faux.commandesEnCoursProduit.mockResolvedValueOnce({ ok: true, nombre: 2 });
    faux.archiverProduit.mockResolvedValue({ statut: "succes" });
    rendre(<ListeProduits produits={PRODUITS} />);
    await user.click(within(carte("TEST_Cosplay")).getByRole("button", { name: "Archiver TEST_Cosplay" }));
    const dialogue = await screen.findByRole("dialog", { name: "Archiver « TEST_Cosplay » ?" });
    expect(faux.commandesEnCoursProduit).toHaveBeenCalledWith({ id: "TEST_c" });
    expect((await within(dialogue).findByRole("alert")).textContent).toBe(
      "Ce produit est dans 2 commandes en cours. Il sera retiré de la boutique, les commandes ne changent pas.",
    );
    await user.click(within(dialogue).getByRole("button", { name: "Archiver" }));
    await waitFor(() => expect(faux.archiverProduit).toHaveBeenCalledWith({ id: "TEST_c" }));
  });

  it("point 4 : lecture des commandes en cours impossible : on le dit, jamais un faux zéro ; aucune commande : pas d'alerte", async () => {
    const user = userEvent.setup();
    faux.commandesEnCoursProduit.mockResolvedValueOnce({ ok: false, erreur: "generique" });
    rendre(<ListeProduits produits={PRODUITS} />);
    await user.click(within(carte("TEST_Cosplay")).getByRole("button", { name: "Archiver TEST_Cosplay" }));
    let dialogue = await screen.findByRole("dialog");
    expect((await within(dialogue).findByRole("alert")).textContent).toMatch(/n'ont pas pu être vérifiées/);
    await user.click(within(dialogue).getByRole("button", { name: "Annuler" }));
    await user.click(within(carte("TEST_Cosplay")).getByRole("button", { name: "Archiver TEST_Cosplay" }));
    dialogue = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialogue).queryByText(/Vérification/)).toBeNull());
    expect(within(dialogue).queryByRole("alert")).toBeNull();
    expect(faux.commandesEnCoursProduit).toHaveBeenCalledTimes(2);
  });

  it("archivage refusé : message d'erreur, pas de relecture présentée comme un succès", async () => {
    const user = userEvent.setup();
    faux.archiverProduit.mockResolvedValue({ statut: "erreur", erreur: "non_autorise" });
    rendre(<ListeProduits produits={PRODUITS} />);
    await user.click(within(carte("TEST_Cosplay")).getByRole("button", { name: "Archiver TEST_Cosplay" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Archiver" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/plus le droit/);
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("restaurer : appelle l'action puis relit la liste", async () => {
    const user = userEvent.setup();
    faux.restaurerProduit.mockResolvedValue({ statut: "succes" });
    rendre(<ListeProduits produits={PRODUITS} />);
    await user.click(screen.getByRole("button", { name: "Archivés" }));
    await user.click(screen.getByRole("button", { name: "Restaurer TEST_Archive" }));
    await waitFor(() => expect(faux.refresh).toHaveBeenCalledTimes(1));
    expect(faux.restaurerProduit).toHaveBeenCalledWith({ id: "TEST_a" });
    expect(screen.getAllByRole("status")[1].textContent).toBe("Produit restauré : il est revenu en brouillon.");
    await waitFor(() => expect(document.activeElement).toBe(compteur()));
  });

  it("recherche : nom, famille ou univers, sans casse ni accents ; aucun résultat annoncé ; rien d'archivé sans le filtre", async () => {
    const user = userEvent.setup();
    rendre(<ListeProduits produits={PRODUITS} />);
    const champ = screen.getByRole("searchbox", { name: "Rechercher un produit" });
    await user.type(champ, "VETEMENT");
    expect(compteur().textContent).toBe("1 produit");
    await user.clear(champ);
    await user.type(champ, "univers");
    expect(compteur().textContent).toBe("1 produit");
    await user.clear(champ);
    await user.type(champ, "archive");
    expect(compteur().textContent).toBe("Aucun produit");
    expect(screen.getByText("Aucun produit ne correspond à ta recherche.")).toBeTruthy();
  });

  it("aucun produit : message et bouton de création", () => {
    rendre(<ListeProduits produits={[]} />);
    expect(screen.getByRole("link", { name: "Créer un produit" }).getAttribute("href")).toBe("/admin/produits/nouveau");
  });

  it("messages vides par filtre : seulement des archivés (vue par défaut) ; aucun archivé (« Archivés »)", async () => {
    const user = userEvent.setup();
    const { unmount } = rendre(<ListeProduits produits={PRODUITS.filter((p) => p.archiveLe !== null)} />);
    expect(screen.getByText(/^Aucun produit hors archives/)).toBeTruthy();
    unmount();
    rendre(<ListeProduits produits={PRODUITS.filter((p) => p.archiveLe === null)} />);
    await user.click(screen.getByRole("button", { name: "Archivés" }));
    expect(screen.getByText("Aucun produit archivé.")).toBeTruthy();
  });

  it("anglais : Downloads / Sold", () => {
    rendre(<ListeProduits produits={PRODUITS} />, "en");
    expect(within(carte("TEST_Kit")).getByText(texteComplet("Downloads: 2"))).toBeTruthy();
    expect(within(carte("TEST_Cosplay")).getByText(texteComplet("Sold: 3"))).toBeTruthy();
  });
});
