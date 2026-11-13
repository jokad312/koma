// @vitest-environment jsdom
// Story 9.12 : espace personnel. Pseudo, blocs remplis, blocs vides (message et lien), bloc en erreur sans toucher les autres.
// Les lectures en base sont remplacées par des doubles nommés ; données TEST_ seulement (règle 13).
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";
import type { PassLu } from "@/modules/evenements/pass-types";
import { initiales, pseudoDepuisClaims } from "@/modules/espace/pseudo";

vi.mock("server-only", () => ({}));
const faux = vi.hoisted(() => ({
  commandes: vi.fn(),
  kits: vi.fn(),
  progressions: vi.fn(),
  pass: vi.fn(),
  scan: vi.fn(),
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
vi.mock("@/modules/commande/queries", () => ({ listerCommandes: faux.commandes }));
vi.mock("@/modules/bibliotheque/queries", () => ({ lireBibliotheque: faux.kits, lireProgressions: faux.progressions }));
vi.mock("@/modules/evenements/pass-queries", () => ({ listerMesPass: faux.pass }));
vi.mock("@/lib/auth/arrivee-serveur", () => ({ accesScanValideMaintenant: faux.scan }));
vi.mock("@/components/layout/BoutonDeconnexion", () => ({ BoutonDeconnexion: () => <button type="submit">Se déconnecter</button> }));

import {
  AccesRapidesEspace,
  BlocCommandesEspace,
  BlocEvenementsEspace,
  BlocKitsEspace,
  BlocPassEspace,
} from "@/components/compte/espace/BlocsEspace";
import { EnTeteEspace } from "@/components/compte/espace/EnTeteEspace";

const P = { compteId: "TEST_compte", locale: "fr" as const };

function passDeTest(surcharge: Partial<PassLu> = {}, evenement: Partial<PassLu["evenement"]> = {}): PassLu {
  return {
    id: "TEST_pass_1",
    nomTitulaire: "TEST_Alice",
    statut: "valide",
    typeNom: "TEST_VIP",
    jeton: "0123456789abcdef0123456789abcdef0123456789abcdef",
    codeCourt: "ABCD2345",
    offert: false,
    evenement: { id: "TEST_evt_1", slug: "test-evt", titre: "TEST_Festival", debutLe: "2099-03-01T14:00:00Z", finLe: null, lieu: "TEST_Salle", ...evenement },
    ...surcharge,
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  faux.commandes.mockReset().mockResolvedValue({ commandes: [], reste: false });
  faux.kits.mockReset().mockResolvedValue([]);
  faux.progressions.mockReset().mockResolvedValue([]);
  faux.pass.mockReset().mockResolvedValue([]);
  faux.scan.mockReset().mockResolvedValue(false);
});

describe("pseudo et initiales", () => {
  it("nom Google (full_name puis name), sinon début de l'email", () => {
    expect(pseudoDepuisClaims({ email: "a@b.c", user_metadata: { full_name: "TEST Alice Exemple" } })).toBe("TEST Alice Exemple");
    expect(pseudoDepuisClaims({ email: "a@b.c", user_metadata: { name: "TEST Bob" } })).toBe("TEST Bob");
    expect(pseudoDepuisClaims({ email: "test.jonathan@example.invalid", user_metadata: { full_name: "  " } })).toBe("test.jonathan");
    expect(pseudoDepuisClaims({ user_metadata: {} })).toBeNull();
    expect(pseudoDepuisClaims(null)).toBeNull();
  });

  it("deux initiales au plus, en majuscules", () => {
    expect(initiales("TEST Alice Exemple")).toBe("TA");
    expect(initiales("jonathan.manduara")).toBe("JM");
    expect(initiales("zoe")).toBe("Z");
    expect(initiales(null)).toBe("");
  });

  it("« Bonjour [pseudo] » est le H1 ; les initiales sont décoratives", async () => {
    const { container } = rendre(await EnTeteEspace({ pseudo: "TEST Alice", locale: "fr" }));
    expect(screen.getByRole("heading", { level: 1, name: "Bonjour TEST Alice" })).toBeTruthy();
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("TA");
  });
});

describe("Mes commandes", () => {
  it("numéro (lien), date, montant et statut", async () => {
    faux.commandes.mockResolvedValue({ commandes: [{ numero: "KS-2099-000001", statut: "payee", creeLe: "2099-01-02T10:00:00Z", totalCents: 4500, offerte: false, reclamation: null }], reste: true });
    rendre(await BlocCommandesEspace(P));
    expect(screen.getByRole("link", { name: "Commande KS-2099-000001" }).getAttribute("href")).toBe("/commande/KS-2099-000001");
    expect(screen.getByText(/45/)).toBeTruthy();
    expect(screen.getByText(/Payée/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir toutes mes commandes" })).toBeTruthy();
  });

  it("sans commande : message et lien", async () => {
    rendre(await BlocCommandesEspace(P));
    expect(screen.getByText("Tu n'as pas encore de commande.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les cosplays" })).toBeTruthy();
  });

  it("lecture en erreur : message d'erreur du bloc", async () => {
    faux.commandes.mockRejectedValue(new Error("TEST"));
    rendre(await BlocCommandesEspace(P));
    expect(screen.getByRole("alert").textContent).toContain("Tes commandes ne peuvent pas être affichées");
  });
});

describe("Mes kits", () => {
  it("« Reprendre au chapitre N » vers la vidéo et « Télécharger les fichiers »", async () => {
    faux.kits.mockResolvedValue([{ produitId: "TEST_k1", slug: "test-kit", titre: { fr: "TEST_Kit", en: null }, vignette: null }]);
    faux.progressions.mockResolvedValue([{ produitId: "TEST_k1", positionSecondes: 130, maxPositionSecondes: 130, terminee: false, debuts: [0, 60, 120, 180] }]);
    rendre(await BlocKitsEspace(P));
    expect(screen.getByRole("heading", { level: 3, name: "TEST_Kit" })).toBeTruthy();
    const reprendre = screen.getByRole("link", { name: "Reprendre au chapitre 3 : TEST_Kit" });
    expect(reprendre.textContent).toBe("Reprendre au chapitre 3");
    expect(reprendre.getAttribute("href")).toBe("/compte/bibliotheque/test-kit#video-titre");
    expect(screen.getByRole("link", { name: "Télécharger les fichiers de TEST_Kit" }).getAttribute("href")).toBe("/compte/bibliotheque/test-kit#fichiers-titre");
  });

  it("sur /en sans titre anglais : titre français marqué lang=fr", async () => {
    faux.kits.mockResolvedValue([{ produitId: "TEST_k1", slug: "test-kit", titre: { fr: "TEST_Kit", en: null }, vignette: null }]);
    rendre(await BlocKitsEspace({ ...P, locale: "en" }), "en");
    expect(screen.getByRole("heading", { level: 3, name: "TEST_Kit" }).getAttribute("lang")).toBe("fr");
  });

  it("sans lecture commencée : « Ouvrir le kit »", async () => {
    faux.kits.mockResolvedValue([{ produitId: "TEST_k1", slug: "test-kit", titre: { fr: "TEST_Kit", en: null }, vignette: null }]);
    rendre(await BlocKitsEspace(P));
    expect(screen.getByRole("link", { name: "Ouvrir le kit TEST_Kit" })).toBeTruthy();
  });

  it("sans kit : message et lien", async () => {
    rendre(await BlocKitsEspace(P));
    expect(screen.getByText("Tu n'as pas encore de kit.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les kits" })).toBeTruthy();
  });
});

describe("Mes Pass et Mes événements", () => {
  it("Pass : événement, type, date, Code QR et statut", async () => {
    faux.pass.mockResolvedValue([passDeTest()]);
    rendre(await BlocPassEspace(P));
    const carte = screen.getByRole("heading", { level: 3, name: "TEST_Festival" }).closest("li")!;
    expect(within(carte).getByText("Pass TEST_VIP")).toBeTruthy();
    expect(within(carte).getByText("Valide")).toBeTruthy();
    expect(within(carte).getByRole("img", { name: "Code QR du Pass TEST_VIP de TEST_Alice, TEST_Festival" })).toBeTruthy();
  });

  it("événements à venir puis passés, lien de galerie pour un passé qui en a une", async () => {
    faux.pass.mockResolvedValue([
      passDeTest({ id: "TEST_p2" }, { id: "TEST_evt_2", slug: "passe", titre: "TEST_Passe", debutLe: "2001-01-01T10:00:00Z", galerieUrl: "https://photos.app.goo.gl/TEST" }),
      passDeTest(),
    ]);
    rendre(await BlocEvenementsEspace(P));
    const titres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titres).toEqual(["À venir", "Passés"]);
    expect(screen.getByRole("link", { name: "TEST_Festival" }).getAttribute("href")).toBe("/festival/test-evt");
    expect(screen.getByRole("link", { name: /Voir la galerie de TEST_Passe/ }).getAttribute("href")).toBe("https://photos.app.goo.gl/TEST");
  });

  it("une lecture en erreur n'affiche que le message des deux blocs concernés", async () => {
    faux.pass.mockRejectedValue(new Error("TEST"));
    rendre(
      <>
        {await BlocPassEspace(P)}
        {await BlocEvenementsEspace(P)}
        {await BlocKitsEspace(P)}
      </>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("Tu n'as pas encore de kit.")).toBeTruthy();
  });

  it("sans Pass : message et lien vers les événements", async () => {
    rendre(await BlocPassEspace(P));
    expect(screen.getByText("Tu n'as pas encore de Pass.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les événements" }).getAttribute("href")).toBe("/festival");
  });
});

describe("Accès rapides", () => {
  it("photo, préférences et déconnexion ; « Scanner les Pass » seulement avec un accès bénévole valide", async () => {
    rendre(await AccesRapidesEspace(P));
    expect(screen.getByRole("link", { name: "Envoyer une photo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Préférences" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Scanner les Pass" })).toBeNull();
  });

  it("lecture de l'accès bénévole en erreur : le bloc reste, sans la carte Scanner", async () => {
    faux.scan.mockRejectedValue(new Error("TEST"));
    rendre(await AccesRapidesEspace(P));
    expect(screen.getByRole("link", { name: "Préférences" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Scanner les Pass" })).toBeNull();
  });

  it("bénévole avec accès valide : carte « Scanner les Pass »", async () => {
    faux.scan.mockResolvedValue(true);
    rendre(await AccesRapidesEspace(P));
    expect(screen.getByRole("link", { name: "Scanner les Pass" }).getAttribute("href")).toBe("/scan");
  });
});
