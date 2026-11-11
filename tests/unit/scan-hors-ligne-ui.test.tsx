// @vitest-environment jsdom
// Story 7.8 : écran de Scan hors ligne. Prendre le Verrou et télécharger la liste, « Scan réservé à l'appareil hors ligne » sur les autres appareils, rappel et
// message explicite sans Verrou, verdict local identique à la story 7.6 (même composant de résultat), un même Pass refusé la seconde fois, synchronisation
// automatique au retour du réseau puis Verrou rendu et liste effacée. Actions serveur simulées et IndexedDB en mémoire (données TEST_) ; aucune caméra réelle.
import "fake-indexeddb/auto";
import { act, configure, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";
import { listeDeTest, TEST_PASS } from "../doubles/TEST_liste-hors-ligne";

// Les empreintes (HMAC, SHA-256) tournent pour de vrai dans ces tests : sur une machine chargée (CI), l'attente par défaut de 1 s est trop courte.
configure({ asyncUtilTimeout: 8000 });

const action = vi.hoisted(() => vi.fn());
const hl = vi.hoisted(() => ({
  prendre: vi.fn(),
  synchroniser: vi.fn(),
  liberer: vi.fn(),
  etat: vi.fn(),
}));
const lecteur = vi.hoisted(() => ({ lire: vi.fn(async (): Promise<string | null> => null) }));
vi.mock("@/modules/scan/actions", () => ({ scannerPassAction: action }));
vi.mock("@/modules/scan/hors-ligne-actions", () => ({
  prendreVerrouAction: hl.prendre,
  synchroniserScansAction: hl.synchroniser,
  libererVerrouAction: hl.liberer,
  lireEtatVerrouAction: hl.etat,
  forcerLiberationVerrouAction: vi.fn(),
}));
vi.mock("@/components/scan/lecteur-qr", () => ({ creerDetecteurQr: async () => ({ source: "natif", lire: lecteur.lire }), urlsAPrechauffer: () => [] }));

// Délai du serveur réduit pour le test du serveur muet (le reste du module est celui de l'application).
vi.mock("@/modules/scan/hors-ligne-types", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/modules/scan/hors-ligne-types")>()), DELAI_SERVEUR_MS: 60, SONDAGE_ETAT_MS: 80 }));

import { EcranScan } from "@/components/scan/EcranScan";

const EVENEMENT = { id: "00000000-0000-4000-8000-0000000000e1", titre: "TEST_Festival", debutLe: null, finLe: null };
const BILAN = { appliques: 2, conflits: 0, inconnus: 0, invalides: 0, dejaTraites: 0 };
let enLigne = true;

function reseau(valeur: boolean) {
  enLigne = valeur;
  act(() => {
    window.dispatchEvent(new Event(valeur ? "online" : "offline"));
  });
}

function fauxMedia() {
  const piste = { stop: vi.fn() };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [piste] }) as unknown as MediaStream) } });
}

async function ouvrirSaisie() {
  await userEvent.click(await screen.findByRole("button", { name: "Saisir le code à la main" }));
}
async function saisir(code: string) {
  const champ = screen.getByLabelText("Code court du pass");
  await userEvent.clear(champ);
  await userEvent.type(champ, code);
  await act(async () => {
    fireEvent.submit(champ.closest("form") as HTMLFormElement);
  });
}
async function suivant() {
  await userEvent.click(await screen.findByRole("button", { name: "Scanner le pass suivant" }));
}

// Prend le Verrou par le bouton de l'écran (liste de test) et attend qu'elle soit enregistrée.
async function prendreLeVerrou() {
  hl.prendre.mockResolvedValue({ ok: true, liste: listeDeTest() });
  hl.etat.mockResolvedValue({ ok: true, etat: { etat: "moi", prisLe: "2027-01-09T08:00:00.000Z", expireLe: "2027-01-10T22:00:00.000Z" } });
  await userEvent.click(await screen.findByRole("button", { name: "Prendre le Verrou hors ligne et télécharger la liste" }));
  await screen.findByText(/Verrou pris/);
}

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: new IDBFactory() });
  enLigne = true;
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => enLigne });
  for (const f of [action, hl.prendre, hl.synchroniser, hl.liberer, hl.etat, lecteur.lire]) f.mockReset();
  lecteur.lire.mockResolvedValue(null);
  hl.etat.mockResolvedValue({ ok: true, etat: { etat: "libre" } });
  hl.synchroniser.mockResolvedValue({ ok: true, bilan: BILAN });
  hl.liberer.mockResolvedValue({ ok: true, statut: "libere" });
  fauxMedia();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(async () => undefined) });
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vi.fn(() => true) });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("prendre le Verrou hors ligne", () => {
  it("sans liste enregistrée : rappel de prendre le Verrou à l'avance, de préférence la veille", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect(await screen.findByText(/de préférence la veille/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prendre le Verrou hors ligne et télécharger la liste" })).toBeTruthy();
  });

  it("le bouton prend le Verrou avec l'identifiant de l'appareil, enregistre la liste et le dit ; rien n'est affiché avant la réponse du serveur", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    expect(hl.prendre).toHaveBeenCalledTimes(1);
    expect(hl.prendre).toHaveBeenCalledWith({ evenementId: EVENEMENT.id, appareil: expect.stringMatching(/^[0-9a-f]{32}$/) });
    expect(screen.getByText(/Liste de 3 pass/)).toBeTruthy();
    expect(screen.queryByText(/de préférence la veille/)).toBeNull();
    expect(screen.getByRole("button", { name: "Synchroniser et rendre le Verrou" })).toBeTruthy();
  });

  it("refus du serveur : message d'erreur, aucune liste, aucun faux succès", async () => {
    hl.prendre.mockResolvedValue({ ok: false, erreur: "verrou_pris" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await userEvent.click(await screen.findByRole("button", { name: "Prendre le Verrou hors ligne et télécharger la liste" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Un autre appareil tient déjà le Verrou hors ligne");
    expect(screen.queryByText(/Verrou pris\./)).toBeNull();
  });

  it("un autre appareil tient le Verrou : « Scan réservé à l'appareil hors ligne », ni caméra ni saisie", async () => {
    hl.etat.mockResolvedValue({ ok: true, etat: { etat: "autre" } });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect(await screen.findByText("Scan réservé à l'appareil hors ligne")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Saisir le code à la main" })).toBeNull();
    expect(screen.queryByLabelText("Image de la caméra")).toBeNull();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Prendre le Verrou hors ligne et télécharger la liste" })).toBeNull();
  });

  it("le serveur refuse le scan parce qu'un autre appareil tient le Verrou : l'écran passe en « réservé »", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await ouvrirSaisie();
    action.mockResolvedValue({ ok: false, erreur: "verrouille" });
    await saisir("KMNP2345");
    expect(await screen.findByText("Scan réservé à l'appareil hors ligne", { selector: "p.t-body" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Saisir le code à la main" })).toBeNull();
  });

  it("l'anglais est complet", async () => {
    hl.etat.mockResolvedValue({ ok: true, etat: { etat: "autre" } });
    rendre(<EcranScan evenements={[EVENEMENT]} />, "en");
    expect(await screen.findByText("Scanning is reserved for the offline device")).toBeTruthy();
  });
});

describe("hors ligne", () => {
  it("sans Verrou pris à l'avance : message explicite, la caméra et la saisie restent, rien n'est envoyé au serveur", async () => {
    reseau(false);
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect(await screen.findByText(/aucun Verrou n'a été pris à l'avance : le scan hors ligne est impossible/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Prendre le Verrou hors ligne et télécharger la liste" })).toBeNull();
    expect(hl.etat).not.toHaveBeenCalled();
  });

  it("avec la liste : verdict local VALIDE (même écran que la story 7.6), sans appel au serveur ; le jeton n'est nulle part dans la page", async () => {
    const { container } = rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    lecteur.lire.mockResolvedValueOnce(`KOMA:PASS:${TEST_PASS[0].jeton}`).mockResolvedValue(null);
    const dialogue = await screen.findByRole("dialog", undefined, { timeout: 5000 });
    expect(dialogue.getAttribute("data-resultat-scan")).toBe("valide");
    expect(screen.getByRole("alert").textContent).toContain("VALIDE");
    expect(screen.getByRole("alert").textContent).toContain("TEST_Alice");
    expect(screen.getByRole("alert").textContent).toContain("TEST_VIP");
    expect(action).not.toHaveBeenCalled();
    expect(navigator.vibrate).toHaveBeenCalledWith(200);
    expect(container.ownerDocument.body.innerHTML).not.toContain(TEST_PASS[0].jeton);
  });

  it("un même Pass scanné deux fois hors ligne est refusé la seconde fois (par le code court cette fois), avec l'heure du premier scan", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    await ouvrirSaisie();
    await saisir(TEST_PASS[1].code);
    expect((await screen.findByRole("alert")).textContent).toContain("TEST_Bob");
    await suivant();
    await saisir(TEST_PASS[1].code);
    const refus = await screen.findByRole("alert");
    expect(refus.textContent).toContain("REFUSÉ");
    expect(refus.textContent).toMatch(/Pass déjà scanné à \d{2}:\d{2}\./);
    expect(navigator.vibrate).toHaveBeenLastCalledWith([400, 150, 400]);
    expect(action).not.toHaveBeenCalled();
    await suivant();
    await saisir("ZZZZZZZ9");
    expect((await screen.findByRole("alert")).textContent).toContain("Pass inconnu.");
  });

  it("serveur muet au-delà du délai alors que le réseau se dit présent : le scan est jugé sur la liste locale", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    action.mockReturnValue(new Promise(() => undefined));
    await ouvrirSaisie();
    await saisir(TEST_PASS[2].code);
    expect((await screen.findByRole("alert")).textContent).toContain("TEST_Cleo");
  });

  it("le panneau annonce le mode hors ligne et le nombre de scans en attente", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    expect(await screen.findByText(/Pas de connexion\. Les pass sont vérifiés avec la liste de cet appareil/)).toBeTruthy();
    await ouvrirSaisie();
    await saisir(TEST_PASS[0].code);
    await screen.findByRole("alert");
    await suivant();
    expect(await screen.findByText("1 scan en attente d'envoi.")).toBeTruthy();
  });
});

describe("en ligne avec le Verrou", () => {
  it("le scan en ligne se fait connaître par l'identifiant d'appareil ; le Pass accepté est noté : hors ligne il est refusé", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Alice", evenement: "TEST_Festival", typePass: "TEST_VIP" });
    await ouvrirSaisie();
    await saisir(TEST_PASS[0].code);
    expect((await screen.findByRole("alert")).textContent).toContain("VALIDE");
    expect(action).toHaveBeenCalledWith({ evenementId: EVENEMENT.id, code: TEST_PASS[0].code, appareil: expect.stringMatching(/^[0-9a-f]{32}$/) });
    await suivant();
    reseau(false);
    await saisir(TEST_PASS[0].code);
    expect((await screen.findByRole("alert")).textContent).toContain("REFUSÉ");
    // Le scan fait en ligne est déjà connu du serveur : rien à synchroniser.
    expect(screen.getByText("Aucun scan en attente d'envoi.")).toBeTruthy();
  });
});

describe("retour du réseau", () => {
  it("synchronise automatiquement (empreintes seulement), puis rend le Verrou, puis efface la liste locale", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    await ouvrirSaisie();
    await saisir(TEST_PASS[0].code);
    await screen.findByRole("alert");
    await suivant();
    await saisir(TEST_PASS[1].code);
    await screen.findByRole("alert");
    await suivant();
    expect(hl.synchroniser).not.toHaveBeenCalled();
    reseau(true);
    await waitFor(() => expect(hl.liberer).toHaveBeenCalledTimes(1));
    expect(hl.synchroniser).toHaveBeenCalledTimes(1);
    const lot = hl.synchroniser.mock.calls[0][0];
    expect(lot.scans).toHaveLength(2);
    expect(lot.scans.map((s: { nature: string }) => s.nature)).toEqual(["code", "code"]);
    expect(JSON.stringify(lot)).not.toContain(TEST_PASS[0].code);
    expect(JSON.stringify(lot)).not.toContain(TEST_PASS[0].jeton);
    expect(hl.synchroniser.mock.invocationCallOrder[0]).toBeLessThan(hl.liberer.mock.invocationCallOrder[0]);
    expect(await screen.findByText(/Synchronisation terminée : 2 scans enregistrés\. Le Verrou est rendu et la liste de cet appareil est effacée\./)).toBeTruthy();
    // Liste effacée : le rappel de prendre le Verrou revient.
    expect(await screen.findByText(/de préférence la veille/)).toBeTruthy();
  });

  it("des conflits sont annoncés ; si le réseau retombe en route, rien n'est effacé et le bouton permet de réessayer", async () => {
    hl.synchroniser.mockResolvedValueOnce({ ok: false, erreur: "generique" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    await ouvrirSaisie();
    await saisir(TEST_PASS[0].code);
    await screen.findByRole("alert");
    await suivant();
    reseau(true);
    expect(await screen.findByText(/La synchronisation n'a pas abouti/)).toBeTruthy();
    expect(hl.liberer).not.toHaveBeenCalled();
    expect(screen.getByText("1 scan en attente d'envoi.")).toBeTruthy();
    hl.synchroniser.mockResolvedValueOnce({ ok: true, bilan: { ...BILAN, appliques: 0, conflits: 1 } });
    await userEvent.click(screen.getByRole("button", { name: "Synchroniser et rendre le Verrou" }));
    expect(await screen.findByText(/1 scan n'a pas pu être appliqué/)).toBeTruthy();
    expect(hl.liberer).toHaveBeenCalledTimes(1);
  });

  it("sans scan en attente, une coupure brève ne rend pas le Verrou toute seule", async () => {
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    reseau(true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(hl.synchroniser).not.toHaveBeenCalled();
    expect(hl.liberer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Synchroniser et rendre le Verrou" })).toBeTruthy();
  });

  it("Verrou libéré de force : l'écran le dit, les scans sont gardés, et la liste peut être effacée à la main", async () => {
    hl.synchroniser.mockResolvedValue({ ok: false, erreur: "verrou_absent" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    await ouvrirSaisie();
    await saisir(TEST_PASS[0].code);
    await screen.findByRole("alert");
    await suivant();
    reseau(true);
    expect((await screen.findByText(/Le Verrou de cet appareil n'est plus valable\. 1 scan n'a pas pu être envoyé\./)).textContent).toBeTruthy();
    expect(hl.liberer).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Effacer la liste de cet appareil" }));
    expect(await screen.findByText("La liste de cet appareil est effacée.")).toBeTruthy();
  });
});

describe("navigateur sans stockage local", () => {
  it("l'écran de la story 7.6 reste intact et le dit", async () => {
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: undefined });
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Bob", evenement: "TEST_Festival", typePass: "TEST_Simple" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    expect(await screen.findByText(/Le scan hors ligne n'est pas disponible sur ce navigateur/)).toBeTruthy();
    await ouvrirSaisie();
    await saisir("KMNP2345");
    expect((await screen.findByRole("alert")).textContent).toContain("TEST_Bob");
    expect(action).toHaveBeenCalledWith({ evenementId: EVENEMENT.id, code: "KMNP2345" });
  });
});

describe("correctifs de revue", () => {
  it("wifi sans Internet : si l'état du Verrou ne répond jamais, la caméra démarre au bout du délai du scan", async () => {
    hl.etat.mockReturnValue(new Promise(() => undefined));
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
  });

  it("« Scan réservé » : le bouton Réessayer relit l'état et rouvre l'écran quand le Verrou est rendu", async () => {
    hl.etat.mockResolvedValueOnce({ ok: true, etat: { etat: "autre" } }).mockResolvedValue({ ok: true, etat: { etat: "autre" } });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await screen.findByText("Scan réservé à l'appareil hors ligne");
    hl.etat.mockResolvedValue({ ok: true, etat: { etat: "libre" } });
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("button", { name: "Saisir le code à la main" })).toBeTruthy();
    expect(screen.queryByText("Scan réservé à l'appareil hors ligne")).toBeNull();
  });

  it("« Scan réservé » : sondage régulier, l'écran se rouvre tout seul quand le Verrou est rendu", async () => {
    hl.etat.mockResolvedValue({ ok: true, etat: { etat: "autre" } });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await screen.findByText("Scan réservé à l'appareil hors ligne");
    hl.etat.mockResolvedValue({ ok: true, etat: { etat: "libre" } });
    expect(await screen.findByRole("button", { name: "Saisir le code à la main" })).toBeTruthy();
  });

  it("pendant l'envoi des scans, aucun nouveau scan n'est jugé ; il est refusé avec un message, puis tout reprend", async () => {
    let finir: (v: unknown) => void = () => undefined;
    hl.synchroniser.mockImplementationOnce(() => new Promise((resolu) => (finir = resolu)));
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await prendreLeVerrou();
    reseau(false);
    await ouvrirSaisie();
    await saisir(TEST_PASS[0].code);
    await screen.findByRole("alert");
    await suivant();
    reseau(true);
    await waitFor(() => expect(hl.synchroniser).toHaveBeenCalledTimes(1));
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Bob", evenement: "TEST_Festival", typePass: "TEST_Simple" });
    await saisir(TEST_PASS[1].code);
    expect((await screen.findByRole("alert")).textContent).toContain("Synchronisation en cours : ce scan n'est pas validé");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
    await act(async () => finir({ ok: true, bilan: BILAN }));
    await screen.findByText(/Synchronisation terminée/);
  });

  it("un autre Compte sur le même appareil ne retrouve pas la liste du précédent", async () => {
    const premier = rendre(<EcranScan evenements={[EVENEMENT]} compteId="compte-A" />);
    await prendreLeVerrou();
    premier.unmount();
    hl.etat.mockResolvedValue({ ok: true, etat: { etat: "libre" } });
    rendre(<EcranScan evenements={[EVENEMENT]} compteId="compte-B" />);
    expect(await screen.findByText(/de préférence la veille/)).toBeTruthy();
    expect(screen.queryByText(/Liste de 3 pass/)).toBeNull();
  });
});

describe("focus après « Scanner le pass suivant » (course trouvée en CI lente)", () => {
  it("le retour du focus, différé, ne vole pas la frappe d'un bénévole qui a déjà commencé à saisir le code suivant", async () => {
    // Le navigateur exécute le rappel d'animation tard (machine chargée) : on le retient puis on le rejoue au milieu de la saisie.
    const rappels: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((f) => (rappels.push(f), rappels.length));
    action.mockResolvedValue({ ok: true, resultat: "valide", nom: "TEST_Bob", evenement: "TEST_Festival", typePass: "TEST_Simple" });
    rendre(<EcranScan evenements={[EVENEMENT]} />);
    await ouvrirSaisie();
    await saisir(TEST_PASS[1].code);
    await screen.findByRole("alert");
    await suivant();
    const champ = screen.getByLabelText("Code court du pass") as HTMLInputElement;
    await userEvent.click(champ);
    await userEvent.type(champ, TEST_PASS[1].code.slice(0, 4));
    act(() => rappels.forEach((f) => f(0)));
    await userEvent.type(champ, TEST_PASS[1].code.slice(4), { skipClick: true });
    expect(champ.value).toBe(TEST_PASS[1].code);
    expect(document.activeElement).toBe(champ);
    vi.restoreAllMocks();
  });
});
