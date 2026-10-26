// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import "./aides-dom";

const faux = vi.hoisted(() => ({
  deplacerPhoto: vi.fn(),
  supprimerPhoto: vi.fn(),
  modifierAltPhoto: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  deplacerPhoto: (...a: unknown[]) => faux.deplacerPhoto(...a),
  supprimerPhoto: (...a: unknown[]) => faux.supprimerPhoto(...a),
  modifierAltPhoto: (...a: unknown[]) => faux.modifierAltPhoto(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: faux.refresh }),
  usePathname: () => "/admin/produits",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { GaleriePhotos } from "@/components/admin/GaleriePhotos";
import type { PhotoAdmin } from "@/modules/catalogue/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000bb";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
});

const PHOTOS: PhotoAdmin[] = [
  { id: "TEST_ph1", fichier: `${PRODUIT}/a.jpg`, altFr: "TEST_Face", altEn: "TEST_Front", position: 1 },
  { id: "TEST_ph2", fichier: `${PRODUIT}/b.jpg`, altFr: "TEST_Dos", altEn: "TEST_Back", position: 2 },
  { id: "TEST_ph3", fichier: `${PRODUIT}/c.jpg`, altFr: "TEST_Profil", altEn: "TEST_Side", position: 3 },
];

const avecMessages = (ui: ReactElement) => (
  <NextIntlClientProvider locale="fr" messages={fr}>
    {ui}
  </NextIntlClientProvider>
);

describe("suppression d'une photo", () => {
  it("un bouton « Supprimer la photo N » par photo, de 44 px au moins", () => {
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    for (const n of [1, 2, 3]) {
      const bouton = screen.getByRole("button", { name: `Supprimer la photo ${n}` });
      expect(bouton.className).toContain("min-h-touch");
    }
  });

  it("ouvre la confirmation ; Annuler ferme sans rien supprimer", async () => {
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 2" }));
    const dialogue = screen.getByRole("dialog", { name: "Supprimer la photo 2 ?" });
    expect(within(dialogue).getByRole("button", { name: "Supprimer" })).toBeTruthy();
    await user.click(within(dialogue).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.supprimerPhoto).not.toHaveBeenCalled();
  });

  it("pendant la suppression, Annuler est désactivé", async () => {
    faux.supprimerPhoto.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 1" }));
    const dialogue = screen.getByRole("dialog");
    await user.click(within(dialogue).getByRole("button", { name: "Supprimer" }));
    expect((within(dialogue).getByRole("button", { name: "Annuler" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Échap ferme la confirmation sans rien supprimer", async () => {
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 1" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.supprimerPhoto).not.toHaveBeenCalled();
  });

  it("confirmer : annonce seulement après la réponse réelle, liste relue, focus sur la photo voisine", async () => {
    let finir: (v: unknown) => void = () => {};
    faux.supprimerPhoto.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup();
    const { rerender } = render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 2" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    expect(faux.supprimerPhoto).toHaveBeenCalledWith({ photoId: "TEST_ph2" });
    expect(screen.queryByText("Photo 2 supprimée.")).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
    await act(async () => finir({ statut: "succes" }));
    expect((await screen.findByText("Photo 2 supprimée.")).closest("[role=status]")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // La liste relue arrive : le focus va à la photo qui a pris la place de la supprimée.
    rerender(avecMessages(<GaleriePhotos photos={[PHOTOS[0], { ...PHOTOS[2], position: 2 }]} />));
    expect(document.activeElement?.textContent).toBe("Photo 2");
  });

  it("dernière photo supprimée d'un brouillon : le focus va au message « aucune photo »", async () => {
    faux.supprimerPhoto.mockResolvedValueOnce({ statut: "succes" });
    const user = userEvent.setup();
    const { rerender } = render(avecMessages(<GaleriePhotos photos={[PHOTOS[0]]} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 1" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    await screen.findByText("Photo 1 supprimée.");
    rerender(avecMessages(<GaleriePhotos photos={[]} />));
    expect(document.activeElement?.textContent).toMatch(/Aucune photo pour le moment/);
  });

  it("dernière photo d'un produit publié refusée : message clair, aucune annonce de succès, pas de relecture", async () => {
    faux.supprimerPhoto.mockResolvedValueOnce({ statut: "erreur", erreur: "derniere_photo_publiee" });
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={[PHOTOS[0]]} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 1" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("dépublie d'abord le produit");
    expect(screen.queryByText(/supprimée\./)).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("échec générique ou exception : message d'erreur, jamais un succès", async () => {
    faux.supprimerPhoto.mockRejectedValueOnce(new Error("TEST_panne"));
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    await user.click(screen.getByRole("button", { name: "Supprimer la photo 3" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    expect((await screen.findByRole("alert")).textContent).toContain("La photo n'a pas pu être enregistrée");
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("les boutons Monter / Descendre restent corrects après suppression", async () => {
    const { rerender } = render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    rerender(avecMessages(<GaleriePhotos photos={[PHOTOS[0], { ...PHOTOS[2], position: 2 }]} />));
    expect(screen.getByRole("button", { name: "Monter la photo 1 : TEST_Face" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Descendre la photo 2 : TEST_Profil" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Descendre la photo 1 : TEST_Face" }).getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByRole("button", { name: /photo 3/ })).toBeNull();
  });
});

describe("texte alternatif modifiable", () => {
  const formulaire = (n: number) => screen.getByRole("form", { name: `Modifier le texte alternatif de la photo ${n}` });

  it("un formulaire par photo, champs FR et EN préremplis avec libellés visibles", () => {
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    const f = within(formulaire(2));
    expect((f.getByLabelText("Texte alternatif en français") as HTMLInputElement).value).toBe("TEST_Dos");
    expect((f.getByLabelText("Texte alternatif en anglais") as HTMLInputElement).value).toBe("TEST_Back");
  });

  it("enregistre ; la confirmation n'apparaît qu'après la réponse réelle, puis la liste est relue", async () => {
    let finir: (v: unknown) => void = () => {};
    faux.modifierAltPhoto.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    const f = within(formulaire(2));
    const champ = f.getByLabelText("Texte alternatif en français");
    await user.clear(champ);
    await user.type(champ, "Dos corrigé");
    await user.click(f.getByRole("button", { name: "Enregistrer le texte alternatif" }));
    expect(faux.modifierAltPhoto).toHaveBeenCalledWith({ photoId: "TEST_ph2", altFr: "Dos corrigé", altEn: "TEST_Back" });
    expect(screen.queryByText("Texte alternatif de la photo 2 enregistré.")).toBeNull();
    await act(async () => finir({ statut: "succes" }));
    const statut = await screen.findByText("Texte alternatif de la photo 2 enregistré.");
    expect(statut.closest("[role=status]")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("champ vidé : erreur sous le champ reliée par aria-describedby, aucun appel", async () => {
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    const f = within(formulaire(1));
    const champ = f.getByLabelText("Texte alternatif en français");
    await user.clear(champ);
    await user.click(f.getByRole("button", { name: "Enregistrer le texte alternatif" }));
    expect(faux.modifierAltPhoto).not.toHaveBeenCalled();
    const message = f.getByText("Écris le texte alternatif, de 1 à 200 caractères.");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toContain(message.id);
  });

  it("anglais vidé : l'erreur est sous le champ anglais", async () => {
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    const f = within(formulaire(1));
    const champ = f.getByLabelText("Texte alternatif en anglais");
    await user.clear(champ);
    await user.click(f.getByRole("button", { name: "Enregistrer le texte alternatif" }));
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(f.getByLabelText("Texte alternatif en français").getAttribute("aria-invalid")).toBeNull();
  });

  it("échec du serveur : message d'erreur, saisie conservée, aucune confirmation", async () => {
    faux.modifierAltPhoto.mockResolvedValueOnce({ statut: "erreur", erreur: "generique" });
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    const f = within(formulaire(3));
    const champ = f.getByLabelText("Texte alternatif en français") as HTMLInputElement;
    await user.clear(champ);
    await user.type(champ, "Saisie à garder");
    await user.click(f.getByRole("button", { name: "Enregistrer le texte alternatif" }));
    expect(await f.findByRole("alert")).toBeTruthy();
    expect(champ.value).toBe("Saisie à garder");
    expect(screen.queryByText(/enregistré\./)).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("refus alt_invalide du serveur : message sous les deux champs, pas d'office sous le français", async () => {
    faux.modifierAltPhoto.mockResolvedValueOnce({ statut: "erreur", erreur: "alt_invalide" });
    const user = userEvent.setup();
    render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    const f = within(formulaire(1));
    await user.click(f.getByRole("button", { name: "Enregistrer le texte alternatif" }));
    expect(f.getByLabelText("Texte alternatif en français").getAttribute("aria-invalid")).toBe("true");
    expect(f.getByLabelText("Texte alternatif en anglais").getAttribute("aria-invalid")).toBe("true");
  });

  it("se resynchronise sur les valeurs relues après rafraîchissement", () => {
    const { rerender } = render(avecMessages(<GaleriePhotos photos={PHOTOS} />));
    rerender(avecMessages(<GaleriePhotos photos={[{ ...PHOTOS[0], altFr: "TEST_Relu" }, PHOTOS[1], PHOTOS[2]]} />));
    expect((within(formulaire(1)).getByLabelText("Texte alternatif en français") as HTMLInputElement).value).toBe("TEST_Relu");
  });
});
