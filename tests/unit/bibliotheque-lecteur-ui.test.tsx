// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerProgression: vi.fn(),
  hlsInstances: [] as Array<{ source: string; destroyed: boolean; options: Record<string, unknown>; ecouteurs: Record<string, (...a: unknown[]) => void> }>,
  supporte: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/bibliotheque/actions", () => ({ enregistrerProgression: (...a: unknown[]) => faux.enregistrerProgression(...a) }));
vi.mock("hls.js", () => {
  class Hls {
    static Events = { ERROR: "error", MANIFEST_PARSED: "manifest" };
    static isSupported = () => faux.supporte;
    entree: (typeof faux.hlsInstances)[number];
    constructor(options: Record<string, unknown>) {
      this.entree = { source: "", destroyed: false, options, ecouteurs: {} };
      faux.hlsInstances.push(this.entree);
    }
    on(nom: string, f: (...a: unknown[]) => void) {
      this.entree.ecouteurs[nom] = f;
    }
    loadSource(s: string) {
      this.entree.source = s;
    }
    attachMedia() {
      // Le manifeste est lu : le lecteur est prêt.
      this.entree.ecouteurs.manifest?.();
    }
    destroy() {
      this.entree.destroyed = true;
    }
  }
  return { default: Hls };
});

import { LecteurVideoKit } from "@/components/bibliotheque/LecteurVideoKit";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";
const CHAPITRES = [
  { id: "c1", titre: "Découpe", debutSecondes: 0 },
  { id: "c2", titre: "Assemblage", debutSecondes: 120 },
  { id: "c3", titre: "Finitions", debutSecondes: 300 },
];
const props = { produitId: PRODUIT, slug: "kit-test", titre: "Casque test", locale: "fr" as const, dureeSecondes: 600, chapitres: CHAPITRES, sousTitres: ["fr", "en"] as Array<"fr" | "en"> };
const LECTURE = {
  playlist: "https://TEST.invalid/bcdn_token=x/playlist.m3u8",
  sousTitres: [
    { langue: "fr", src: "https://TEST.invalid/fr.vtt" },
    { langue: "en", src: "https://TEST.invalid/en.vtt" },
  ],
  positionSecondes: 130,
  dureeSecondes: 600,
  expireLe: 1,
};
const fetchFaux = vi.fn();
const lecture = vi.fn(async () => undefined);
const pause = vi.fn();

function reponse(statut: number, corps: unknown) {
  return { ok: statut >= 200 && statut < 300, status: statut, json: async () => corps };
}

beforeEach(() => {
  faux.hlsInstances.length = 0;
  faux.supporte = true;
  faux.enregistrerProgression.mockResolvedValue({ ok: true });
  // Un nouvel objet à chaque réponse, comme un vrai JSON : un « Réessayer » doit relancer le lecteur.
  fetchFaux.mockImplementation(async () => reponse(200, { ...LECTURE }));
  vi.stubGlobal("fetch", fetchFaux);
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: lecture });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LecteurVideoKit : accès et chargement", () => {
  it("demande le jeton au serveur, puis charge la playlist signée avec hls.js, en reprenant à la dernière position", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    expect(fetchFaux).toHaveBeenCalledWith("/api/kits/video/kit-test", expect.objectContaining({ cache: "no-store" }));
    expect(faux.hlsInstances[0].source).toBe(LECTURE.playlist);
    expect(faux.hlsInstances[0].options.startPosition).toBe(130);
    // Démarrage prudent pour les connexions lentes (3G).
    expect(faux.hlsInstances[0].options.abrEwmaDefaultEstimate).toBeLessThanOrEqual(1_000_000);
  });
  it("sans accès (403) ou session terminée (401) : message, aucun lecteur hls.js", async () => {
    fetchFaux.mockResolvedValueOnce(reponse(403, { erreur: "refuse" }));
    rendre(<LecteurVideoKit {...props} />);
    expect(await screen.findByText("Tu n'as pas accès à cette vidéo.")).toBeTruthy();
    expect(faux.hlsInstances.length).toBe(0);
  });
  it("session terminée (401) : invitation à se reconnecter", async () => {
    fetchFaux.mockResolvedValueOnce(reponse(401, { erreur: "non_connecte" }));
    rendre(<LecteurVideoKit {...props} />);
    expect(await screen.findByText("Ta session a pris fin. Connecte-toi à nouveau.")).toBeTruthy();
  });
  it("navigateur sans hls.js : message d'état", async () => {
    faux.supporte = false;
    rendre(<LecteurVideoKit {...props} />);
    expect(await screen.findByText("Ton navigateur ne sait pas lire cette vidéo.")).toBeTruthy();
  });
});

describe("LecteurVideoKit : aucun téléchargement", () => {
  it("ni bouton ni lien de téléchargement, ni attribut download, ni commande native", async () => {
    const { container } = rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[download]")).toBeNull();
    expect(container.querySelector("video")?.hasAttribute("controls")).toBe(false);
    expect(screen.queryByRole("button", { name: /télécharger|download/i })).toBeNull();
  });
});

describe("LecteurVideoKit : clavier et ARIA", () => {
  it("piste temporelle : slider avec valeur en texte, déplacement au clavier", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    const slider = screen.getByRole("slider", { name: "Position dans la vidéo" });
    expect(slider.getAttribute("aria-valuetext")).toBe("0 min 0 s sur 10 min 0 s");
    fireEvent.change(slider, { target: { value: "125" } });
    expect((screen.getByRole("slider", { name: "Position dans la vidéo" }) as HTMLInputElement).value).toBe("125");
    expect(screen.getByRole("slider", { name: "Position dans la vidéo" }).getAttribute("aria-valuetext")).toBe("2 min 5 s sur 10 min 0 s");
  });
  it("chapitres : boutons, le chapitre courant porte aria-current, un clic saute au chapitre et lit", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    const boutons = screen.getAllByRole("button", { name: /début à/ });
    expect(boutons.length).toBe(3);
    expect(boutons[0].getAttribute("aria-current")).toBe("true");
    await userEvent.click(boutons[2]);
    expect(lecture).toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /début à/ })[2].getAttribute("aria-current")).toBe("true");
    expect(screen.getAllByRole("button", { name: /début à/ })[0].getAttribute("aria-current")).toBeNull();
  });
  it("lecture/pause et plein écran sont des boutons", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    await userEvent.click(screen.getByRole("button", { name: "Lecture" }));
    expect(lecture).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Plein écran" })).toBeTruthy();
  });
});

describe("LecteurVideoKit : sous-titres", () => {
  it("par défaut la langue de l'interface (français), anglais proposé s'il existe", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    const liste = screen.getByLabelText("Sous-titres") as HTMLSelectElement;
    expect(liste.value).toBe("fr");
    expect(Array.from(liste.options).map((o) => o.value)).toEqual(["off", "fr", "en"]);
  });
  it("sous /en sans sous-titres anglais : le français reste proposé par défaut et l'absence est signalée", async () => {
    rendre(<LecteurVideoKit {...props} locale="en" sousTitres={["fr"]} />, "en");
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    expect((screen.getByLabelText("Subtitles") as HTMLSelectElement).value).toBe("fr");
    expect(screen.getByText("English subtitles are not available for this kit.")).toBeTruthy();
  });
  it("sous /en avec sous-titres anglais : l'anglais par défaut", async () => {
    rendre(<LecteurVideoKit {...props} locale="en" />, "en");
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    expect((screen.getByLabelText("Subtitles") as HTMLSelectElement).value).toBe("en");
  });
});

describe("LecteurVideoKit : progression et erreurs", () => {
  it("la position est enregistrée à la pause", async () => {
    const { container } = rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    const el = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(el, "currentTime", { configurable: true, writable: true, value: 77.9 });
    fireEvent.play(el);
    fireEvent.pause(el);
    expect(faux.enregistrerProgression).toHaveBeenCalledWith(PRODUIT, 77);
  });
  it("la position est enregistrée toutes les 15 secondes pendant la lecture, et plus après la pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = rendre(<LecteurVideoKit {...props} />);
    await vi.waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    const el = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(el, "currentTime", { configurable: true, writable: true, value: 40 });
    act(() => {
      fireEvent.play(el);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(faux.enregistrerProgression).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(faux.enregistrerProgression).toHaveBeenCalledTimes(2);
    act(() => {
      fireEvent.pause(el);
    });
    const appels = faux.enregistrerProgression.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(faux.enregistrerProgression).toHaveBeenCalledTimes(appels);
  });
  it("page masquée avant le début de la lecture : la position reprise n'est jamais écrasée par 0", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    expect(faux.enregistrerProgression).not.toHaveBeenCalled();
  });
  it("après une lecture, quitter la page (pagehide) enregistre la position", async () => {
    const { container } = rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    const el = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(el, "currentTime", { configurable: true, writable: true, value: 210 });
    fireEvent.play(el);
    window.dispatchEvent(new Event("pagehide"));
    expect(faux.enregistrerProgression).toHaveBeenCalledWith(PRODUIT, 210);
  });
  it("une vidéo regardée jusqu'au bout repart du début", async () => {
    fetchFaux.mockImplementation(async () => reponse(200, { ...LECTURE, positionSecondes: 598 }));
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    expect(faux.hlsInstances[0].options.startPosition).toBe(-1);
  });
  it("vidéo qui ne charge pas : message d'état et « Réessayer » ; le nouvel essai redemande un jeton et reprend à la dernière position connue", async () => {
    rendre(<LecteurVideoKit {...props} />);
    await waitFor(() => expect(faux.hlsInstances.length).toBe(1));
    act(() => faux.hlsInstances[0].ecouteurs.error?.("error", { fatal: true }));
    expect(await screen.findByText(/La vidéo ne se charge pas/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(faux.hlsInstances.length).toBe(2));
    expect(fetchFaux).toHaveBeenCalledTimes(2);
    expect(faux.hlsInstances[0].destroyed).toBe(true);
    expect(faux.hlsInstances[1].options.startPosition).toBe(130);
  });
  it("échec du serveur : message d'état et « Réessayer »", async () => {
    fetchFaux.mockResolvedValueOnce(reponse(500, { erreur: "echec" }));
    rendre(<LecteurVideoKit {...props} />);
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(faux.hlsInstances.length).toBe(0);
  });
});
