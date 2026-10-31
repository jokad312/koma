// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  publierProduit: vi.fn(),
  depublierProduit: vi.fn(),
  demanderEnvoiVideoKit: vi.fn(),
  verifierVideoKit: vi.fn(),
  annulerEnvoiVideoKit: vi.fn(),
  supprimerVideoKit: vi.fn(),
  retirerExtraitKit: vi.fn(),
  ajouterChapitreKit: vi.fn(),
  modifierChapitreKit: vi.fn(),
  deplacerChapitreKit: vi.fn(),
  supprimerChapitreKit: vi.fn(),
  demanderEnvoiSousTitres: vi.fn(),
  finaliserSousTitres: vi.fn(),
  annulerEnvoiSousTitres: vi.fn(),
  supprimerSousTitres: vi.fn(),
  demarrerEnvoiBunny: vi.fn(),
  demarrerEnvoiTus: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  publierProduit: (...a: unknown[]) => faux.publierProduit(...a),
  depublierProduit: (...a: unknown[]) => faux.depublierProduit(...a),
  demanderEnvoiVideoKit: (...a: unknown[]) => faux.demanderEnvoiVideoKit(...a),
  verifierVideoKit: (...a: unknown[]) => faux.verifierVideoKit(...a),
  annulerEnvoiVideoKit: (...a: unknown[]) => faux.annulerEnvoiVideoKit(...a),
  supprimerVideoKit: (...a: unknown[]) => faux.supprimerVideoKit(...a),
  retirerExtraitKit: (...a: unknown[]) => faux.retirerExtraitKit(...a),
  ajouterChapitreKit: (...a: unknown[]) => faux.ajouterChapitreKit(...a),
  modifierChapitreKit: (...a: unknown[]) => faux.modifierChapitreKit(...a),
  deplacerChapitreKit: (...a: unknown[]) => faux.deplacerChapitreKit(...a),
  supprimerChapitreKit: (...a: unknown[]) => faux.supprimerChapitreKit(...a),
  demanderEnvoiSousTitres: (...a: unknown[]) => faux.demanderEnvoiSousTitres(...a),
  finaliserSousTitres: (...a: unknown[]) => faux.finaliserSousTitres(...a),
  annulerEnvoiSousTitres: (...a: unknown[]) => faux.annulerEnvoiSousTitres(...a),
  supprimerSousTitres: (...a: unknown[]) => faux.supprimerSousTitres(...a),
}));
vi.mock("@/lib/bunny/envoi-tus-navigateur", () => ({ demarrerEnvoiBunny: (...a: unknown[]) => faux.demarrerEnvoiBunny(...a) }));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: (...a: unknown[]) => faux.demarrerEnvoiTus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: faux.refresh }),
  usePathname: () => "/admin/produits",
}));

import { ChapitresKit } from "@/components/admin/ChapitresKit";
import { PublicationProduit } from "@/components/admin/PublicationProduit";
import { SousTitresKit } from "@/components/admin/SousTitresKit";
import { VideoKit } from "@/components/admin/VideoKit";
import type { ChapitreAdmin } from "@/modules/catalogue/types";

const KIT = "00000000-0000-4000-8000-0000000000aa";
const CHAPITRES: ChapitreAdmin[] = [
  { id: "00000000-0000-4000-8000-0000000000c1", titreFr: "Introduction", titreEn: "Intro", debutSecondes: 0, ordre: 1 },
  { id: "00000000-0000-4000-8000-0000000000c2", titreFr: "Coupe", titreEn: "Cutting", debutSecondes: 150, ordre: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
});

describe("PublicationProduit d'un Kit", () => {
  it("refus : la liste traduite des manques du Kit s'affiche", async () => {
    faux.publierProduit.mockResolvedValue({ statut: "erreur", erreur: "publication_incomplete", manques: ["video", "sous_titres_fr", "materiel_en"] });
    rendre(<PublicationProduit produitId={KIT} publie={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Publier" }));
    const alerte = await screen.findByRole("alert");
    expect(within(alerte).getByText("La vidéo complète")).toBeTruthy();
    expect(within(alerte).getByText("Les sous-titres en français")).toBeTruthy();
    expect(within(alerte).getByText("Le matériel nécessaire en anglais")).toBeTruthy();
  });

  it("succès affiché seulement après la réponse réelle", async () => {
    faux.publierProduit.mockResolvedValue({ statut: "succes" });
    rendre(<PublicationProduit produitId={KIT} publie={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByText("Produit publié.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });
});

describe("VideoKit", () => {
  it("type refusé avant l'envoi : aucune autorisation demandée", async () => {
    rendre(<VideoKit produitId={KIT} genre="complete" dureeSecondes={null} extraitPresent={false} bunnyConfigure />);
    const champ = screen.getByLabelText("Fichier vidéo") as HTMLInputElement;
    await userEvent.upload(champ, new File(["x"], "film.avi", { type: "video/x-msvideo" }), { applyAccept: false });
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la vidéo" }));
    expect((await screen.findByRole("alert")).textContent).toContain("MP4, MOV ou WebM");
    expect(faux.demanderEnvoiVideoKit).not.toHaveBeenCalled();
  });

  it("vidéo prête : durée affichée, jamais un identifiant", () => {
    rendre(<VideoKit produitId={KIT} genre="complete" dureeSecondes={754} extraitPresent={false} bunnyConfigure />);
    expect(screen.getByText("Vidéo prête · durée 12:34")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remplacer la vidéo" })).toBeTruthy();
  });

  it("envoi puis encodage : enregistrée seulement quand le serveur répond « prête »", async () => {
    const terminer = Promise.resolve();
    faux.demanderEnvoiVideoKit.mockResolvedValue({
      statut: "succes",
      envoi: { adresse: "https://video.bunnycdn.com/tusupload", signature: "TEST_sig", expiration: 1, videoId: "00000000-0000-4000-8000-0000000000e1", bibliothequeId: "1", titre: `KIT_${KIT}` },
    });
    faux.demarrerEnvoiBunny.mockResolvedValue({ terminer, annuler: vi.fn() });
    faux.verifierVideoKit.mockResolvedValueOnce({ statut: "succes", video: { etat: "en_cours", progression: 40 } });
    rendre(<VideoKit produitId={KIT} genre="complete" dureeSecondes={null} extraitPresent={false} bunnyConfigure />);
    await userEvent.upload(screen.getByLabelText("Fichier vidéo"), new File(["x"], "tuto.mp4", { type: "video/mp4" }));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la vidéo" }));
    expect(await screen.findByText("Encodage en cours chez Bunny : 40 %")).toBeTruthy();
    expect(screen.queryByText("Vidéo prête et enregistrée.")).toBeNull();
    expect(faux.verifierVideoKit).toHaveBeenCalledWith({ produitId: KIT, genre: "complete", videoId: "00000000-0000-4000-8000-0000000000e1" });
  });

  const autorisation = {
    statut: "succes",
    envoi: { adresse: "https://video.bunnycdn.com/tusupload", signature: "TEST_sig", expiration: 1, videoId: "00000000-0000-4000-8000-0000000000e1", bibliothequeId: "1", titre: `KIT_${KIT}` },
  };

  it("MOV au type vide (Windows, Android) : type déduit de l'extension et envoyé", async () => {
    faux.demanderEnvoiVideoKit.mockResolvedValue({ statut: "erreur", erreur: "bunny_indisponible" });
    rendre(<VideoKit produitId={KIT} genre="complete" dureeSecondes={null} extraitPresent={false} bunnyConfigure />);
    await userEvent.upload(screen.getByLabelText("Fichier vidéo"), new File(["x"], "tuto.MOV", { type: "" }), { applyAccept: false });
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la vidéo" }));
    await waitFor(() => expect(faux.demanderEnvoiVideoKit).toHaveBeenCalledWith({ produitId: KIT, genre: "complete", type: "video/quicktime", taille: 1 }));
  });

  it("erreur passagère de vérification : affichée, la vidéo reste suivie ; avertissement en quittant la page", async () => {
    faux.demanderEnvoiVideoKit.mockResolvedValue(autorisation);
    faux.demarrerEnvoiBunny.mockResolvedValue({ terminer: Promise.resolve(), annuler: vi.fn() });
    faux.verifierVideoKit.mockResolvedValueOnce({ statut: "erreur", erreur: "bunny_indisponible" });
    rendre(<VideoKit produitId={KIT} genre="complete" dureeSecondes={null} extraitPresent={false} bunnyConfigure />);
    await userEvent.upload(screen.getByLabelText("Fichier vidéo"), new File(["x"], "tuto.mp4", { type: "video/mp4" }));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la vidéo" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Bunny ne répond pas");
    // Toujours en phase d'encodage : la vidéo n'est ni abandonnée ni effacée.
    expect(screen.getByText("Reste sur cette page jusqu'à la fin de l'encodage : la vidéo n'est enregistrée qu'une fois prête.")).toBeTruthy();
    expect(faux.annulerEnvoiVideoKit).not.toHaveBeenCalled();
    const evenement = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(evenement);
    expect(evenement.defaultPrevented).toBe(true);
  });

  it("au repos, quitter la page n'est pas bloqué", () => {
    rendre(<VideoKit produitId={KIT} genre="complete" dureeSecondes={null} extraitPresent={false} bunnyConfigure />);
    const evenement = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(evenement);
    expect(evenement.defaultPrevented).toBe(false);
  });

  it("extrait sans vidéo complète : aucun envoi proposé", () => {
    rendre(<VideoKit produitId={KIT} genre="extrait" dureeSecondes={null} extraitPresent={false} bunnyConfigure />);
    expect(screen.getByText("Envoie d'abord la vidéo complète : l'extrait s'ajoute ensuite.")).toBeTruthy();
    expect(screen.queryByLabelText("Fichier de l'extrait")).toBeNull();
  });
});

describe("ChapitresKit", () => {
  it("liste dans l'ordre, Monter désactivé sur le premier, Descendre sur le dernier", () => {
    rendre(<ChapitresKit produitId={KIT} chapitres={CHAPITRES} dureeSecondes={600} />);
    const liste = screen.getByRole("list", { name: "Chapitres de la vidéo, dans l'ordre" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Monter le chapitre 1 : Introduction" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Descendre le chapitre 2 : Coupe" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("instant mal formé ou hors durée : erreur sous le champ, rien n'est envoyé", async () => {
    rendre(<ChapitresKit produitId={KIT} chapitres={[]} dureeSecondes={600} />);
    await userEvent.type(screen.getByLabelText("Titre en français"), "Fin");
    await userEvent.type(screen.getByLabelText("Titre en anglais"), "End");
    await userEvent.type(screen.getByLabelText("Instant de début"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter le chapitre" }));
    expect(screen.getByLabelText("Instant de début").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Écris l'instant sous la forme mm:ss ou h:mm:ss, par exemple 2:30.")).toBeTruthy();
    await userEvent.clear(screen.getByLabelText("Instant de début"));
    await userEvent.type(screen.getByLabelText("Instant de début"), "12:00");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter le chapitre" }));
    expect(screen.getByText("Le chapitre doit commencer avant la fin de la vidéo (10:00).")).toBeTruthy();
    expect(faux.ajouterChapitreKit).not.toHaveBeenCalled();
  });

  it("ajout : succès annoncé après la réponse réelle", async () => {
    faux.ajouterChapitreKit.mockResolvedValue({ statut: "succes", id: "TEST_c" });
    rendre(<ChapitresKit produitId={KIT} chapitres={[]} dureeSecondes={600} />);
    await userEvent.type(screen.getByLabelText("Titre en français"), "Fin");
    await userEvent.type(screen.getByLabelText("Titre en anglais"), "End");
    await userEvent.type(screen.getByLabelText("Instant de début"), "9:59");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter le chapitre" }));
    await waitFor(() => expect(screen.getByText("Chapitre ajouté.")).toBeTruthy());
    expect(faux.ajouterChapitreKit).toHaveBeenCalledWith({ produitId: KIT, titreFr: "Fin", titreEn: "End", debut: "9:59" });
  });

  it("sans vidéo : aucun formulaire d'ajout", () => {
    rendre(<ChapitresKit produitId={KIT} chapitres={[]} dureeSecondes={null} />);
    expect(screen.queryByLabelText("Instant de début")).toBeNull();
  });

  it("suppression avec confirmation", async () => {
    faux.supprimerChapitreKit.mockResolvedValue({ statut: "succes" });
    rendre(<ChapitresKit produitId={KIT} chapitres={CHAPITRES} dureeSecondes={600} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer le chapitre 2" }));
    const dialogue = await screen.findByRole("dialog");
    await userEvent.click(within(dialogue).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(faux.supprimerChapitreKit).toHaveBeenCalledWith({ chapitreId: CHAPITRES[1].id }));
  });
});

describe("SousTitresKit", () => {
  it("français obligatoire, anglais facultatif ; un fichier qui n'est pas .vtt est refusé avant l'envoi", async () => {
    rendre(<SousTitresKit produitId={KIT} sousTitres={[{ langue: "fr", tailleOctets: 2048, version: 2 }]} />);
    expect(screen.getByText("Obligatoires pour publier.")).toBeTruthy();
    expect(screen.getByText("Facultatifs.")).toBeTruthy();
    expect(screen.getByText("Version 2 · 2 Ko")).toBeTruthy();
    await userEvent.upload(screen.getByLabelText("Fichier .vtt en anglais"), new File(["x"], "en.srt", { type: "text/plain" }), { applyAccept: false });
    await userEvent.click(screen.getByRole("button", { name: "Envoyer les sous-titres en anglais" }));
    expect((await screen.findByRole("alert")).textContent).toContain("WebVTT");
    expect(faux.demanderEnvoiSousTitres).not.toHaveBeenCalled();
  });
});
