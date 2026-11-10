// @vitest-environment jsdom
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

const faux = vi.hoisted(() => ({
  lireMurs: vi.fn(),
  lireMursCurseur: vi.fn(),
  chargerPlus: vi.fn(),
  nomSite: "TEST_SITE",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/communaute/queries", () => ({ listerMurs: (...a: unknown[]) => faux.lireMurs(...a), lireMurs: (...a: unknown[]) => faux.lireMursCurseur(...a) }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => faux.nomSite }));
vi.mock("@/modules/communaute/voir-plus", () => ({ chargerPlusMurs: (...a: unknown[]) => faux.chargerPlus(...a) }));
// Adresse réelle (curseur encodé et décodé pour de vrai).
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
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
vi.mock("@/components/ui/TitreVitrine", () => ({
  TitreVitrine: ({ niveau, children }: { niveau: 1 | 2; children: string }) => (niveau === 1 ? <h1>{children}</h1> : <h2>{children}</h2>),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});

import { BlocMur } from "@/components/accueil/BlocMur";
import { ListeMurs } from "@/components/accueil/ListeMurs";
import { encoderCurseurMurs } from "@/modules/communaute/adresse";
import type { MurPublic } from "@/modules/communaute/types";

const DATE = "2026-11-10T08:15:30.123456+00";
const ID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

function mur(i: number, surch: Partial<MurPublic> = {}): MurPublic {
  return {
    id: ID(i),
    fichier: `galerie/${i}.jpg`,
    altFr: `Alt FR ${i}`,
    altEn: `Alt EN ${i}`,
    pseudo: null,
    valideLe: DATE,
    curseurDate: "2026-11-10T08:15:30.123456Z",
    type: "photo",
    faitAvecKit: false,
    kitSlug: null,
    kitTitreFr: null,
    kitTitreEn: null,
    ...surch,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
  faux.lireMurs.mockReset();
  faux.lireMursCurseur.mockReset();
  faux.chargerPlus.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("BlocMur", () => {
  it("une entrée publiée : titre du bloc et liste rendue", async () => {
    faux.lireMurs.mockResolvedValue({ murs: [mur(1)], suite: null });
    const { container } = rendre(<>{await BlocMur({ locale: "fr" })}</>);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("ILS LE PORTENT");
    expect(container.querySelector("section")).not.toBeNull();
  });

  it("erreur de lecture : le bloc est masqué, la page d'accueil ne tombe pas", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    faux.lireMurs.mockRejectedValue(new Error("boom"));
    const { container } = rendre(<>{await BlocMur({ locale: "fr" })}</>);
    expect(container.textContent).toBe("");
    erreurs.mockRestore();
  });

  it("?curseur= valide : lecture sans cache des entrées qui suivent ; curseur invalide : première page (cache)", async () => {
    const curseur = encoderCurseurMurs({ date: "2026-11-10T08:00:00.000000Z", id: ID(9), n: 24 });
    faux.lireMursCurseur.mockResolvedValue({ murs: [mur(30)], suite: null });
    faux.lireMurs.mockResolvedValue({ murs: [mur(1)], suite: null });
    rendre(<>{await BlocMur({ locale: "fr", requete: Promise.resolve({ curseur }) })}</>);
    expect(faux.lireMursCurseur).toHaveBeenCalledTimes(1);
    expect(faux.lireMurs).not.toHaveBeenCalled();
    cleanup();
    rendre(<>{await BlocMur({ locale: "fr", requete: Promise.resolve({ curseur: "forge" }) })}</>);
    expect(faux.lireMurs).toHaveBeenCalledTimes(1);
  });

  it("l'ancre #galerie existe sur la section (cible des liens du pied de page et du menu)", async () => {
    faux.lireMurs.mockResolvedValue({ murs: [mur(1)], suite: null });
    const { container } = rendre(<>{await BlocMur({ locale: "fr" })}</>);
    expect(container.querySelector("section#galerie")).not.toBeNull();
  });

  it("anglais : titre « THEY WEAR IT » et mention « Made with a kit … » fournis par Jonathan", async () => {
    faux.lireMurs.mockResolvedValue({ murs: [mur(1)], suite: null });
    rendre(<>{await BlocMur({ locale: "en" })}</>, "en");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("THEY WEAR IT");
  });

  it("aucune entrée publiée : le bloc n'existe pas, aucun titre ni texte", async () => {
    faux.lireMurs.mockResolvedValue({ murs: [], suite: null });
    const { container } = rendre(<>{await BlocMur({ locale: "fr" })}</>);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("ListeMurs et « Voir plus »", () => {
  it("Réalisation : la mention porte le nom du site lu dans les réglages (jamais écrit en dur) ; pseudo seulement s'il existe", () => {
    rendre(<ListeMurs cle={`debut|${ID(5)}`} murs={[mur(5, { faitAvecKit: true, type: "realisation", pseudo: "Nami" }), mur(6)]} suite={null} nomSite="TEST_SITE" />);
    expect(screen.getAllByText("Fait avec un kit TEST_SITE")).toHaveLength(1);
    expect(screen.getByText("Nami")).toBeTruthy();
  });

  it("anglais : « Made with a kit {nomSite} »", () => {
    rendre(<ListeMurs cle={`debut|${ID(5)}`} murs={[mur(5, { faitAvecKit: true, type: "realisation" })]} suite={null} nomSite="TEST_SITE" />, "en");
    expect(screen.getAllByText("Made with a kit TEST_SITE")).toHaveLength(1);
  });

  it("ouvrir une Réalisation : lien vers le Kit seulement si le Kit est publié", async () => {
    const user = userEvent.setup();
    rendre(
      <ListeMurs
        cle={`debut|${ID(7)}`}
        murs={[mur(7, { faitAvecKit: true, type: "realisation", kitSlug: "kit-test", kitTitreFr: "Kit de test", kitTitreEn: null }), mur(8, { faitAvecKit: true, type: "realisation" })]}
        suite={null}
        nomSite="TEST_SITE"
      />,
    );
    await user.click(screen.getAllByRole("button")[0]);
    expect(screen.getByRole("link", { name: "Kit de test" }).getAttribute("href")).toContain("kit-test");
    await user.keyboard("{Escape}");
    await user.click(screen.getAllByRole("button")[1]);
    expect(screen.queryByRole("link", { name: /Kit de test/ })).toBeNull();
  });

  it("« Voir plus » disparaît quand il ne reste rien, et après la dernière page chargée", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValueOnce({ ok: true, murs: [mur(4)], suite: null });
    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2), mur(3)]} suite="CURSEUR" nomSite="TEST_SITE" />);
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(3));
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
  });

  it("suite vide renvoyée par le serveur : le lien disparaît, aucune adresse réécrite", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValueOnce({ ok: true, murs: [], suite: null });
    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2), mur(3)]} suite="CURSEUR" nomSite="TEST_SITE" />);
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull());
    expect(window.location.search).toBe("");
  });

  it("erreur de lecture : message d'erreur, le lien reste", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValueOnce({ ok: false });
    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2), mur(3)]} suite="CURSEUR" nomSite="TEST_SITE" />);
    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir plus" })).toBeTruthy();
  });

  it("une entrée : une colonne, sans « Voir plus » ; deux entrées : grille à deux colonnes", () => {
    const { unmount } = rendre(<ListeMurs cle={`debut|${ID(1)}`} murs={[mur(1)]} suite={null} nomSite="TEST_SITE" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    unmount();

    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2), mur(3)]} suite="CURSEUR" nomSite="TEST_SITE" />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("page avec suite : un vrai lien « Voir plus » portant le curseur", () => {
    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2), mur(3)]} suite="CURSEUR" nomSite="TEST_SITE" />);
    expect(screen.getByRole("link", { name: "Voir plus" }).getAttribute("href")).toBe("/fr?curseur=CURSEUR");
  });

  it("dernière page : aucun « Voir plus »", () => {
    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2)]} suite={null} nomSite="TEST_SITE" />);
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
  });

  it("avec JavaScript : ajoute les murs suivants, place le focus sur le premier ajouté", async () => {
    const user = userEvent.setup();
    const suivants = [mur(4)];
    faux.chargerPlus.mockResolvedValue({ ok: true, murs: suivants, suite: "CUR2" });
    rendre(<ListeMurs cle={`debut|${ID(2)}`} murs={[mur(2), mur(3)]} suite="CURSEUR" nomSite="TEST_SITE" />);

    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(3));
    expect(faux.chargerPlus).toHaveBeenCalledWith("CURSEUR");
    expect(faux.chargerPlus).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("button")[2]));
  });
});
