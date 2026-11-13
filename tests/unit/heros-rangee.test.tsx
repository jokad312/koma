// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

vi.mock("server-only", () => ({}));
const faux = vi.hoisted(() => ({ messages: null as unknown }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: (faux.messages as Record<string, never>) ?? {}, namespace: namespace as never }),
  };
});
vi.mock("@/modules/accueil/heros-queries", () => ({ lireHerosPublic: vi.fn() }));
vi.mock("@/modules/accueil/heros-cartes", () => ({ lireCartesHeros: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ) }));
vi.mock("@/components/ui/TitreVitrine", () => ({ TitreVitrine: ({ children }: { children: string }) => <h1>{children}</h1> }));
vi.mock("./MediaHeros", () => ({ MediaHeros: () => null }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

import { MediaVue, RangeeVue } from "@/components/accueil/HerosAccueil";
import type { CarteProduit } from "@/modules/catalogue/types";

function carte(famille: CarteProduit["famille"], slug: string): CarteProduit {
  return { id: `TEST_${slug}`, slug, famille, titre: `Titre ${slug}`, photoAlt: `Alt ${slug}`, photoUrl: `https://exemple.test/${slug}.jpg`, prixCents: 4500, disponibilite: "disponible", niveau: null };
}

beforeEach(() => {
  faux.messages = fr;
});

describe("RangeeVue (cartes du héros)", () => {
  it("aucun produit publié : ni rangée ni bouton rond", async () => {
    const { container } = rendre(<>{await RangeeVue({ locale: "fr", cartes: { cosplay: null, accessoire: null, kit: null } })}</>);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("trois cartes : liens vers la fiche de chaque famille, Kit du mois avec nom accessible, bouton rond vers les cosplays", async () => {
    rendre(<>{await RangeeVue({ locale: "fr", cartes: { cosplay: carte("cosplay", "c1"), accessoire: carte("accessoire", "a1"), kit: carte("kit", "k1") } })}</>);
    const liste = screen.getByRole("list", { name: fr.Accueil.heros.cartes });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(3);
    expect(within(liste).getByRole("link", { name: /^Cosplay porté : Titre c1, / }).getAttribute("href")).toBe("/cosplays/c1");
    expect(within(liste).getByRole("link", { name: /^Accessoire : Titre a1, / }).getAttribute("href")).toBe("/accessoires/a1");
    expect(within(liste).getByRole("link", { name: "Voir le kit : Titre k1" }).getAttribute("href")).toBe("/kits/k1");
    expect(screen.getByRole("link", { name: fr.Accueil.heros.versCatalogue }).getAttribute("href")).toBe("/cosplays");
  });

  it("sans accessoire ni Kit : seule la carte cosplay existe", async () => {
    rendre(<>{await RangeeVue({ locale: "fr", cartes: { cosplay: carte("cosplay", "c1"), accessoire: null, kit: null } })}</>);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText(fr.Accueil.heros.kitDuMois)).toBeNull();
  });

  it("sans cosplay, le bouton rond mène à la première famille présente (jamais à un catalogue vide)", async () => {
    rendre(<>{await RangeeVue({ locale: "fr", cartes: { cosplay: null, accessoire: null, kit: carte("kit", "k1") } })}</>);
    expect(screen.getByRole("link", { name: fr.Accueil.heros.versCatalogue }).getAttribute("href")).toBe("/kits");
  });

  it("en anglais : textes anglais, adresse propre des accessoires", async () => {
    faux.messages = en;
    rendre(<>{await RangeeVue({ locale: "en", cartes: { cosplay: null, accessoire: carte("accessoire", "a1"), kit: carte("kit", "k1") } })}</>, "en");
    expect(screen.getByText(en.Accueil.heros.kitDuMois)).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Accessory: Titre a1, / }).getAttribute("href")).toBe("/accessories/a1");
    expect(screen.getByRole("link", { name: "See the kit: Titre k1" })).toBeTruthy();
  });
});

describe("MediaVue (repère du héros sans photo)", () => {
  it("ni photo ni vidéo : un repère caché « sans-media » fait recentrer le héros, sans média ni halo", () => {
    const { container } = rendre(<MediaVue videoUrl={null} repli={null} />);
    const repere = container.querySelector(".sans-media");
    expect(repere).not.toBeNull();
    expect(repere?.hasAttribute("hidden")).toBe(true);
    expect(container.querySelector(".hv-halo")).toBeNull();
  });

  it("avec une photo : pas de repère, halo présent", () => {
    // jsdom n'a pas matchMedia (lu par MediaHeros pour « mouvement réduit »).
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const { container } = rendre(<MediaVue videoUrl={null} repli={{ url: "https://exemple.test/p.jpg", alt: "Alt", detoure: true }} />);
    expect(container.querySelector(".sans-media")).toBeNull();
    expect(container.querySelector(".hv-halo")).not.toBeNull();
    vi.unstubAllGlobals();
  });
});
