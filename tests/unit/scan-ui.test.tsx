// @vitest-environment jsdom
// Story 7.6 : écran de Scan. Résultat plein écran (VALIDE / REFUSÉ), annonce en alerte, vibration, retour à la caméra, caméra refusée, saisie à la main.
// Action serveur et lecteur de Code QR simulés (données TEST_) ; aucune caméra réelle.
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const action = vi.hoisted(() => vi.fn());
const lecteur = vi.hoisted(() => ({ lire: vi.fn(async (): Promise<string | null> => null), creer: vi.fn() }));
vi.mock("@/modules/scan/actions", () => ({ scannerPassAction: action }));
vi.mock("@/components/scan/lecteur-qr", () => ({ creerDetecteurQr: () => lecteur.creer() }));

import { EcranScan } from "@/components/scan/EcranScan";
import { ResultatPlein } from "@/components/scan/ResultatPlein";

const EVENEMENT = { id: "00000000-0000-4000-8000-0000000000e1", titre: "TEST_Festival", debutLe: null, finLe: null };
const JETON = "ab".repeat(24);

function fauxMedia(comportement: "ok" | "refuse" | "absent") {
  const piste = { stop: vi.fn() };
  const getUserMedia = vi.fn(async () => {
    if (comportement === "refuse") throw new DOMException("refusé", "NotAllowedError");
    return { getTracks: () => [piste] } as unknown as MediaStream;
  });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: comportement === "absent" ? undefined : { getUserMedia } });
  return { piste, getUserMedia };
}

beforeEach(() => {
  action.mockReset();
  lecteur.lire.mockReset();
  lecteur.lire.mockResolvedValue(null);
  lecteur.creer.mockReset();
  lecteur.creer.mockImplementation(async () => ({ source: "natif", lire: lecteur.lire }));
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(async () => undefined) });
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vi.fn(() => true) });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("résultat plein écran", () => {
  it("VALIDE : mot, grande coche, nom, Type de pass et Événement, annoncé en alerte", () => {
    const suivant = vi.fn();
    const { container } = rendre(<ResultatPlein type="valide" nom="TEST_Alice" typePass="TEST_VIP" evenement="TEST_Festival" onSuivant={suivant} />);
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("VALIDE");
    expect(alerte.textContent).toContain("TEST_Alice");
    expect(alerte.textContent).toContain("TEST_VIP");
    expect(alerte.textContent).toContain("TEST_Festival");
    const fond = container.querySelector("[data-resultat-scan='valide']") as HTMLElement;
    expect(fond.className).toContain("bg-scan-valide");
    expect(fond.className).not.toContain("bg-success");
    expect(fond.querySelector("svg path")?.getAttribute("d")).toBe("M5 12.5l4.5 4.5L19 7.5");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Scanner le pass suivant" }));
  });
  it("vrai dialogue modal : role dialog, aria-modal, nommé par le verdict, focus gardé, Échap = suivant", async () => {
    const suivant = vi.fn();
    rendre(<ResultatPlein type="refuse" raison="annule" heure={null} onSuivant={suivant} />);
    const dialogue = screen.getByRole("dialog", { name: "REFUSÉ" });
    expect(dialogue.getAttribute("aria-modal")).toBe("true");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Scanner le pass suivant" }));
    await userEvent.keyboard("{Escape}");
    expect(suivant).toHaveBeenCalledTimes(1);
  });
  it("REFUSÉ : mot, grande croix et raison ; fond danger fixe", () => {
    const { container } = rendre(<ResultatPlein type="refuse" raison="annule" heure={null} onSuivant={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain("REFUSÉ");
    expect(screen.getByRole("alert").textContent).toContain("Pass annulé.");
    const fond = container.querySelector("[data-resultat-scan='refuse']") as HTMLElement;
    expect(fond.className).toContain("bg-scan-refuse");
    expect(fond.querySelector("svg path")?.getAttribute("d")).toBe("M6 6l12 12M18 6L6 18");
  });
  it("déjà scanné : l'heure du premier scan est affichée", () => {
    rendre(<ResultatPlein type="refuse" raison="deja_scanne" heure="09:41" onSuivant={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain("Pass déjà scanné à 09:41.");
  });
  it("anglais : VALID / REFUSED / Scan next pass", () => {
    rendre(<ResultatPlein type="valide" nom="A" typePass="B" evenement="C" onSuivant={() => {}} />, "en");
    expect(screen.getByRole("alert").textContent).toContain("VALID");
    expect(screen.getByRole("button", { name: "Scan next pass" })).toBeTruthy();
  });
  it("aucun son : pas d'élément audio", () => {
    const { container } = rendre(<ResultatPlein type="valide" nom="A" typePass="B" evenement="C" onSuivant={() => {}} />);
    expect(container.querySelector("audio")).toBeNull();
  });
});

describe("écran de Scan", () => {
  it("aucun événement : message, pas de caméra", () => {
    const media = fauxMedia("ok");
    rendre(<EcranScan evenements={[]} />);
    expect(screen.getByText(/Aucun événement publié/)).toBeTruthy();
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it("plusieurs événements : la caméra attend le choix de l'Événement", async () => {
    const media = fauxMedia("ok");
    rendre(<EcranScan evenements={[EVENEMENT, { ...EVENEMENT, id: "00000000-0000-4000-8000-0000000000e2", titre: "TEST_Autre" }]} />);
    expect(media.getUserMedia).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText("Événement à scanner"), EVENEMENT.id);
    await waitFor(() => expect(media.getUserMedia).toHaveBeenCalledTimes(1));
  });

  it("caméra refusée : message demandé, instructions en texte, saisie à la main toujours là", async () => {
    fauxMedia("refuse");
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Autorise l'accès à la caméra pour scanner les pass.");
    expect(screen.getByText(/ouvre les permissions de ce site/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saisir le code à la main" })).toBeTruthy();
  });

  it("Code QR lu : VALIDE plein écran, vibration courte, puis « Scanner le pass suivant » revient à la caméra", async () => {
    fauxMedia("ok");
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Alice", evenement: "TEST_Festival", typePass: "TEST_VIP" });
    lecteur.lire.mockResolvedValueOnce(`KOMA:PASS:${JETON}`).mockResolvedValue(null);
    const { container } = rendre(<EcranScan evenements={[EVENEMENT]} />);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(action).toHaveBeenCalledWith({ evenementId: EVENEMENT.id, charge: `KOMA:PASS:${JETON}` });
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("VALIDE");
    expect(navigator.vibrate).toHaveBeenCalledWith(200);
    // Le jeton n'apparaît nulle part dans la page.
    expect(container.ownerDocument.body.textContent).not.toContain(JETON);
    expect(container.ownerDocument.body.innerHTML).not.toContain(JETON);
    await userEvent.click(screen.getByRole("button", { name: "Scanner le pass suivant" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("pendant le résultat le reste de la page est inerte ; ensuite le focus revient au bouton de saisie à la main", async () => {
    fauxMedia("ok");
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Alice", evenement: "TEST_Festival", typePass: "TEST_VIP" });
    lecteur.lire.mockResolvedValueOnce(`KOMA:PASS:${JETON}`).mockResolvedValue(null);
    const { container } = rendre(<EcranScan evenements={[EVENEMENT]} />);
    await screen.findByRole("dialog", undefined, { timeout: 5000 });
    expect(container.querySelector("[inert]")).toBeTruthy();
    expect(container.querySelector("[inert]")?.contains(screen.getByRole("button", { name: "Saisir le code à la main" }))).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Scanner le pass suivant" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("[inert]")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Saisir le code à la main" })));
  });

  it("lecteur qui échoue : les pistes de la caméra sont arrêtées", async () => {
    const media = fauxMedia("ok");
    lecteur.creer.mockRejectedValueOnce(new Error("TEST_wasm"));
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect(await screen.findByText(/Le lecteur de Code QR n'a pas pu démarrer/)).toBeTruthy();
    expect(media.piste.stop).toHaveBeenCalled();
  });

  it("onglet en arrière-plan : la caméra est relâchée, puis rouverte au retour", async () => {
    const media = fauxMedia("ok");
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await waitFor(() => expect(screen.queryByText("Ouverture de la caméra...")).toBeNull());
    const etat = vi.spyOn(document, "visibilityState", "get");
    etat.mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(media.piste.stop).toHaveBeenCalled();
    etat.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(media.getUserMedia).toHaveBeenCalledTimes(2));
    etat.mockRestore();
  });

  it("la saisie à la main n'envoie rien pendant un résultat affiché", async () => {
    fauxMedia("absent");
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Bob", evenement: "TEST_Festival", typePass: "TEST_Simple" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await userEvent.click(await screen.findByRole("button", { name: "Saisir le code à la main" }));
    const champ = screen.getByLabelText("Code court du pass");
    await userEvent.type(champ, "KMNP2345");
    const formulaire = champ.closest("form") as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(formulaire);
      fireEvent.submit(formulaire);
    });
    await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.submit(formulaire);
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("refus : deux longues vibrations, raison affichée", async () => {
    fauxMedia("ok");
    action.mockResolvedValue({ ok: true, resultat: "refuse", raison: "autre_evenement", scanneLe: null });
    lecteur.lire.mockResolvedValueOnce(`KOMA:PASS:${JETON}`).mockResolvedValue(null);
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect((await screen.findByRole("alert", undefined, { timeout: 5000 })).textContent).toContain("Pass d'un autre événement.");
    expect(navigator.vibrate).toHaveBeenCalledWith([400, 150, 400]);
  });

  it("sans navigator.vibrate : l'affichage suffit", async () => {
    fauxMedia("ok");
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
    action.mockResolvedValue({ ok: true, resultat: "refuse", raison: "annule", scanneLe: null });
    lecteur.lire.mockResolvedValueOnce(`KOMA:PASS:${JETON}`).mockResolvedValue(null);
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect((await screen.findByRole("alert", undefined, { timeout: 5000 })).textContent).toContain("REFUSÉ");
  });

  it("un Code QR étranger est refusé sans appel au serveur", async () => {
    fauxMedia("ok");
    lecteur.lire.mockResolvedValueOnce("https://exemple.test/promo").mockResolvedValue(null);
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect((await screen.findByRole("alert", undefined, { timeout: 5000 })).textContent).toContain("Ce Code QR n'est pas un pass KOMA.");
    expect(action).not.toHaveBeenCalled();
  });

  it("erreur de service : ni VALIDE ni REFUSÉ, message d'erreur", async () => {
    fauxMedia("ok");
    action.mockResolvedValue({ ok: false, erreur: "generique" });
    lecteur.lire.mockResolvedValueOnce(`KOMA:PASS:${JETON}`).mockResolvedValue(null);
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect((await screen.findByText(/Le résultat n'a pas pu être vérifié/, undefined, { timeout: 5000 })).textContent).toBeTruthy();
    expect(screen.queryByText("VALIDE")).toBeNull();
    expect(screen.queryByText("REFUSÉ")).toBeNull();
  });

  it("saisie à la main : envoie le code tel que saisi, même sans caméra", async () => {
    fauxMedia("absent");
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Bob", evenement: "TEST_Festival", typePass: "TEST_Simple" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await userEvent.click(await screen.findByRole("button", { name: "Saisir le code à la main" }));
    await userEvent.type(screen.getByLabelText("Code court du pass"), "kmnp-2345");
    await act(async () => {
      fireEvent.submit(screen.getByLabelText("Code court du pass").closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(action).toHaveBeenCalledWith({ evenementId: EVENEMENT.id, code: "kmnp-2345" }));
    expect((await screen.findByRole("alert")).textContent).toContain("TEST_Bob");
  });

  it("la caméra est relâchée quand l'écran se ferme", async () => {
    const media = fauxMedia("ok");
    const { unmount } = rendre(<EcranScan evenements={[EVENEMENT]} />);
    await waitFor(() => expect(media.getUserMedia).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Ouverture de la caméra...")).toBeNull());
    unmount();
    expect(media.piste.stop).toHaveBeenCalled();
  });
});
