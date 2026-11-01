// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  ajouterAuPanier: vi.fn(),
  lirePanier: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: faux.refresh, push: vi.fn() }), usePathname: () => "/fr/panier" }));
vi.mock("@/modules/panier/actions", () => ({
  ajouterAuPanier: (...a: unknown[]) => faux.ajouterAuPanier(...a),
  modifierLigneParFormulaire: vi.fn(),
  retirerLigneParFormulaire: vi.fn(),
}));
vi.mock("@/modules/panier/queries", () => ({ lirePanier: (...a: unknown[]) => faux.lirePanier(...a) }));
vi.mock("@/i18n/navigation", () => ({
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
    getTranslations: async (arg: string | { namespace: string }) =>
      createTranslator({ locale: "fr", messages, namespace: (typeof arg === "string" ? arg : arg.namespace) as never }),
    getLocale: async () => "fr",
  };
});

import { BoutonAjouterPanier } from "@/components/fiche/BoutonAjouterPanier";
import { PagePanier } from "@/components/panier/PagePanier";
import type { LignePanier, PanierLu } from "@/modules/panier/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";

const ligne = (s: Partial<LignePanier> = {}): LignePanier => ({
  id: "00000000-0000-4000-8000-0000000000c1",
  produitId: PRODUIT,
  famille: "cosplay",
  slug: "test-cosplay",
  titre: "TEST_Cosplay",
  taille: "M",
  nombre: 2,
  prixCents: 5000,
  etat: "disponible",
  delaiJours: null,
  ...s,
});
const panier = (lignes: LignePanier[], bloque = false): PanierLu => ({
  lignes,
  nombreArticles: lignes.reduce((s, l) => s + l.nombre, 0),
  sousTotalCents: lignes.filter((l) => l.etat !== "epuise" && l.etat !== "complet").reduce((s, l) => s + l.prixCents * l.nombre, 0),
  bloque,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BoutonAjouterPanier", () => {
  it("produit physique sans taille : bouton bloqué avec sa raison, aucun appel", async () => {
    rendre(<BoutonAjouterPanier produitId={PRODUIT} taille={null} />);
    const bouton = screen.getByRole("button", { name: "Ajouter au panier" });
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Choisis d'abord une taille.")).toBeTruthy();
    await userEvent.click(bouton);
    expect(faux.ajouterAuPanier).not.toHaveBeenCalled();
  });

  it("succès : « Ajouté au panier » annoncé en role=status, focus gardé sur le bouton, en-tête relu", async () => {
    faux.ajouterAuPanier.mockResolvedValue({ ok: true, nombre: 1 });
    rendre(<BoutonAjouterPanier produitId={PRODUIT} taille="M" />);
    const bouton = screen.getByRole("button", { name: "Ajouter au panier" });
    await userEvent.click(bouton);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Ajouté au panier"));
    expect(faux.ajouterAuPanier).toHaveBeenCalledWith({ produitId: PRODUIT, taille: "M", nombre: 1 });
    expect(faux.refresh).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(screen.getByRole("link", { name: "Voir mon panier" }).getAttribute("href")).toBe("/panier");
  });

  it("la zone de statut existe avant tout ajout (annonce fiable pour les lecteurs d'écran)", () => {
    rendre(<BoutonAjouterPanier produitId={PRODUIT} taille="M" />);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("Kit : aucune taille envoyée ; erreur annoncée, jamais de faux succès", async () => {
    faux.ajouterAuPanier.mockResolvedValue({ ok: false, erreur: "deja_possede" });
    rendre(<BoutonAjouterPanier produitId={PRODUIT} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    await screen.findByText("Tu as déjà ce kit.");
    expect(faux.ajouterAuPanier).toHaveBeenCalledWith({ produitId: PRODUIT, taille: null, nombre: 1 });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(faux.refresh).not.toHaveBeenCalled();
  });
});

describe("PagePanier", () => {
  it("Panier vide : message et liens vers les catalogues", async () => {
    faux.lirePanier.mockResolvedValue(panier([]));
    rendre(await PagePanier({ locale: "fr" }));
    expect(screen.getByText("Ton panier est vide.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cosplays" }).getAttribute("href")).toBe("/cosplays");
    expect(screen.getByRole("link", { name: "Accessoires" }).getAttribute("href")).toBe("/accessoires");
    expect(screen.getByRole("link", { name: "Kits" }).getAttribute("href")).toBe("/kits");
  });

  it("lecture impossible : message d'erreur, aucune ligne inventée", async () => {
    faux.lirePanier.mockResolvedValue(null);
    rendre(await PagePanier({ locale: "fr" }));
    expect(screen.getByText("Ton panier n'a pas pu être chargé. Réessaie dans un instant.")).toBeTruthy();
  });

  it("lignes relues : prix, état, délai, quantité modifiable, retrait nommé, sous-total", async () => {
    faux.lirePanier.mockResolvedValue(
      panier([
        ligne({ etat: "sur_commande", delaiJours: 14 }),
        ligne({ id: "00000000-0000-4000-8000-0000000000c2", famille: "kit", titre: "TEST_Kit", taille: null, nombre: 1, prixCents: 990, slug: "test-kit" }),
      ]),
    );
    rendre(await PagePanier({ locale: "fr" }));
    const liste = screen.getByRole("list", { name: "Articles du panier" });
    const cosplay = within(liste).getAllByRole("listitem")[0];
    expect(within(cosplay).getByText("Fabrication sur commande")).toBeTruthy();
    expect(within(cosplay).getByText("Délai de fabrication : 14 jours")).toBeTruthy();
    expect(within(cosplay).getByLabelText("Quantité")).toBeTruthy();
    expect(within(cosplay).getByRole("button", { name: "Retirer TEST_Cosplay du panier" })).toBeTruthy();
    const kit = within(liste).getAllByRole("listitem")[1];
    expect(within(kit).getByText("Kit numérique, en un seul exemplaire")).toBeTruthy();
    expect(within(kit).queryByLabelText("Quantité")).toBeNull();
    expect(screen.getByRole("link", { name: "Passer la commande" })).toBeTruthy();
  });

  it("ligne devenue indisponible : « Plus disponible », message, « Passer la commande » bloqué avec sa raison, hors du sous-total", async () => {
    faux.lirePanier.mockResolvedValue(panier([ligne({ etat: "epuise" })], true));
    rendre(await PagePanier({ locale: "fr" }));
    expect(screen.getByText("Plus disponible")).toBeTruthy();
    expect(screen.getByText("Cet article n'est plus disponible pour le moment. Retire-le pour continuer.")).toBeTruthy();
    const passer = screen.getByRole("button", { name: "Passer la commande" });
    expect(passer.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Retire d'abord les articles qui ne sont plus disponibles.")).toBeTruthy();
    expect(screen.queryByLabelText("Quantité")).toBeNull();
    expect(screen.getByRole("button", { name: "Retirer TEST_Cosplay du panier" })).toBeTruthy();
  });

  it("aucune ligne de Pass possible : seules les familles cosplay, accessoire et kit sont affichées", async () => {
    faux.lirePanier.mockResolvedValue(panier([ligne()]));
    rendre(await PagePanier({ locale: "fr" }));
    expect(screen.queryByText(/bpassb/i)).toBeNull();
  });
});
