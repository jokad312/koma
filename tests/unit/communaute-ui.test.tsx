// @vitest-environment jsdom
// Story 8.1 : formulaire « Envoyer une photo » : accord obligatoire et décoché, contrôles avant envoi, succès seulement après le serveur.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ demander: vi.fn(), finaliser: vi.fn(), annuler: vi.fn(), refresh: vi.fn(), tus: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/communaute/actions", () => ({
  demanderEnvoiPhotoAction: (...a: unknown[]) => faux.demander(...a),
  finaliserPhotoAction: (...a: unknown[]) => faux.finaliser(...a),
  annulerEnvoiPhotoAction: (...a: unknown[]) => faux.annuler(...a),
  retirerPhotoAction: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: faux.refresh }) }));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: (...a: unknown[]) => faux.tus(...a) }));
vi.mock("@/lib/env", () => ({ lireEnvPublique: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://TEST.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "TEST_cle" }) }));

import { EnvoiPhotoClient } from "@/components/compte/EnvoiPhotoClient";

const C = fr.Communaute;
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "TEST.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
  faux.demander.mockResolvedValue({ ok: true, objet: "envois-photos/00000000-0000-4000-8000-0000000000f1.00000000-0000-4000-8000-000000000001.jpg", jeton: "TEST_jeton" });
  faux.tus.mockResolvedValue({ terminer: Promise.resolve(), annuler: vi.fn() });
  faux.finaliser.mockResolvedValue({ ok: true, id: "TEST_id" });
});

describe("EnvoiPhotoClient", () => {
  it("l'accord de publication est le texte fourni, décoché par défaut ; sans lui, rien n'est envoyé", async () => {
    rendre(<EnvoiPhotoClient />);
    const accord = screen.getByRole("checkbox", { name: C.accord }) as HTMLInputElement;
    expect(accord.checked).toBe(false);
    await userEvent.upload(screen.getByLabelText(C.fichier.libelle), photo());
    await userEvent.click(screen.getByRole("button", { name: C.envoyer }));
    expect(await screen.findByText(C.erreurs.accord_manquant)).toBeTruthy();
    expect(accord.getAttribute("aria-invalid")).toBe("true");
    expect(faux.demander).not.toHaveBeenCalled();
  });

  it("format refusé avant tout envoi, message qui rappelle formats et limite", async () => {
    rendre(<EnvoiPhotoClient />);
    await userEvent.upload(screen.getByLabelText(C.fichier.libelle), new File(["x"], "TEST.heic", { type: "image/heic" }), { applyAccept: false });
    await userEvent.click(screen.getByRole("checkbox", { name: C.accord }));
    await userEvent.click(screen.getByRole("button", { name: C.envoyer }));
    expect(await screen.findByText(C.erreurs.format_invalide)).toBeTruthy();
    expect(faux.demander).not.toHaveBeenCalled();
  });

  it("choix d'affichage et accord envoyés au serveur ; le succès vient de sa réponse", async () => {
    rendre(<EnvoiPhotoClient />);
    await userEvent.upload(screen.getByLabelText(C.fichier.libelle), photo());
    await userEvent.click(screen.getByRole("checkbox", { name: C.affichage.afficherNom }));
    await userEvent.type(screen.getByLabelText(C.affichage.nom), "TEST_Pseudo");
    await userEvent.click(screen.getByRole("checkbox", { name: C.accord }));
    await userEvent.click(screen.getByRole("button", { name: C.envoyer }));
    await waitFor(() =>
      expect(faux.finaliser).toHaveBeenCalledWith({
        objet: "envois-photos/00000000-0000-4000-8000-0000000000f1.00000000-0000-4000-8000-000000000001.jpg",
        accord: true,
        afficherNom: true,
        nom: "TEST_Pseudo",
        afficherVille: false,
        ville: "",
      }),
    );
    expect(await screen.findByText(C.succes)).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("refus du serveur (Compte mineur) : le message le dit, jamais un faux succès", async () => {
    faux.finaliser.mockResolvedValue({ ok: false, erreur: "mineur" });
    rendre(<EnvoiPhotoClient />);
    await userEvent.upload(screen.getByLabelText(C.fichier.libelle), photo());
    await userEvent.click(screen.getByRole("checkbox", { name: C.accord }));
    await userEvent.click(screen.getByRole("button", { name: C.envoyer }));
    expect(await screen.findByText(C.erreurs.mineur)).toBeTruthy();
    expect(screen.queryByText(C.succes)).toBeNull();
  });

  it("« Annuler l'envoi » pendant l'envoi : TUS arrêté, objet effacé, jamais finalisé", async () => {
    const annulerTus = vi.fn(async () => undefined);
    let echouer: (e: unknown) => void = () => undefined;
    faux.tus.mockResolvedValue({ terminer: new Promise<void>((_r, rej) => (echouer = rej)), annuler: annulerTus });
    rendre(<EnvoiPhotoClient />);
    await userEvent.upload(screen.getByLabelText(C.fichier.libelle), photo());
    await userEvent.click(screen.getByRole("checkbox", { name: C.accord }));
    await userEvent.click(screen.getByRole("button", { name: C.envoyer }));
    const annuler = await screen.findByRole("button", { name: C.annuler });
    await userEvent.click(annuler);
    echouer(new Error("annule"));
    await waitFor(() => expect(annulerTus).toHaveBeenCalled());
    expect(faux.annuler).toHaveBeenCalledWith({ objet: "envois-photos/00000000-0000-4000-8000-0000000000f1.00000000-0000-4000-8000-000000000001.jpg" });
    expect(await screen.findByText(C.annule)).toBeTruthy();
    expect(faux.finaliser).not.toHaveBeenCalled();
  });

  it("refus « affichage » du serveur : message visible même sans champ pseudo", async () => {
    faux.finaliser.mockResolvedValue({ ok: false, erreur: "affichage_invalide" });
    rendre(<EnvoiPhotoClient />);
    await userEvent.upload(screen.getByLabelText(C.fichier.libelle), photo());
    await userEvent.click(screen.getByRole("checkbox", { name: C.accord }));
    await userEvent.click(screen.getByRole("button", { name: C.envoyer }));
    expect(await screen.findByText(C.erreurs.affichage_invalide)).toBeTruthy();
  });

  it("textes FR et EN en parité ; l'accord est le texte de Jonathan dans les deux langues", () => {
    const cles = (o: unknown, p = ""): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "object" && v !== null ? cles(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(cles(en.Communaute).sort()).toEqual(cles(fr.Communaute).sort());
    expect(fr.Communaute.accord.startsWith("J'autorise la publication de cette photo")).toBe(true);
    expect(en.Communaute.accord.startsWith("I allow this photo to be published")).toBe(true);
  });
});
