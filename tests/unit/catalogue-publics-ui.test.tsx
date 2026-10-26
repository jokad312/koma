// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ chargerPlus: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/voir-plus", () => ({ chargerPlusProduits: (...a: unknown[]) => faux.chargerPlus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/accessoires",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const fr = (await import("../../messages/fr.json")).default;
  const en = (await import("../../messages/en.json")).default;
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});

import { BadgeDisponibilite } from "@/components/catalogue/BadgeDisponibilite";
import { CarteProduit } from "@/components/catalogue/CarteProduit";
import { DetailsFiltres } from "@/components/catalogue/DetailsFiltres";
import { FiltresCatalogue } from "@/components/catalogue/FiltresCatalogue";
import { GrilleProduits } from "@/components/catalogue/GrilleProduits";
import { analyserRequete } from "@/modules/catalogue/adresse";
import type { CarteProduit as Donnees, Disponibilite } from "@/modules/catalogue/types";

const UNIVERS = "00000000-0000-4000-8000-0000000000a1";

function produit(n: number, surcharge: Partial<Donnees> = {}): Donnees {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-produit-${n}`,
    famille: "accessoire",
    titre: `TEST_Titre ${n}`,
    photoAlt: `TEST_Alt ${n}`,
    photoUrl: `http://127.0.0.1:54321/storage/v1/object/public/produits-public/${n}/a.jpg`,
    prixCents: 4990,
    disponibilite: "disponible",
    ...surcharge,
  };
}

beforeEach(() => {
  faux.chargerPlus.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("BadgeDisponibilite", () => {
  const MOTS: Record<Disponibilite, string> = {
    disponible: "En stock",
    dernieres_pieces: "Dernières pièces",
    sur_commande: "Fabrication sur commande",
    complet: "Commandes complètes pour le moment",
    epuise: "Épuisé",
  };
  it.each(Object.entries(MOTS))("%s : icône + mot, sans quantité ni compteur", (etat, mot) => {
    const { container } = rendre(<BadgeDisponibilite etat={etat as Disponibilite} />);
    expect(screen.getByText(mot)).toBeTruthy();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toMatch(/plus que|only .* left/i);
  });

  it("seul l'état « épuisé » dit « Épuisé » ; le Plafond atteint dit « Commandes complètes »", () => {
    for (const etat of ["disponible", "dernieres_pieces", "sur_commande", "complet"] as const) {
      const { container, unmount } = rendre(<BadgeDisponibilite etat={etat} />);
      expect(container.textContent).not.toMatch(/épuisé/i);
      unmount();
    }
  });

  it("anglais", () => {
    rendre(<BadgeDisponibilite etat="complet" />, "en");
    expect(screen.getByText("Orders full for now")).toBeTruthy();
  });
});

describe("CarteProduit", () => {
  it("photo avec son texte alternatif, nom en h3 > a vers la fiche de la langue, prix en USD, badge", () => {
    rendre(<CarteProduit produit={produit(1)} />);
    expect(screen.getByRole("img", { name: "TEST_Alt 1" }).getAttribute("src")).toContain("/produits-public/1/a.jpg");
    const titre = screen.getByRole("heading", { level: 3 });
    const lien = within(titre).getByRole("link", { name: "TEST_Titre 1" });
    expect(lien.getAttribute("href")).toBe("/accessoires/test-produit-1");
    expect(screen.getByText(/49,90/)).toBeTruthy();
    expect(screen.getByText("En stock")).toBeTruthy();
    // Le lien est étendu à toute la carte.
    expect(lien.className).toContain("after:absolute");
  });

  it("anglais : adresse propre de l'anglais et prix en USD", () => {
    rendre(<CarteProduit produit={produit(2)} />, "en");
    expect(screen.getByRole("link", { name: "TEST_Titre 2" }).getAttribute("href")).toBe("/accessories/test-produit-2");
    expect(screen.getByText("$49.90")).toBeTruthy();
  });

  it("un cosplay mène à /cosplays/<slug>", () => {
    rendre(<CarteProduit produit={produit(3, { famille: "cosplay" })} />);
    expect(screen.getByRole("link", { name: "TEST_Titre 3" }).getAttribute("href")).toBe("/cosplays/test-produit-3");
  });
});

describe("FiltresCatalogue", () => {
  async function rendreFiltres(requete: Record<string, string>, opts: { univers?: boolean; tranches?: boolean } = {}, locale: "fr" | "en" = "fr") {
    const element = await FiltresCatalogue({
      locale,
      chemin: locale === "fr" ? "/accessoires" : "/accessories",
      params: analyserRequete(requete),
      univers: opts.univers === false ? [] : [{ id: UNIVERS, nom: "TEST_Univers A" }],
      tranches:
        opts.tranches === false
          ? []
          : [
              { ordre: 1, libelleFr: "TEST_Petit", libelleEn: "TEST_Small", basCents: 0, hautCents: 2000 },
              { ordre: 2, libelleFr: "TEST_Grand", libelleEn: "TEST_Large", basCents: 2000, hautCents: null },
            ],
    });
    return rendre(element, locale);
  }

  it("sans filtre : pilules en liens, « Tous » actif, pas d'« Effacer les filtres », « Filtrer (0) » replié", async () => {
    await rendreFiltres({});
    const resume = screen.getByText("Filtrer (0)");
    expect(resume.closest("details")?.hasAttribute("open")).toBe(false);
    expect(screen.queryByRole("link", { name: "Effacer les filtres" })).toBeNull();
    const univers = screen.getByRole("link", { name: "TEST_Univers A" });
    expect(univers.getAttribute("href")).toBe(`/accessoires?univers=${UNIVERS}`);
    expect(univers.getAttribute("aria-current")).toBeNull();
    for (const tous of screen.getAllByRole("link", { name: "Tous" })) expect(tous.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "Nouveautés" }).getAttribute("aria-current")).toBe("true");
  });

  it("filtres actifs : aria-current sur les choix, compte dans « Filtrer (n) », « Effacer les filtres » vers la base", async () => {
    await rendreFiltres({ univers: UNIVERS, prix: "0-2000", dispo: "en_stock", tri: "prix_asc" });
    expect(screen.getByText("Filtrer (3)")).toBeTruthy();
    for (const nom of ["TEST_Univers A", "TEST_Petit", "En stock", "Prix croissant"]) {
      expect(screen.getByRole("link", { name: nom }).getAttribute("aria-current")).toBe("true");
    }
    expect(screen.getByRole("link", { name: "TEST_Grand" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Effacer les filtres" }).getAttribute("href")).toBe("/accessoires");
  });

  it("un tri non par défaut seul suffit pour proposer « Effacer les filtres »", async () => {
    await rendreFiltres({ tri: "prix_desc" });
    expect(screen.getByText("Filtrer (0)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Effacer les filtres" })).toBeTruthy();
  });

  it("changer un choix garde les autres et ramène à la première page (jamais de curseur)", async () => {
    await rendreFiltres({ univers: UNIVERS, tri: "prix_asc" });
    expect(screen.getByRole("link", { name: "En stock" }).getAttribute("href")).toBe(`/accessoires?univers=${UNIVERS}&dispo=en_stock&tri=prix_asc`);
    expect(screen.getAllByRole("link").every((a) => !a.getAttribute("href")?.includes("curseur"))).toBe(true);
    // « Tous » de l'univers retire seulement l'univers.
    const tousUnivers = within(screen.getByRole("heading", { name: "Univers" }).parentElement as HTMLElement).getByRole("link", { name: "Tous" });
    expect(tousUnivers.getAttribute("href")).toBe("/accessoires?tri=prix_asc");
  });

  it("tranche ouverte : bornes en centimes dans l'adresse", async () => {
    await rendreFiltres({});
    expect(screen.getByRole("link", { name: "TEST_Grand" }).getAttribute("href")).toBe("/accessoires?prix=2000-");
    expect(screen.getByRole("link", { name: "TEST_Petit" }).getAttribute("href")).toBe("/accessoires?prix=0-2000");
  });

  it("aucune tranche réglée : pas de filtre de prix ; aucun univers : pas de filtre d'univers", async () => {
    await rendreFiltres({}, { univers: false, tranches: false });
    expect(screen.queryByRole("heading", { name: "Prix" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Univers" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Disponibilité" })).toBeTruthy();
  });

  it("anglais : libellés de tranche anglais, adresse propre de l'anglais", async () => {
    await rendreFiltres({}, {}, "en");
    expect(screen.getByRole("link", { name: "TEST_Small" }).getAttribute("href")).toBe("/accessories?prix=0-2000");
    expect(screen.getByText("Filter (0)")).toBeTruthy();
  });

  it("les liens ont une pilule de 44 px", async () => {
    await rendreFiltres({});
    expect(screen.getByRole("link", { name: "En stock" }).className).toContain("min-h-touch");
  });
});

describe("DetailsFiltres", () => {
  function avecMedia(correspond: boolean) {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: correspond, media: q, addEventListener() {}, removeEventListener() {} }));
  }
  afterEach(() => vi.unstubAllGlobals());

  it("ordinateur (lg et plus) : ouvert après le montage", () => {
    avecMedia(true);
    const { container } = rendre(<DetailsFiltres resume="Filtrer (0)">contenu</DetailsFiltres>);
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(true);
  });

  it("mobile : replié", () => {
    avecMedia(false);
    const { container } = rendre(<DetailsFiltres resume="Filtrer (0)">contenu</DetailsFiltres>);
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(false);
  });
});

describe("GrilleProduits et « Voir plus »", () => {
  const initiaux = Array.from({ length: 12 }, (_, i) => produit(i + 1));

  function grille(props: Partial<React.ComponentProps<typeof GrilleProduits>> = {}) {
    return (
      <GrilleProduits famille="accessoire" produits={initiaux} requeteSuite="tri=prix_asc&curseur=CUR1" requeteBase="tri=prix_asc" cle="c1" {...props} />
    );
  }

  it("annonce le nombre affiché en role=status et propose un vrai lien « Voir plus » portant le curseur", () => {
    rendre(grille());
    expect(screen.getByRole("status").textContent).toBe("12 produits affichés, il y en a d'autres");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(12);
    const lien = screen.getByRole("link", { name: "Voir plus" });
    expect(lien.getAttribute("href")).toBe("/accessoires?tri=prix_asc&curseur=CUR1");
  });

  it("dernière page : pas de « Voir plus », nombre sans mention de suite", () => {
    rendre(grille({ produits: initiaux.slice(0, 1), requeteSuite: null }));
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("1 produit affiché");
  });

  it("avec JavaScript : ajoute les 12 suivants, met à jour l'adresse, place le focus sur le premier ajouté", async () => {
    const user = userEvent.setup();
    const suivants = Array.from({ length: 12 }, (_, i) => produit(i + 13));
    faux.chargerPlus.mockResolvedValue({ ok: true, produits: suivants, suite: "CUR2" });
    rendre(grille());
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(24));
    expect(faux.chargerPlus).toHaveBeenCalledWith("accessoire", "tri=prix_asc&curseur=CUR1", "fr");
    expect(window.location.pathname + window.location.search).toBe("/fr/accessoires?tri=prix_asc&curseur=CUR1");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("link", { name: "TEST_Titre 13" })));
    expect(screen.getByRole("status").textContent).toBe("24 produits affichés, il y en a d'autres");
    // Le lien suivant porte le nouveau curseur.
    expect(screen.getByRole("link", { name: "Voir plus" }).getAttribute("href")).toBe("/accessoires?tri=prix_asc&curseur=CUR2");
  });

  it("plus de suite après le dernier lot : le lien disparaît", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValue({ ok: true, produits: [produit(13)], suite: null });
    rendre(grille());
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull());
    expect(screen.getByRole("status").textContent).toBe("13 produits affichés");
  });

  it("aucun nouveau produit : adresse non réécrite, lien conservé, focus laissé sur le lien", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValue({ ok: true, produits: [], suite: null });
    rendre(grille());
    const lien = screen.getByRole("link", { name: "Voir plus" });
    await user.click(lien);
    await waitFor(() => expect(faux.chargerPlus).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("link", { name: "Voir plus" })).toBeTruthy());
    expect(window.location.pathname).toBe("/");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(12);
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Voir plus" }));
  });

  it("un titre h2 précède la grille : les h3 des cartes ne sautent pas de niveau", () => {
    rendre(grille());
    const h2 = screen.getByRole("heading", { level: 2, name: "Produits" });
    expect(h2.className).toContain("sr-only");
    expect(screen.getByRole("list").getAttribute("aria-labelledby")).toBe(h2.id);
  });

  it("changement de liste (filtre, tri, curseur) : la région d'état reste la même, seul son texte change", () => {
    const { rerender } = rendre(grille());
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("12 produits affichés, il y en a d'autres");
    rerender(
      <NextIntlClientProvider locale="fr" messages={fr}>
        {grille({ produits: initiaux.slice(0, 2), requeteSuite: null, cle: "c2" })}
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toBe("2 produits affichés");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
  });

  it("ne duplique jamais un produit déjà affiché", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValue({ ok: true, produits: [initiaux[11], produit(13)], suite: null });
    rendre(grille());
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(13));
  });

  it("échec : message d'alerte, liste inchangée, le lien reste utilisable", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, produits: [produit(13)], suite: null });
    rendre(grille());
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger la suite");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(12);
    expect(screen.getByRole("link", { name: "Voir plus" }).getAttribute("href")).toBe("/accessoires?tri=prix_asc&curseur=CUR1");
    // Un nouvel essai réussit.
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(13));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("exception réseau : même message", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockRejectedValue(new Error("TEST réseau"));
    rendre(grille());
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("un clic avec Ctrl n'est pas intercepté (ouvre le lien normalement)", async () => {
    const user = userEvent.setup();
    rendre(grille());
    const lien = screen.getByRole("link", { name: "Voir plus" });
    lien.addEventListener("click", (e) => e.preventDefault());
    await user.keyboard("{Control>}");
    await act(async () => {
      await user.click(lien);
    });
    await user.keyboard("{/Control}");
    expect(faux.chargerPlus).not.toHaveBeenCalled();
  });
});
