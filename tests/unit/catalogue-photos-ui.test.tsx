// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  deplacerPhoto: vi.fn(),
  publierProduit: vi.fn(),
  depublierProduit: vi.fn(),
  demanderEnvoiPhoto: vi.fn(),
  finaliserPhoto: vi.fn(),
  annulerEnvoiPhoto: vi.fn(),
  demarrerEnvoiTus: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  deplacerPhoto: (...a: unknown[]) => faux.deplacerPhoto(...a),
  publierProduit: (...a: unknown[]) => faux.publierProduit(...a),
  depublierProduit: (...a: unknown[]) => faux.depublierProduit(...a),
  demanderEnvoiPhoto: (...a: unknown[]) => faux.demanderEnvoiPhoto(...a),
  finaliserPhoto: (...a: unknown[]) => faux.finaliserPhoto(...a),
  annulerEnvoiPhoto: (...a: unknown[]) => faux.annulerEnvoiPhoto(...a),
}));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: (...a: unknown[]) => faux.demarrerEnvoiTus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: faux.refresh }),
  usePathname: () => "/admin/produits",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { EnvoiPhoto } from "@/components/admin/EnvoiPhoto";
import { GaleriePhotos } from "@/components/admin/GaleriePhotos";
import { PublicationProduit } from "@/components/admin/PublicationProduit";
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

describe("GaleriePhotos", () => {
  it("miniatures avec texte alternatif, textes FR et EN, boutons au nom complet", () => {
    rendre(<GaleriePhotos photos={PHOTOS} />);
    expect(screen.getByAltText("TEST_Dos")).toBeTruthy();
    expect(screen.getByText("Texte alternatif en anglais : TEST_Back")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Monter la photo 2 : TEST_Dos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descendre la photo 2 : TEST_Dos" })).toBeTruthy();
    expect(screen.getByText("3 photos sur 10")).toBeTruthy();
  });

  it("en bout de liste : aria-disabled et aucun appel", async () => {
    const user = userEvent.setup();
    rendre(<GaleriePhotos photos={PHOTOS} />);
    const monterPremiere = screen.getByRole("button", { name: "Monter la photo 1 : TEST_Face" });
    const descendreDerniere = screen.getByRole("button", { name: "Descendre la photo 3 : TEST_Profil" });
    expect(monterPremiere.getAttribute("aria-disabled")).toBe("true");
    expect(descendreDerniere.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Monter la photo 2 : TEST_Dos" }).getAttribute("aria-disabled")).toBeNull();
    await user.click(monterPremiere);
    await user.click(descendreDerniere);
    expect(faux.deplacerPhoto).not.toHaveBeenCalled();
  });

  it("monter : le résultat n'est annoncé qu'après la réponse réelle, puis la liste est relue", async () => {
    let finir: (v: unknown) => void = () => {};
    faux.deplacerPhoto.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup();
    rendre(<GaleriePhotos photos={PHOTOS} />);
    await user.click(screen.getByRole("button", { name: "Monter la photo 2 : TEST_Dos" }));
    expect(faux.deplacerPhoto).toHaveBeenCalledWith({ photoId: "TEST_ph2", sens: "haut" });
    expect(screen.queryByText(/Photo déplacée/)).toBeNull();
    await act(async () => finir({ statut: "succes" }));
    expect((await screen.findByRole("status", { name: "" })).textContent).toContain("Photo déplacée : elle est maintenant en position 1.");
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("clavier : Entrée sur Descendre déplace la photo", async () => {
    faux.deplacerPhoto.mockResolvedValueOnce({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<GaleriePhotos photos={PHOTOS} />);
    screen.getByRole("button", { name: "Descendre la photo 1 : TEST_Face" }).focus();
    await user.keyboard("{Enter}");
    expect(faux.deplacerPhoto).toHaveBeenCalledWith({ photoId: "TEST_ph1", sens: "bas" });
  });

  it("échec : message d'erreur, aucune annonce de succès", async () => {
    faux.deplacerPhoto.mockResolvedValueOnce({ statut: "erreur", erreur: "generique" });
    const user = userEvent.setup();
    rendre(<GaleriePhotos photos={PHOTOS} />);
    await user.click(screen.getByRole("button", { name: "Monter la photo 2 : TEST_Dos" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/Photo déplacée/)).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("aucune photo : message", () => {
    rendre(<GaleriePhotos photos={[]} />);
    expect(screen.getByText(/Aucune photo pour le moment/)).toBeTruthy();
  });
});

describe("PublicationProduit", () => {
  it("brouillon : pastille Brouillon et bouton Publier", () => {
    rendre(<PublicationProduit produitId={PRODUIT} publie={false} />);
    expect(screen.getByText("Brouillon")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publier" })).toBeTruthy();
  });

  it("publié : pastille Publié et bouton Dépublier", () => {
    rendre(<PublicationProduit produitId={PRODUIT} publie />);
    expect(screen.getByText("Publié")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dépublier" })).toBeTruthy();
  });

  it("refus : la liste des manques s'affiche en alerte, aucun succès", async () => {
    faux.publierProduit.mockResolvedValueOnce({ statut: "erreur", erreur: "publication_incomplete", manques: ["prix", "photo"] });
    const user = userEvent.setup();
    rendre(<PublicationProduit produitId={PRODUIT} publie={false} />);
    await user.click(screen.getByRole("button", { name: "Publier" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Le prix");
    expect(alerte.textContent).toContain("Au moins une photo");
    expect(screen.queryByText("Produit publié.")).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("succès : annoncé seulement après la réponse réelle, puis relecture", async () => {
    let finir: (v: unknown) => void = () => {};
    faux.publierProduit.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup();
    rendre(<PublicationProduit produitId={PRODUIT} publie={false} />);
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(screen.queryByText("Produit publié.")).toBeNull();
    await act(async () => finir({ statut: "succes" }));
    expect(await screen.findByText("Produit publié.")).toBeTruthy();
    expect(faux.publierProduit).toHaveBeenCalledWith({ id: PRODUIT });
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("dépublier : appelle l'action de dépublication", async () => {
    faux.depublierProduit.mockResolvedValueOnce({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<PublicationProduit produitId={PRODUIT} publie />);
    await user.click(screen.getByRole("button", { name: "Dépublier" }));
    expect(await screen.findByText(/Produit dépublié/)).toBeTruthy();
    expect(faux.publierProduit).not.toHaveBeenCalled();
  });

  it("exception réseau : erreur générique, jamais un succès", async () => {
    faux.publierProduit.mockRejectedValueOnce(new Error("TEST_reseau"));
    const user = userEvent.setup();
    rendre(<PublicationProduit produitId={PRODUIT} publie={false} />);
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Produit publié.")).toBeNull();
  });
});

describe("EnvoiPhoto", () => {
  const choisir = async (user: ReturnType<typeof userEvent.setup>, fichier: File) => user.upload(screen.getByLabelText("Fichier de la photo"), fichier);
  const remplirAlt = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("Texte alternatif en français"), "Face");
    await user.type(screen.getByLabelText("Texte alternatif en anglais"), "Front");
  };
  const envoyer = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Ajouter la photo" }));

  it("GIF et PDF : refusés avant tout envoi, avec le rappel des formats et de la limite", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    for (const [nom, type] of [["a.gif", "image/gif"], ["a.pdf", "application/pdf"]]) {
      await choisir(user, new File(["x"], nom, { type }));
      await envoyer(user);
      expect((await screen.findByText(/Formats acceptés : JPEG, PNG ou WebP, 15 Mo au plus/)).textContent).toContain("Formats acceptés");
      expect(screen.getByLabelText("Fichier de la photo").getAttribute("aria-describedby")).toContain("erreur");
    }
    expect(faux.demanderEnvoiPhoto).not.toHaveBeenCalled();
  });

  it("plus de 15 Mo : refusée avant tout envoi", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    const lourd = new File(["x"], "gros.jpg", { type: "image/jpeg" });
    Object.defineProperty(lourd, "size", { value: 15 * 1024 * 1024 + 1 });
    await choisir(user, lourd);
    await envoyer(user);
    expect(await screen.findByText(/trop lourde/)).toBeTruthy();
    expect(faux.demanderEnvoiPhoto).not.toHaveBeenCalled();
  });

  it("texte alternatif manquant : erreur sous le champ relié par aria-describedby", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await choisir(user, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await user.type(screen.getByLabelText("Texte alternatif en anglais"), "Front");
    await envoyer(user);
    const champ = screen.getByLabelText("Texte alternatif en français");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(champ.getAttribute("aria-describedby")!.split(" ").pop()!)!.textContent).toContain("texte alternatif");
    expect(faux.demanderEnvoiPhoto).not.toHaveBeenCalled();
  });

  it("envoi réussi : autorisation, TUS, finalisation, succès annoncé après la réponse réelle", async () => {
    faux.demanderEnvoiPhoto.mockResolvedValueOnce({ statut: "succes", objet: `${PRODUIT}/u.jpg`, jeton: "TEST_jeton" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async (p: { onProgression: (a: number, b: number) => void }) => {
      p.onProgression(50, 100);
      return { terminer: Promise.resolve(), annuler: vi.fn() };
    });
    let finir: (v: unknown) => void = () => {};
    faux.finaliserPhoto.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    await choisir(user, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await envoyer(user);
    expect(faux.demanderEnvoiPhoto).toHaveBeenCalledWith({ produitId: PRODUIT, type: "image/jpeg", taille: 1, altFr: "Face", altEn: "Front" });
    expect(await screen.findByText("Traitement de la photo…")).toBeTruthy();
    expect(screen.queryByText("Photo ajoutée.")).toBeNull();
    await act(async () => finir({ statut: "succes", id: "TEST_photo" }));
    expect(await screen.findByText("Photo ajoutée.")).toBeTruthy();
    expect(faux.finaliserPhoto).toHaveBeenCalledWith({ produitId: PRODUIT, objet: `${PRODUIT}/u.jpg`, altFr: "Face", altEn: "Front" });
    expect(faux.refresh).toHaveBeenCalled();
    expect((screen.getByLabelText("Texte alternatif en français") as HTMLInputElement).value).toBe("");
  });

  it("progression annoncée en texte avec sa valeur, « Annuler l'envoi » arrête et efface", async () => {
    faux.demanderEnvoiPhoto.mockResolvedValueOnce({ statut: "succes", objet: `${PRODUIT}/u.jpg`, jeton: "TEST_jeton" });
    const annuler = vi.fn();
    let echouer: (e: unknown) => void = () => {};
    faux.demarrerEnvoiTus.mockImplementationOnce(async (p: { onProgression: (a: number, b: number) => void }) => {
      p.onProgression(30, 100);
      return { terminer: new Promise((_ok, ko) => (echouer = ko)), annuler: async () => { annuler(); echouer(new Error("TEST_abandon")); } };
    });
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    await choisir(user, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await envoyer(user);
    expect((await screen.findAllByText("Envoi en cours : 30 %")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Annuler l'envoi" }));
    expect(annuler).toHaveBeenCalled();
    expect(faux.annulerEnvoiPhoto).toHaveBeenCalledWith({ produitId: PRODUIT, objet: `${PRODUIT}/u.jpg` });
    await waitFor(() => expect(screen.getByText("Envoi annulé.")).toBeTruthy());
    expect(faux.finaliserPhoto).not.toHaveBeenCalled();
    expect(screen.queryByText("Photo ajoutée.")).toBeNull();
  });

  it("annulation cliquée pendant l'autorisation : aucun envoi, l'objet signé est effacé", async () => {
    let autoriser: (v: unknown) => void = () => {};
    faux.demanderEnvoiPhoto.mockReturnValueOnce(new Promise((r) => (autoriser = r)));
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    await choisir(user, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await envoyer(user);
    await user.click(await screen.findByRole("button", { name: "Annuler l'envoi" }));
    await act(async () => autoriser({ statut: "succes", objet: `${PRODUIT}/u.jpg`, jeton: "TEST_jeton" }));
    await waitFor(() => expect(faux.annulerEnvoiPhoto).toHaveBeenCalledWith({ produitId: PRODUIT, objet: `${PRODUIT}/u.jpg` }));
    expect(faux.demarrerEnvoiTus).not.toHaveBeenCalled();
    expect(faux.finaliserPhoto).not.toHaveBeenCalled();
  });

  it("envoi abandonné après les reprises : message d'échec, jamais de finalisation", async () => {
    faux.demanderEnvoiPhoto.mockResolvedValueOnce({ statut: "succes", objet: `${PRODUIT}/u.jpg`, jeton: "TEST_jeton" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async () => ({ terminer: Promise.reject(new Error("TEST_reseau")), annuler: vi.fn() }));
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    await choisir(user, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await envoyer(user);
    expect(await screen.findByText(/L'envoi a échoué/)).toBeTruthy();
    expect(faux.finaliserPhoto).not.toHaveBeenCalled();
  });

  it("refus du serveur à l'autorisation (11e photo) : message, aucun envoi", async () => {
    faux.demanderEnvoiPhoto.mockResolvedValueOnce({ statut: "erreur", erreur: "photos_limite" });
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiPhoto produitId={PRODUIT} />);
    await remplirAlt(user);
    await choisir(user, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await envoyer(user);
    expect(await screen.findByText(/déjà 10 photos/)).toBeTruthy();
    expect(faux.demarrerEnvoiTus).not.toHaveBeenCalled();
  });
});
