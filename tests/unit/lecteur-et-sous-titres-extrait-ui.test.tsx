// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

// Story 3.3 : lecteur de l'extrait (HLS natif ou hls.js) et section admin des sous-titres de l'extrait. Faux nommés TEST_, aucun réseau.

const faux = vi.hoisted(() => ({
  supporte: true,
  instances: [] as Array<{ config: unknown; source: string | null; media: unknown; demarre: number; detruit: boolean; ecouteurs: Record<string, (e: unknown, d: unknown) => void> }>,
  definirExtraitSansParole: vi.fn(),
  deposerSousTitresExtrait: vi.fn(),
  supprimerSousTitresExtrait: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("hls.js", () => {
  class TEST_Hls {
    static Events = { ERROR: "hlsError" };
    static isSupported = () => faux.supporte;
    etat: (typeof faux.instances)[number];
    constructor(config: unknown) {
      this.etat = { config, source: null, media: null, demarre: 0, detruit: false, ecouteurs: {} };
      faux.instances.push(this.etat);
    }
    on(evenement: string, f: (e: unknown, d: unknown) => void) {
      this.etat.ecouteurs[evenement] = f;
    }
    loadSource(s: string) {
      this.etat.source = s;
    }
    attachMedia(m: unknown) {
      this.etat.media = m;
    }
    startLoad() {
      this.etat.demarre += 1;
    }
    destroy() {
      this.etat.detruit = true;
    }
  }
  return { default: TEST_Hls };
});
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  definirExtraitSansParole: (...a: unknown[]) => faux.definirExtraitSansParole(...a),
  deposerSousTitresExtrait: (...a: unknown[]) => faux.deposerSousTitresExtrait(...a),
  supprimerSousTitresExtrait: (...a: unknown[]) => faux.supprimerSousTitresExtrait(...a),
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: faux.refresh }) }));

import { LecteurExtrait } from "@/components/fiche/LecteurExtrait";
import { SousTitresExtraitKit } from "@/components/admin/SousTitresExtraitKit";

const PLAYLIST = "https://vz-test.b-cdn.net/00000000-0000-4000-8000-0000000000e9/playlist.m3u8";
const pistes = [
  { langue: "fr", src: "https://vz-test.b-cdn.net/x/captions/fr.vtt", libelle: "Français", parDefaut: true },
  { langue: "en", src: "https://vz-test.b-cdn.net/x/captions/en.vtt", libelle: "Anglais", parDefaut: false },
];

let natif = "";
beforeEach(() => {
  faux.supporte = true;
  faux.instances = [];
  natif = "";
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation(() => natif as CanPlayTypeResult);
  for (const f of [faux.definirExtraitSansParole, faux.deposerSousTitresExtrait, faux.supprimerSousTitresExtrait, faux.refresh]) f.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("LecteurExtrait", () => {
  it("contrôles natifs, aucune lecture automatique, affiche, une piste par langue, celle de l'interface par défaut", () => {
    const { container } = rendre(<LecteurExtrait playlist={PLAYLIST} vignette="https://x/t.jpg" titre="TEST_Extrait" pistes={pistes} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.getAttribute("poster")).toBe("https://x/t.jpg");
    const tracks = Array.from(container.querySelectorAll("track"));
    expect(tracks.map((t) => [t.getAttribute("srclang"), t.hasAttribute("default")])).toEqual([
      ["fr", true],
      ["en", false],
    ]);
  });

  it("HLS natif : la playlist est la source de la vidéo, hls.js n'est pas créé", async () => {
    natif = "maybe";
    const { container } = rendre(<LecteurExtrait playlist={PLAYLIST} vignette="https://x/t.jpg" titre="TEST_Extrait" pistes={[]} />);
    await waitFor(() => expect((container.querySelector("video") as HTMLVideoElement).getAttribute("src")).toBe(PLAYLIST));
    expect(faux.instances).toHaveLength(0);
  });

  it("hls.js : rien n'est chargé avant la première lecture (autoStartLoad: false), puis startLoad une seule fois ; détruit au démontage", async () => {
    const { container, unmount } = rendre(<LecteurExtrait playlist={PLAYLIST} vignette="https://x/t.jpg" titre="TEST_Extrait" pistes={[]} />);
    await waitFor(() => expect(faux.instances).toHaveLength(1));
    const hls = faux.instances[0];
    expect(hls.config).toMatchObject({ autoStartLoad: false });
    expect(hls.source).toBe(PLAYLIST);
    expect(hls.demarre).toBe(0);
    const video = container.querySelector("video") as HTMLVideoElement;
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("play"));
    expect(hls.demarre).toBe(1);
    unmount();
    expect(hls.detruit).toBe(true);
  });

  it("erreur fatale de hls.js : message d'erreur ; navigateur sans MSE : message « ne peut pas lire »", async () => {
    rendre(<LecteurExtrait playlist={PLAYLIST} vignette="https://x/t.jpg" titre="TEST_Extrait" pistes={[]} />);
    await waitFor(() => expect(faux.instances).toHaveLength(1));
    faux.instances[0].ecouteurs.hlsError?.(null, { fatal: true });
    expect(await screen.findByText(fr.Kit.extrait.erreur)).toBeTruthy();
  });

  it("navigateur sans HLS ni MSE : état « non pris en charge »", async () => {
    faux.supporte = false;
    rendre(<LecteurExtrait playlist={PLAYLIST} vignette="https://x/t.jpg" titre="TEST_Extrait" pistes={[]} />);
    expect(await screen.findByText(fr.Kit.extrait.nonPrisEnCharge)).toBeTruthy();
    expect(faux.instances).toHaveLength(0);
  });
});

describe("SousTitresExtraitKit", () => {
  const T = fr.Admin.kits.sousTitresExtrait;
  const ID = "00000000-0000-4000-8000-000000000001";

  it("case « Extrait sans parole » : cochée tout de suite, remise à l'état précédent si le serveur refuse", async () => {
    faux.definirExtraitSansParole.mockResolvedValue({ statut: "erreur", erreur: "publication_incomplete" });
    rendre(<SousTitresExtraitKit produitId={ID} sansParole={false} langues={[]} />);
    const caseACocher = screen.getByRole("checkbox", { name: T.sansParole.libelle }) as HTMLInputElement;
    await userEvent.click(caseACocher);
    expect(faux.definirExtraitSansParole).toHaveBeenCalledWith({ produitId: ID, valeur: true });
    await waitFor(() => expect(caseACocher.checked).toBe(false));
    expect(screen.getByText(T.erreurs.publication_incomplete)).toBeTruthy();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("la case suit la valeur reçue quand elle change (après rafraîchissement)", () => {
    const { rerender } = rendre(<SousTitresExtraitKit produitId={ID} sansParole={false} langues={[]} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    rerender(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <SousTitresExtraitKit produitId={ID} sansParole={true} langues={[]} />
      </NextIntlClientProvider>,
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("vérification côté navigateur : aucun fichier, autre extension ou plus de 512 Ko : refusé sans appel au serveur", async () => {
    rendre(<SousTitresExtraitKit produitId={ID} sansParole={false} langues={[]} />);
    const envoyer = screen.getByRole("button", { name: T.envoyer.replace("{langue}", "français") });
    await userEvent.click(envoyer);
    expect(await screen.findByText(T.erreurs.fichier_manquant)).toBeTruthy();
    const champ = screen.getByLabelText(T.fichier.libelle.replace("{langue}", "français")) as HTMLInputElement;
    await userEvent.upload(champ, new File(["x"], "TEST.srt", { type: "text/plain" }), { applyAccept: false });
    await userEvent.click(envoyer);
    expect(await screen.findByText(T.erreurs.format_invalide)).toBeTruthy();
    await userEvent.upload(champ, new File([new Uint8Array(512 * 1024 + 1)], "TEST.vtt", { type: "text/vtt" }), { applyAccept: false });
    await userEvent.click(envoyer);
    expect(await screen.findByText(T.erreurs.fichier_trop_lourd)).toBeTruthy();
    expect(faux.deposerSousTitresExtrait).not.toHaveBeenCalled();
  });

  it("envoi valide : FormData avec produit, langue et fichier ; succès annoncé après la réponse", async () => {
    faux.deposerSousTitresExtrait.mockResolvedValue({ statut: "succes" });
    rendre(<SousTitresExtraitKit produitId={ID} sansParole={false} langues={[]} />);
    const champ = screen.getByLabelText(T.fichier.libelle.replace("{langue}", "anglais")) as HTMLInputElement;
    await userEvent.upload(champ, new File(["WEBVTT"], "TEST.vtt", { type: "text/vtt" }));
    await userEvent.click(screen.getByRole("button", { name: T.envoyer.replace("{langue}", "anglais") }));
    expect(await screen.findByText(T.envoyes)).toBeTruthy();
    const donnees = faux.deposerSousTitresExtrait.mock.calls[0][0] as FormData;
    expect([donnees.get("produitId"), donnees.get("langue"), (donnees.get("fichier") as File).name]).toEqual([ID, "en", "TEST.vtt"]);
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("suppression : boîte de confirmation, Annuler ne supprime rien, Supprimer appelle le serveur", async () => {
    faux.supprimerSousTitresExtrait.mockResolvedValue({ statut: "succes" });
    rendre(<SousTitresExtraitKit produitId={ID} sansParole={false} langues={["fr"]} />);
    const ouvrir = screen.getByRole("button", { name: T.supprimer.replace("{langue}", "français") });
    await userEvent.click(ouvrir);
    let dialogue = await screen.findByRole("dialog");
    await userEvent.click(within(dialogue).getByRole("button", { name: T.suppression.annuler }));
    expect(faux.supprimerSousTitresExtrait).not.toHaveBeenCalled();
    await userEvent.click(ouvrir);
    dialogue = await screen.findByRole("dialog");
    await userEvent.click(within(dialogue).getByRole("button", { name: T.suppression.confirmer }));
    await waitFor(() => expect(faux.supprimerSousTitresExtrait).toHaveBeenCalledWith({ produitId: ID, langue: "fr" }));
    expect(await screen.findByText(T.supprimes)).toBeTruthy();
  });
});
