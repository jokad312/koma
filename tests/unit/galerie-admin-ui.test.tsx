// @vitest-environment jsdom
// Story 8.2 : file « Galerie » de l'admin : décisions annoncées seulement après la réponse du serveur ; textes FR/EN en parité.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ valider: vi.fn(), refuser: vi.fn(), retirer: vi.fn(), refresh: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/communaute/admin-actions", () => ({
  validerPhotoAction: (...a: unknown[]) => faux.valider(...a),
  refuserPhotoAction: (...a: unknown[]) => faux.refuser(...a),
  retirerPhotoAdminAction: (...a: unknown[]) => faux.retirer(...a),
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: faux.refresh }) }));

import { FilePhotos } from "@/components/admin/FilePhotos";
import type { PhotoAdmin } from "@/modules/communaute/admin-types";

const G = fr.Admin.galerie;
const photo = (s: Partial<PhotoAdmin> = {}): PhotoAdmin => ({
  id: "00000000-0000-4000-8000-0000000000aa",
  statut: "en_attente",
  source: "compte",
  nomAffiche: "TEST_Pseudo",
  ville: null,
  retraitDemande: false,
  creeLe: "2026-11-09T10:00:00Z",
  accordWhatsappLe: null,
  capture: false,
  realisation: null,
  apercu: "https://TEST.invalid/a",
  ...s,
});

beforeEach(() => vi.clearAllMocks());

describe("FilePhotos", () => {
  it("photo à valider : texte alternatif, choix d'affichage ; « Valider » annonce le succès après la réponse et relit la liste", async () => {
    let terminer: (v: { ok: true }) => void = () => undefined;
    faux.valider.mockReturnValue(new Promise((r) => (terminer = r)));
    rendre(<FilePhotos photos={[photo()]} />);
    expect(screen.getByRole("img").getAttribute("alt")).toContain("2026");
    expect(screen.getByText(G.pseudo.replace("{nom}", "TEST_Pseudo"))).toBeTruthy();
    // Sans texte alternatif : rien n'est envoyé, le champ est signalé et reçoit le focus.
    await userEvent.click(screen.getByRole("button", { name: /Valider et publier la photo/ }));
    expect(faux.valider).not.toHaveBeenCalled();
    const champFr = screen.getByLabelText(G.altSaisie.fr.libelle);
    expect(champFr.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(champFr);
    await userEvent.type(champFr, "TEST_Cosplay fr");
    await userEvent.type(screen.getByLabelText(G.altSaisie.en.libelle), "TEST_Cosplay en");
    await userEvent.click(screen.getByRole("button", { name: /Valider et publier la photo/ }));
    expect(faux.valider).toHaveBeenCalledWith({ id: "00000000-0000-4000-8000-0000000000aa", altFr: "TEST_Cosplay fr", altEn: "TEST_Cosplay en" });
    expect(screen.queryByText(G.succes.valider)).toBeNull();
    terminer({ ok: true });
    expect(await screen.findByText(G.succes.valider)).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("alt anglais vide : rien n'est envoyé, le champ anglais est signalé et reçoit le focus ; refus du serveur : champ français signalé", async () => {
    faux.valider.mockResolvedValue({ ok: false, erreur: "alt_invalide" });
    rendre(<FilePhotos photos={[photo()]} />);
    await userEvent.type(screen.getByLabelText(G.altSaisie.fr.libelle), "TEST_fr");
    await userEvent.click(screen.getByRole("button", { name: /Valider et publier la photo/ }));
    expect(faux.valider).not.toHaveBeenCalled();
    const champEn = screen.getByLabelText(G.altSaisie.en.libelle);
    expect(champEn.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(champEn);
    await userEvent.type(champEn, "TEST_en");
    await userEvent.click(screen.getByRole("button", { name: /Valider et publier la photo/ }));
    const champFr = screen.getByLabelText(G.altSaisie.fr.libelle);
    await waitFor(() => expect(champFr.getAttribute("aria-invalid")).toBe("true"));
    expect(document.activeElement).toBe(champFr);
    expect((champFr as HTMLInputElement).value).toBe("TEST_fr");
    expect(screen.queryByText(G.succes.valider)).toBeNull();
  });

  it("refus du serveur : la raison est affichée, jamais un faux succès", async () => {
    faux.valider.mockResolvedValue({ ok: false, erreur: "mineur" });
    rendre(<FilePhotos photos={[photo()]} />);
    await userEvent.type(screen.getByLabelText(G.altSaisie.fr.libelle), "TEST_fr");
    await userEvent.type(screen.getByLabelText(G.altSaisie.en.libelle), "TEST_en");
    await userEvent.click(screen.getByRole("button", { name: /Valider et publier la photo/ }));
    expect(await screen.findByText(G.erreurs.mineur)).toBeTruthy();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("photo publiée avec retrait demandé : signalée, seul « Retirer du mur » est proposé", async () => {
    faux.retirer.mockResolvedValue({ ok: true });
    rendre(<FilePhotos photos={[photo({ statut: "publiee", retraitDemande: true, source: "whatsapp", accordWhatsappLe: "2026-11-08", capture: true })]} />);
    expect(screen.getByText(G.retraitDemande)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Valider/ })).toBeNull();
    expect(screen.getByRole("heading", { name: G.retraits.titre.replace("{nombre}", "1") })).toBeTruthy();
    // Irréversible : une confirmation est demandée avant tout appel au serveur.
    await userEvent.click(screen.getByRole("button", { name: /Retirer du mur la photo/ }));
    expect(faux.retirer).not.toHaveBeenCalled();
    expect(screen.getByText(G.confirmation.retirer)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: G.confirmation.oui.retirer }));
    await waitFor(() => expect(screen.getByText(G.succes.retirer)).toBeTruthy());
    expect(faux.retirer).toHaveBeenCalledTimes(1);
  });

  it("« Refuser » puis « Annuler » : rien n'est envoyé", async () => {
    rendre(<FilePhotos photos={[photo()]} />);
    await userEvent.click(screen.getByRole("button", { name: /Refuser la photo/ }));
    await userEvent.click(screen.getByRole("button", { name: G.confirmation.non }));
    expect(faux.refuser).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Refuser la photo/ })).toBeTruthy();
  });

  it("story 8.4 : une Réalisation est listée à part, avec son Kit déclaré et sa preuve d'achat", () => {
    rendre(<FilePhotos photos={[photo({ realisation: { kitFr: "TEST_Kit", kitEn: null, commande: "KS-2026-000042", payeLe: "2026-11-05T10:00:00Z", rang: null } })]} />);
    expect(screen.getByRole("heading", { name: G.realisations.titre.replace("{nombre}", "1") })).toBeTruthy();
    expect(screen.getByRole("heading", { name: G.aValider.titre.replace("{nombre}", "0") })).toBeTruthy();
    expect(screen.getByText(G.realisation.kit.replace("{kit}", "TEST_Kit"))).toBeTruthy();
    expect(screen.getByText(/KS-2026-000042/)).toBeTruthy();
  });

  it("textes FR et EN en parité", () => {
    const cles = (o: unknown, p = ""): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "object" && v !== null ? cles(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(cles(en.Admin.galerie).sort()).toEqual(cles(fr.Admin.galerie).sort());
    expect(cles(en.Admin.taches.photos).sort()).toEqual(cles(fr.Admin.taches.photos).sort());
  });
});
