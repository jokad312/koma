// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerKit: vi.fn(),
  enregistrerProduit: vi.fn(),
  demanderEnvoiFichierKit: vi.fn(),
  finaliserFichierKit: vi.fn(),
  annulerEnvoiFichierKit: vi.fn(),
  supprimerFichierKit: vi.fn(),
  demarrerEnvoiTus: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  enregistrerKit: (...a: unknown[]) => faux.enregistrerKit(...a),
  enregistrerProduit: (...a: unknown[]) => faux.enregistrerProduit(...a),
  demanderEnvoiFichierKit: (...a: unknown[]) => faux.demanderEnvoiFichierKit(...a),
  finaliserFichierKit: (...a: unknown[]) => faux.finaliserFichierKit(...a),
  annulerEnvoiFichierKit: (...a: unknown[]) => faux.annulerEnvoiFichierKit(...a),
  supprimerFichierKit: (...a: unknown[]) => faux.supprimerFichierKit(...a),
}));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: (...a: unknown[]) => faux.demarrerEnvoiTus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push, refresh: faux.refresh }),
  usePathname: () => "/admin/produits",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return {
    getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages, namespace: namespace as never }),
    getLocale: async () => "fr",
  };
});

import { EnvoiFichierKit } from "@/components/admin/EnvoiFichierKit";
import { FichiersKit } from "@/components/admin/FichiersKit";
import { FormulaireKit } from "@/components/admin/FormulaireKit";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { ListeProduits } from "@/components/admin/ListeProduits";
import type { FichierKitAdmin, ProduitAdmin, ProduitLiable } from "@/modules/catalogue/types";

const KIT = "00000000-0000-4000-8000-0000000000aa";
const UNIVERS = [{ id: "TEST_univers-1", nomFr: "Univers de test A", nomEn: "Test universe A" }];
const LIABLES: ProduitLiable[] = [
  { id: "TEST_cosplay-1", titreFr: "TEST_Cosplay un", famille: "cosplay" },
  { id: "TEST_accessoire-1", titreFr: "TEST_Accessoire un", famille: "accessoire" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
});

const kitExistant: ProduitAdmin = {
  id: KIT,
  famille: "kit",
  slug: "test-kit",
  titreFr: "TEST_Kit",
  titreEn: "TEST_Kit en",
  descriptionFr: "TEST_desc",
  descriptionEn: null,
  universId: "TEST_univers-1",
  prixCents: 0,
  delaiFabricationJours: null,
  publieLe: null,
  variantes: [],
  photos: [],
  materielFr: "TEST_mousse",
  materielEn: null,
  niveau: "intermediaire",
  produitLieId: "TEST_cosplay-1",
  fichiers: [],
};

describe("ListeProduits", () => {
  it("la famille « Kit » s'affiche dans la liste", async () => {
    rendre(await ListeProduits({ produits: [{ id: "TEST_k", famille: "kit", titreFr: "TEST_Kit", slug: "test-kit", prixCents: 0, publieLe: null }] }));
    expect(screen.getAllByText("Kit").length).toBeGreaterThan(0);
  });
});

describe("FormulaireProduit : famille Kit", () => {
  it("la famille propose cosplay, accessoire et kit ; avec kit, tailles, délai et stock disparaissent", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireProduit univers={UNIVERS} liables={LIABLES} />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["cosplay", "accessoire", "kit"]);
    await user.click(screen.getByRole("radio", { name: /^Cosplay/ }));
    expect(screen.getByLabelText("Délai de fabrication du produit (jours)")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /^Kit/ }));
    expect(screen.queryByLabelText("Délai de fabrication du produit (jours)")).toBeNull();
    expect(screen.queryByText("Tailles et stock")).toBeNull();
    expect(screen.queryByLabelText("Stock")).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByLabelText("Matériel nécessaire en français")).toBeTruthy();
    expect(screen.getByLabelText("Matériel nécessaire en anglais")).toBeTruthy();
    expect(faux.enregistrerKit).not.toHaveBeenCalled();
    expect(faux.enregistrerProduit).not.toHaveBeenCalled();
  });

  it("un produit physique existant n'a plus de choix de famille", () => {
    const cosplay = { ...kitExistant, famille: "cosplay" as const, niveau: null, produitLieId: null };
    rendre(<FormulaireProduit univers={UNIVERS} produit={cosplay} />);
    expect(screen.queryByRole("radio", { name: /Cosplay/ })).toBeNull();
    expect(screen.getByText("Cosplay (costume complet)")).toBeTruthy();
    expect(screen.getByText("La famille d'un produit existant ne peut plus changer.")).toBeTruthy();
  });
});

describe("FormulaireKit", () => {
  const remplirMinimum = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("Titre en français"), "Kit de test");
  };

  it("champs : titre, description, matériel FR et EN, univers, prix, niveau en cases natives, lien", () => {
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    for (const libelle of ["Titre en français", "Titre en anglais", "Description en français", "Description en anglais", "Matériel nécessaire en français", "Matériel nécessaire en anglais", "Univers", "Prix en dollars US (USD)", "Cosplay ou accessoire lié"]) {
      expect(screen.getByLabelText(libelle)).toBeTruthy();
    }
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["debutant", "intermediaire", "avance"]);
    expect(screen.getByText("Débutant")).toBeTruthy();
    expect(screen.getByText("Intermédiaire")).toBeTruthy();
    expect(screen.getByText("Avancé")).toBeTruthy();
    // Aucune famille à choisir pour un Kit existant ou déjà choisi.
    expect(screen.queryByLabelText("Délai de fabrication du produit (jours)")).toBeNull();
  });

  it("le prix 0 est expliqué : « 0 USD est réservé au Kit gratuit »", () => {
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    expect(screen.getByText(/0 USD est réservé au Kit gratuit/)).toBeTruthy();
    expect(screen.getByLabelText("Prix en dollars US (USD)").getAttribute("aria-describedby")).toContain("aide");
  });

  it("le lien propose seulement les cosplays et accessoires fournis, avec leur famille", () => {
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    const select = screen.getByLabelText("Cosplay ou accessoire lié");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Aucun lien", "TEST_Cosplay un (Cosplay)", "TEST_Accessoire un (Accessoire)"]);
  });

  it("création : tout est envoyé en texte, prix 0 compris, puis redirection vers la fiche d'édition", async () => {
    faux.enregistrerKit.mockResolvedValueOnce({ statut: "succes", id: KIT, cree: true });
    const user = userEvent.setup();
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    await remplirMinimum(user);
    await user.type(screen.getByLabelText("Matériel nécessaire en français"), "Mousse EVA");
    await user.type(screen.getByLabelText("Prix en dollars US (USD)"), "0");
    await user.click(screen.getByRole("radio", { name: "Avancé" }));
    await user.selectOptions(screen.getByLabelText("Cosplay ou accessoire lié"), "TEST_cosplay-1");
    await user.selectOptions(screen.getByLabelText("Univers"), "TEST_univers-1");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerKit).toHaveBeenCalledWith({
      id: "",
      slug: "kit-de-test",
      titreFr: "Kit de test",
      titreEn: "",
      descriptionFr: "",
      descriptionEn: "",
      materielFr: "Mousse EVA",
      materielEn: "",
      universId: "TEST_univers-1",
      prix: "0",
      niveau: "avance",
      produitLieId: "TEST_cosplay-1",
    });
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith(`/admin/produits/${KIT}?cree=1`));
    expect(screen.queryByText("Kit enregistré.")).toBeNull();
  });

  it("le succès n'est annoncé qu'après la réponse réelle ; modification : l'identifiant est transmis", async () => {
    let finir: (v: unknown) => void = () => {};
    faux.enregistrerKit.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup();
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} produit={kitExistant} />);
    expect((screen.getByLabelText("Prix en dollars US (USD)") as HTMLInputElement).value).toBe("0");
    expect((screen.getByRole("radio", { name: "Intermédiaire" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Cosplay ou accessoire lié") as HTMLSelectElement).value).toBe("TEST_cosplay-1");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.enregistrerKit.mock.calls[0][0]).toMatchObject({ id: KIT, prix: "0", niveau: "intermediaire", produitLieId: "TEST_cosplay-1", materielFr: "TEST_mousse" });
    expect(screen.queryByText("Kit enregistré.")).toBeNull();
    await act(async () => finir({ statut: "succes", id: KIT, cree: false }));
    expect(await screen.findByText("Kit enregistré.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("un Kit existant montre sa famille sans permettre de la changer", () => {
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} produit={kitExistant} />);
    expect(screen.getByText("Kit (patrons, fichiers et tutoriel)")).toBeTruthy();
    expect(screen.getByText("La famille d'un produit existant ne peut plus changer.")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Cosplay/ })).toBeNull();
  });

  it("erreurs liées aux champs (aria-describedby), saisie conservée, aucun faux succès", async () => {
    faux.enregistrerKit.mockResolvedValueOnce({ statut: "erreur", erreur: "kit_lie_invalide", champ: "kit_lie" });
    const user = userEvent.setup();
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    await remplirMinimum(user);
    await user.selectOptions(screen.getByLabelText("Cosplay ou accessoire lié"), "TEST_cosplay-1");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Il y a des erreurs à corriger");
    const lie = screen.getByLabelText("Cosplay ou accessoire lié");
    expect(lie.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(lie.getAttribute("aria-describedby")!.split(" ").pop()!)!.textContent).toContain("a déjà un Kit");
    expect((screen.getByLabelText("Titre en français") as HTMLInputElement).value).toBe("Kit de test");
    expect((lie as HTMLSelectElement).value).toBe("TEST_cosplay-1");
    expect(screen.queryByText("Kit enregistré.")).toBeNull();
  });

  it("prix refusé par le serveur : message de prix, 0 USD rappelé", async () => {
    faux.enregistrerKit.mockResolvedValueOnce({ statut: "erreur", erreur: "prix_invalide", champ: "prix" });
    const user = userEvent.setup();
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    await remplirMinimum(user);
    await user.type(screen.getByLabelText("Prix en dollars US (USD)"), "-1");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    const champ = screen.getByLabelText("Prix en dollars US (USD)");
    await waitFor(() => expect(champ.getAttribute("aria-invalid")).toBe("true"));
    expect(document.getElementById(champ.getAttribute("aria-describedby")!.split(" ").pop()!)!.textContent).toContain("0 USD est réservé au Kit gratuit");
  });

  it("adresse déjà prise : adresse libre proposée, bouton pour l'utiliser", async () => {
    faux.enregistrerKit.mockResolvedValueOnce({ statut: "erreur", erreur: "slug_pris", champ: "slug", slugPropose: "kit-de-test-2" });
    const user = userEvent.setup();
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    await remplirMinimum(user);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await user.click(await screen.findByRole("button", { name: "Utiliser kit-de-test-2" }));
    expect((screen.getByLabelText("Adresse du Kit") as HTMLInputElement).value).toBe("kit-de-test-2");
  });

  it("réseau coupé : message générique, saisie conservée", async () => {
    faux.enregistrerKit.mockRejectedValueOnce(new Error("TEST_reseau"));
    const user = userEvent.setup();
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />);
    await remplirMinimum(user);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/n'a pas pu être enregistré/)).toBeTruthy();
    expect((screen.getByLabelText("Titre en français") as HTMLInputElement).value).toBe("Kit de test");
    expect(screen.queryByText("Kit enregistré.")).toBeNull();
  });

  it("anglais : niveaux Beginner, Intermediate, Advanced", () => {
    rendre(<FormulaireKit univers={UNIVERS} liables={LIABLES} />, "en");
    expect(screen.getByText("Beginner")).toBeTruthy();
    expect(screen.getByText("Intermediate")).toBeTruthy();
    expect(screen.getByText("Advanced")).toBeTruthy();
    expect(screen.getByText(/0 USD is reserved for the free Kit/)).toBeTruthy();
  });
});

const FICHIERS: FichierKitAdmin[] = [
  { id: "TEST_f1", nomFr: "TEST_Patron", nomEn: "TEST_Pattern", format: "pdf_a4", tailleOctets: 3_000_000, ordre: 1, version: 2 },
  { id: "TEST_f2", nomFr: "TEST_Motif", nomEn: "TEST_Motif en", format: "svg", tailleOctets: 2048, ordre: 2, version: 1 },
];

describe("FichiersKit", () => {
  it("formats acceptés et taille maximale affichés ; état vide", () => {
    rendre(<FichiersKit produitId={KIT} fichiers={[]} />);
    expect(screen.getByText(/PDF \(A4 ou US Letter\), SVG, STL et transcription texte \(\.txt\)\. 50 Mo au plus par fichier, 1 Mo pour une transcription/)).toBeTruthy();
    expect(screen.getByText("Aucun fichier pour le moment.")).toBeTruthy();
  });

  it("liste : nom, format, taille lisible, version", () => {
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />);
    const liste = screen.getByRole("list", { name: "Fichiers du Kit, dans l'ordre d'ajout" });
    const lignes = within(liste).getAllByRole("listitem");
    expect(lignes).toHaveLength(2);
    expect(lignes[0].textContent).toContain("TEST_Patron");
    expect(lignes[0].textContent).toContain("PDF A4 · 2,9 Mo · version 2");
    expect(lignes[1].textContent).toContain("SVG · 2 Ko · version 1");
    expect(screen.getByText("2 fichiers")).toBeTruthy();
  });

  it("Remplacer ouvre le panneau de ce fichier, au format imposé", async () => {
    const user = userEvent.setup();
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />);
    const bouton = screen.getByRole("button", { name: "Remplacer TEST_Patron" });
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    await user.click(bouton);
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("heading", { name: "Remplacer le fichier TEST_Patron" })).toBeTruthy();
    expect(screen.getByLabelText("Nouveau fichier").getAttribute("accept")).toBe(".pdf");
    expect(screen.getByText(/Même format que le fichier actuel \(PDF A4\)/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("heading", { name: "Remplacer le fichier TEST_Patron" })).toBeNull();
  });

  it("Supprimer demande confirmation ; annuler n'appelle rien", async () => {
    const user = userEvent.setup();
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />);
    await user.click(screen.getByRole("button", { name: "Supprimer TEST_Patron" }));
    const dialogue = await screen.findByRole("dialog");
    expect(within(dialogue).getByRole("heading", { name: "Supprimer le fichier TEST_Patron ?" })).toBeTruthy();
    expect(within(dialogue).getByText(/Cette action ne peut pas être annulée/)).toBeTruthy();
    await user.click(within(dialogue).getByRole("button", { name: "Annuler" }));
    expect(faux.supprimerFichierKit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("suppression confirmée : annoncée seulement après la réponse réelle, puis la liste est relue", async () => {
    let finir: (v: unknown) => void = () => {};
    faux.supprimerFichierKit.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup();
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />);
    await user.click(screen.getByRole("button", { name: "Supprimer TEST_Motif" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    expect(faux.supprimerFichierKit).toHaveBeenCalledWith({ fichierId: "TEST_f2" });
    expect(screen.queryByText("Fichier supprimé.")).toBeNull();
    await act(async () => finir({ statut: "succes" }));
    expect(await screen.findByText("Fichier supprimé.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("suppression refusée : erreur affichée, aucun succès", async () => {
    faux.supprimerFichierKit.mockResolvedValueOnce({ statut: "erreur", erreur: "fichier_introuvable" });
    const user = userEvent.setup();
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />);
    await user.click(screen.getByRole("button", { name: "Supprimer TEST_Motif" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Ce fichier n'existe plus. Recharge la page.")).toBeTruthy();
    expect(screen.queryByText("Fichier supprimé.")).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("noms dans la langue de la page", () => {
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />, "en");
    expect(screen.getByRole("button", { name: "Replace TEST_Pattern" })).toBeTruthy();
    expect(screen.getByText(/PDF A4 · 2\.9 MB · version 2/)).toBeTruthy();
  });

  it("boutons de 44 px au moins (min-h-touch)", () => {
    rendre(<FichiersKit produitId={KIT} fichiers={FICHIERS} />);
    expect(screen.getByRole("button", { name: "Remplacer TEST_Patron" }).className).toContain("min-h-touch");
    expect(screen.getByRole("button", { name: "Supprimer TEST_Patron" }).className).toContain("min-h-touch");
  });
});

describe("EnvoiFichierKit", () => {
  const choisir = (user: ReturnType<typeof userEvent.setup>, fichier: File, libelle = "Fichier à envoyer") => user.upload(screen.getByLabelText(libelle), fichier);
  const ajouter = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Ajouter le fichier" }));
  const pdf = (nom = "patron.pdf") => new File(["%PDF-1.7"], nom, { type: "application/pdf" });

  it(".exe et .zip : refusés avant tout envoi, avec le rappel des formats", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    for (const nom of ["setup.exe", "archive.zip"]) {
      await choisir(user, new File(["x"], nom));
      await ajouter(user);
      expect((await screen.findByText(/Formats acceptés : PDF \(A4 ou US Letter\), SVG, STL ou transcription texte/)).textContent).toContain("contenu qui correspond");
      expect(screen.getByLabelText("Fichier à envoyer").getAttribute("aria-describedby")).toContain("erreur");
    }
    expect(faux.demanderEnvoiFichierKit).not.toHaveBeenCalled();
  });

  it("51 Mo : refusé avant tout envoi, limite rappelée ; transcription au-delà de 1 Mo aussi", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    const lourd = new File(["x"], "gros.stl");
    Object.defineProperty(lourd, "size", { value: 51 * 1024 * 1024 });
    await choisir(user, lourd);
    await ajouter(user);
    expect((await screen.findByText(/trop lourd : 50 Mo au plus, 1 Mo pour une transcription/)).textContent).toBeTruthy();
    const texte = new File(["x"], "notes.txt");
    Object.defineProperty(texte, "size", { value: 1024 * 1024 + 1 });
    await choisir(user, texte);
    await ajouter(user);
    await waitFor(() => expect(screen.getByLabelText("Fichier à envoyer").getAttribute("aria-invalid")).toBe("true"));
    expect(faux.demanderEnvoiFichierKit).not.toHaveBeenCalled();
  });

  it("aucun fichier choisi : erreur sous le champ", async () => {
    const user = userEvent.setup();
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await ajouter(user);
    expect(await screen.findByText("Choisis un fichier à envoyer.")).toBeTruthy();
    expect(faux.demanderEnvoiFichierKit).not.toHaveBeenCalled();
  });

  it("les noms sont proposés d'après le fichier ; un nom vide est refusé sous son champ", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf("Patron casque.pdf"));
    expect((screen.getByLabelText("Nom en français") as HTMLInputElement).value).toBe("Patron casque");
    expect((screen.getByLabelText("Nom en anglais") as HTMLInputElement).value).toBe("Patron casque");
    await user.clear(screen.getByLabelText("Nom en anglais"));
    await ajouter(user);
    const champ = screen.getByLabelText("Nom en français");
    expect(champ.getAttribute("aria-invalid")).toBeNull();
    const en = screen.getByLabelText("Nom en anglais");
    expect(en.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(en.getAttribute("aria-describedby")!.split(" ").pop()!)!.textContent).toContain("1 à 120 caractères");
    expect(faux.demanderEnvoiFichierKit).not.toHaveBeenCalled();
  });

  it("un PDF propose A4 ou US Letter ; les autres formats sont détectés", async () => {
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    expect(screen.getByRole("radio", { name: "PDF A4" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "PDF US Letter" })).toBeTruthy();
    await choisir(user, new File(["solid x"], "piece.stl"));
    expect(screen.queryByRole("radio", { name: "PDF A4" })).toBeNull();
    expect(screen.getByText("Format : STL")).toBeTruthy();
  });

  it("envoi réussi : autorisation, TUS vers kits-private, finalisation, succès annoncé après la réponse réelle", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async (p: { onProgression: (a: number, b: number) => void }) => {
      p.onProgression(50, 100);
      return { terminer: Promise.resolve(), annuler: vi.fn() };
    });
    let finir: (v: unknown) => void = () => {};
    faux.finaliserFichierKit.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup({ applyAccept: false });
    const succes = vi.fn();
    rendre(<EnvoiFichierKit produitId={KIT} onSucces={succes} />);
    await choisir(user, pdf());
    await user.click(screen.getByRole("radio", { name: "PDF US Letter" }));
    await user.clear(screen.getByLabelText("Nom en français"));
    await user.type(screen.getByLabelText("Nom en français"), "Patron");
    await user.clear(screen.getByLabelText("Nom en anglais"));
    await user.type(screen.getByLabelText("Nom en anglais"), "Pattern");
    await ajouter(user);
    expect(faux.demanderEnvoiFichierKit).toHaveBeenCalledWith({ produitId: KIT, nomFichier: "patron.pdf", format: "pdf_letter", taille: 8, fichierId: undefined });
    expect(await screen.findByText("Vérification du fichier…")).toBeTruthy();
    expect(faux.demarrerEnvoiTus.mock.calls[0][0]).toMatchObject({ bucket: "kits-private", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    expect(screen.queryByText("Fichier ajouté.")).toBeNull();
    expect(succes).not.toHaveBeenCalled();
    await act(async () => finir({ statut: "succes", id: "TEST_f" }));
    expect(await screen.findByText("Fichier ajouté.")).toBeTruthy();
    expect(faux.finaliserFichierKit).toHaveBeenCalledWith({ produitId: KIT, objet: `${KIT}/u.pdf`, format: "pdf_letter", taille: 8, nomFr: "Patron", nomEn: "Pattern", fichierId: undefined });
    expect(faux.refresh).toHaveBeenCalled();
    expect(succes).toHaveBeenCalledWith("Fichier ajouté.");
    expect((screen.getByLabelText("Nom en français") as HTMLInputElement).value).toBe("");
  });

  it("progression annoncée en texte avec sa valeur ; « Annuler l'envoi » arrête et efface", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    const annuler = vi.fn();
    let echouer: (e: unknown) => void = () => {};
    faux.demarrerEnvoiTus.mockImplementationOnce(async (p: { onProgression: (a: number, b: number) => void }) => {
      p.onProgression(30, 100);
      return {
        terminer: new Promise((_ok, ko) => (echouer = ko)),
        annuler: async () => {
          annuler();
          echouer(new Error("TEST_abandon"));
        },
      };
    });
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    expect((await screen.findAllByText("Envoi en cours : 30 %")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Annuler l'envoi" }));
    expect(annuler).toHaveBeenCalled();
    expect(faux.annulerEnvoiFichierKit).toHaveBeenCalledWith({ produitId: KIT, objet: `${KIT}/u.pdf` });
    await waitFor(() => expect(screen.getByText("Envoi annulé.")).toBeTruthy());
    expect(faux.finaliserFichierKit).not.toHaveBeenCalled();
    expect(screen.queryByText("Fichier ajouté.")).toBeNull();
  });

  it("« Annuler l'envoi » est désactivé dès que l'envoi est terminé (vérification côté serveur) et ne fait plus rien", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    const annuler = vi.fn();
    faux.demarrerEnvoiTus.mockImplementationOnce(async () => ({ terminer: Promise.resolve(), annuler }));
    let finir: (v: unknown) => void = () => {};
    faux.finaliserFichierKit.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    expect(await screen.findByText("Vérification du fichier…")).toBeTruthy();
    const bouton = screen.getByRole("button", { name: "Annuler l'envoi" });
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    await user.click(bouton);
    expect(annuler).not.toHaveBeenCalled();
    expect(faux.annulerEnvoiFichierKit).not.toHaveBeenCalled();
    await act(async () => finir({ statut: "succes", id: "TEST_f" }));
    expect(await screen.findByText("Fichier ajouté.")).toBeTruthy();
  });

  it("annulation cliquée pendant l'autorisation : aucun envoi, l'objet signé est effacé", async () => {
    let autoriser: (v: unknown) => void = () => {};
    faux.demanderEnvoiFichierKit.mockReturnValueOnce(new Promise((r) => (autoriser = r)));
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    await user.click(await screen.findByRole("button", { name: "Annuler l'envoi" }));
    await act(async () => autoriser({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" }));
    await waitFor(() => expect(faux.annulerEnvoiFichierKit).toHaveBeenCalledWith({ produitId: KIT, objet: `${KIT}/u.pdf` }));
    expect(faux.demarrerEnvoiTus).not.toHaveBeenCalled();
    expect(faux.finaliserFichierKit).not.toHaveBeenCalled();
  });

  it("reprise après coupure : message en texte", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async (p: { onReprise: () => void }) => {
      p.onReprise();
      return { terminer: new Promise(() => {}), annuler: vi.fn() };
    });
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    expect(await screen.findByText("Connexion perdue : l'envoi reprendra tout seul.")).toBeTruthy();
  });

  it("envoi abandonné après les reprises : message d'échec, jamais de finalisation", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async () => ({ terminer: Promise.reject(new Error("TEST_reseau")), annuler: vi.fn() }));
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    expect(await screen.findByText(/L'envoi a échoué/)).toBeTruthy();
    expect(faux.finaliserFichierKit).not.toHaveBeenCalled();
  });

  it("contenu refusé à la finalisation : message sous le champ du fichier, aucun succès", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async () => ({ terminer: Promise.resolve(), annuler: vi.fn() }));
    faux.finaliserFichierKit.mockResolvedValueOnce({ statut: "erreur", erreur: "format_invalide" });
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    await waitFor(() => expect(screen.getByLabelText("Fichier à envoyer").getAttribute("aria-invalid")).toBe("true"));
    expect(screen.queryByText("Fichier ajouté.")).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("refus du serveur à l'autorisation : message, aucun envoi", async () => {
    faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "erreur", erreur: "non_autorise" });
    const user = userEvent.setup({ applyAccept: false });
    rendre(<EnvoiFichierKit produitId={KIT} />);
    await choisir(user, pdf());
    await ajouter(user);
    expect(await screen.findByText(/Tu n'as plus le droit de modifier les produits/)).toBeTruthy();
    expect(faux.demarrerEnvoiTus).not.toHaveBeenCalled();
  });

  describe("remplacement", () => {
    const fichier = FICHIERS[0];

    it("pas de nom à saisir ; le fichier du même format part avec l'identifiant du fichier remplacé", async () => {
      faux.demanderEnvoiFichierKit.mockResolvedValueOnce({ statut: "succes", objet: `${KIT}/u.pdf`, jeton: "TEST_jeton", contentType: "application/pdf" });
      faux.demarrerEnvoiTus.mockImplementationOnce(async () => ({ terminer: Promise.resolve(), annuler: vi.fn() }));
      faux.finaliserFichierKit.mockResolvedValueOnce({ statut: "succes", id: "TEST_f1" });
      const user = userEvent.setup({ applyAccept: false });
      const succes = vi.fn();
      rendre(<EnvoiFichierKit produitId={KIT} fichier={fichier} onSucces={succes} />);
      expect(screen.queryByLabelText("Nom en français")).toBeNull();
      await choisir(user, pdf("v2.pdf"), "Nouveau fichier");
      expect(screen.queryByRole("radio", { name: "PDF US Letter" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Remplacer le fichier" }));
      expect(faux.demanderEnvoiFichierKit).toHaveBeenCalledWith({ produitId: KIT, nomFichier: "v2.pdf", format: "pdf_a4", taille: 8, fichierId: "TEST_f1" });
      await waitFor(() => expect(succes).toHaveBeenCalledWith("Fichier remplacé."));
      expect(faux.finaliserFichierKit).toHaveBeenCalledWith({ produitId: KIT, objet: `${KIT}/u.pdf`, format: "pdf_a4", taille: 8, nomFr: "", nomEn: "", fichierId: "TEST_f1" });
      expect(faux.refresh).toHaveBeenCalled();
    });

    it("un autre format que celui du fichier est refusé avant tout envoi", async () => {
      const user = userEvent.setup({ applyAccept: false });
      rendre(<EnvoiFichierKit produitId={KIT} fichier={fichier} />);
      await choisir(user, new File(["<svg/>"], "motif.svg"), "Nouveau fichier");
      await user.click(screen.getByRole("button", { name: "Remplacer le fichier" }));
      expect(await screen.findByText(/Ce fichier n'est pas accepté/)).toBeTruthy();
      expect(faux.demanderEnvoiFichierKit).not.toHaveBeenCalled();
    });
  });
});
