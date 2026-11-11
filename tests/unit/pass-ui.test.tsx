// @vitest-environment jsdom
// Story 7.5 : Carte Pass, bouton « Agrandir » et page « Mes Pass ». Pass de test seulement ; la lecture en base est remplacée par un double nommé.
import userEvent from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";
import type { PassLu } from "@/modules/evenements/pass-types";

vi.mock("server-only", () => ({}));
const faux = vi.hoisted(() => ({
  messages: { fr: null as unknown, en: null as unknown },
  etat: vi.fn(),
  session: vi.fn(),
  lister: vi.fn(),
  annulations: vi.fn(async () => new Map()),
  versConnexion: vi.fn(),
  nomSite: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const fr = (await import("../../messages/fr.json")).default;
  const en = (await import("../../messages/en.json")).default;
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: (locale === "fr" ? fr : en) as never, namespace: namespace as never }),
  };
});
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/auth/compte", () => ({ lireEtatCompte: faux.etat, lireSessionVerifiee: faux.session }));
vi.mock("@/modules/evenements/pass-queries", () => ({ listerMesPass: faux.lister, lireAnnulationsMesPass: faux.annulations }));
vi.mock("@/modules/evenements/annulation-actions", () => ({ demanderAnnulationPassAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/commande/PageCommande", () => ({ versConnexion: faux.versConnexion }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: faux.nomSite }));

import { CartePass } from "@/components/compte/CartePass";
import { ListeMesPass } from "@/components/compte/ListeMesPass";
import { generateMetadata } from "../../src/app/[locale]/compte/pass/page";

const JETON_TEST = "0123456789abcdef0123456789abcdef0123456789abcdef";

function passDeTest(surcharge: Partial<PassLu> = {}): PassLu {
  return {
    id: "TEST_pass_1",
    nomTitulaire: "TEST_Alice",
    statut: "valide",
    typeNom: "TEST_VIP",
    jeton: JETON_TEST,
    codeCourt: "ABCD2345",
    offert: false,
    evenement: { id: "TEST_evt_1", slug: "test-evt", titre: "TEST_Festival", debutLe: "2027-03-01T14:00:00Z", finLe: null, lieu: "TEST_Salle" },
    ...surcharge,
  };
}

describe("Carte Pass", () => {
  it("montre le nom, le Type, l'Événement, la date à l'heure de Goma, le lieu, le statut, le Code QR avec son alt et le code court", () => {
    rendre(<CartePass pass={passDeTest()} />);
    expect(screen.getByRole("heading", { level: 4, name: "TEST_Alice" })).toBeTruthy();
    expect(screen.getByText("Pass TEST_VIP")).toBeTruthy();
    expect(screen.getByText("TEST_Festival")).toBeTruthy();
    expect(screen.getByText("TEST_Salle")).toBeTruthy();
    // 14:00 UTC = 16:00 à Goma (UTC+2).
    expect(screen.getByText(/16:00/)).toBeTruthy();
    expect(screen.getByText(/heure de Goma/)).toBeTruthy();
    expect(screen.getByText("Valide")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Code QR du Pass TEST_VIP de TEST_Alice, TEST_Festival" })).toBeTruthy();
    expect(screen.getByText("Code court : ABCD2345")).toBeTruthy();
  });

  it("dessine le Code QR sur fond blanc pur, 200 pixels au moins, sans jamais écrire le jeton dans la page", () => {
    const { container } = rendre(<CartePass pass={passDeTest()} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("h-52");
    expect(svg?.querySelector("rect")?.getAttribute("class")).toContain("fill-qr-background");
    expect(svg?.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    expect(container.innerHTML).not.toContain(JETON_TEST);
  });

  it("garde l'alt en anglais pour la langue anglaise", () => {
    rendre(<CartePass pass={passDeTest()} />, "en");
    expect(screen.getByRole("img", { name: "QR code of the TEST_VIP Pass of TEST_Alice, TEST_Festival" })).toBeTruthy();
    expect(screen.getByText(/Goma time/)).toBeTruthy();
  });

  it("marque un Pass offert", () => {
    rendre(<CartePass pass={passDeTest({ offert: true })} />);
    expect(screen.getByText(/Offert/)).toBeTruthy();
  });

  it.each([
    ["annule", "Annulé"],
    ["scanne", "Déjà utilisé à l'entrée"],
    ["rembourse", "Remboursé"],
  ] as const)("un Pass %s est marqué et ne montre plus de Code QR ni de code court", (statut, libelle) => {
    rendre(<CartePass pass={passDeTest({ statut })} />);
    expect(screen.getByText(libelle)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/Code court/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Agrandir/ })).toBeNull();
    expect(screen.getByText("Le Code QR n'est plus affiché pour ce Pass.")).toBeTruthy();
  });

  it("n'affiche ni date ni lieu quand l'Événement n'en a pas", () => {
    rendre(<CartePass pass={passDeTest({ evenement: { id: "e", slug: "e", titre: "TEST_Sans", debutLe: null, finLe: null, lieu: null } })} />);
    expect(screen.queryByText(/heure de Goma/)).toBeNull();
  });

  it("« Agrandir » ouvre le Code QR en grand avec le conseil de luminosité et le code court, et se ferme", async () => {
    const utilisateur = userEvent.setup();
    rendre(<CartePass pass={passDeTest()} />);
    await utilisateur.click(screen.getByRole("button", { name: /Agrandir/ }));
    const dialogue = await screen.findByRole("dialog", { name: "Code QR de TEST_Alice" });
    expect(within(dialogue).getByRole("img", { name: /Code QR du Pass TEST_VIP/ })).toBeTruthy();
    expect(within(dialogue).getByText(/Augmente la luminosité de ton écran/)).toBeTruthy();
    expect(within(dialogue).getByText("Code court : ABCD2345")).toBeTruthy();
    await utilisateur.click(within(dialogue).getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Mes Pass", () => {
  beforeEach(() => {
    faux.etat.mockReset().mockResolvedValue("complet");
    faux.session.mockReset().mockResolvedValue({ compteId: "TEST_compte" });
    faux.lister.mockReset().mockResolvedValue([]);
    faux.annulations.mockReset().mockResolvedValue(new Map());
    faux.versConnexion.mockReset().mockImplementation(() => {
      throw new Error("REDIRECT");
    });
    faux.nomSite.mockReset().mockResolvedValue("TEST_Boutique");
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
  });

  it("renvoie un visiteur non connecté vers la connexion, qui revient à Mes Pass", async () => {
    faux.etat.mockResolvedValue("anonyme");
    await expect(ListeMesPass({ locale: "fr" })).rejects.toThrow("REDIRECT");
    expect(faux.versConnexion).toHaveBeenCalledWith("fr", "/fr/compte/pass");
    expect(faux.lister).not.toHaveBeenCalled();
  });

  it("sans Pass : « Aucun pass pour le moment. » et un lien vers les événements", async () => {
    rendre(await ListeMesPass({ locale: "fr" }));
    expect(screen.getByText("Aucun pass pour le moment.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les événements" }).getAttribute("href")).toBe("/festival");
  });

  it("ne lit que les Pass du Compte connecté", async () => {
    await ListeMesPass({ locale: "fr" });
    expect(faux.lister).toHaveBeenCalledWith("TEST_compte", "fr");
  });

  it("regroupe par Événement, à venir d'abord, avec une carte par Pass", async () => {
    const futur = { id: "futur", slug: "futur", titre: "TEST_Futur", debutLe: "2099-01-01T10:00:00Z", finLe: null, lieu: null };
    const passe = { id: "passe", slug: "passe", titre: "TEST_Passe", debutLe: "2020-01-01T10:00:00Z", finLe: null, lieu: null };
    faux.lister.mockResolvedValue([
      passDeTest({ id: "p1", nomTitulaire: "TEST_Ancien", evenement: passe }),
      passDeTest({ id: "p2", nomTitulaire: "TEST_Bob", evenement: futur }),
      passDeTest({ id: "p3", nomTitulaire: "TEST_Cara", evenement: futur }),
    ]);
    rendre(await ListeMesPass({ locale: "fr" }));
    const titres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titres).toEqual(["TEST_Futur", "TEST_Passe"]);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText(/À venir/)).toBeTruthy();
    expect(screen.getByText(/Passé/)).toBeTruthy();
  });

  it("affiche une erreur sobre quand la lecture échoue, sans liste vide inventée", async () => {
    faux.lister.mockRejectedValue(new Error("base"));
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    rendre(await ListeMesPass({ locale: "fr" }));
    expect(screen.getByRole("alert").textContent).toContain("Impossible d'afficher tes Pass pour le moment.");
    expect(screen.queryByText("Aucun pass pour le moment.")).toBeNull();
    erreurs.mockRestore();
  });

  it("la page est privée : non indexée, avec son titre", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) } as never);
    expect(meta.title).toContain("Mes Pass");
    expect(JSON.stringify(meta.robots)).toMatch(/noindex|"index":false/);
  });
});
