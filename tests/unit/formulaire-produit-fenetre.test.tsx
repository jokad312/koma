// @vitest-environment jsdom
// Story 9.16 f : nouveau et modifier produit dessinés en fenêtre (maquette D1 à D15). Données de test nommées TEST_.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerProduit: vi.fn(),
  enregistrerKit: vi.fn(),
  demanderEnvoiPhoto: vi.fn(),
  finaliserPhoto: vi.fn(),
  annulerEnvoiPhoto: vi.fn(),
  demarrerEnvoiTus: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/catalogue/actions", () => ({
  creerUnivers: vi.fn(),
  enregistrerProduit: (...a: unknown[]) => faux.enregistrerProduit(...a),
  enregistrerKit: (...a: unknown[]) => faux.enregistrerKit(...a),
  publierProduit: vi.fn(),
  depublierProduit: vi.fn(),
  restaurerProduit: vi.fn(),
  archiverProduit: vi.fn(),
  demanderEnvoiPhoto: (...a: unknown[]) => faux.demanderEnvoiPhoto(...a),
  finaliserPhoto: (...a: unknown[]) => faux.finaliserPhoto(...a),
  annulerEnvoiPhoto: (...a: unknown[]) => faux.annulerEnvoiPhoto(...a),
  demanderEnvoiFichierKit: vi.fn(),
  finaliserFichierKit: vi.fn(),
  annulerEnvoiFichierKit: vi.fn(),
}));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: (...a: unknown[]) => faux.demarrerEnvoiTus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push, refresh: faux.refresh }),
  usePathname: () => "/admin/produits/nouveau",
  Link: ({ href, children, ...reste }: { href: string; children: ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { FormulaireKit } from "@/components/admin/FormulaireKit";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { PublicationProduit } from "@/components/admin/PublicationProduit";
import { ZonesEnTete, type ProduitEnTete } from "@/components/admin/ZonesEnTete";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import type { ProduitAdmin } from "@/modules/catalogue/types";

const UNIVERS = [{ id: "TEST_univers-1", nomFr: "TEST_Naruto", nomEn: "TEST_Naruto" }];
const ID = "formulaire-produit";

const KIT: ProduitAdmin = {
  id: "00000000-0000-4000-8000-0000000000c1",
  famille: "kit",
  slug: "test-kit",
  titreFr: "TEST_Kit",
  titreEn: null,
  descriptionFr: null,
  descriptionEn: null,
  universId: null,
  prixCents: null,
  delaiFabricationJours: null,
  publieLe: null,
  variantes: [],
  photos: [],
  materielFr: null,
  materielEn: null,
  niveau: null,
  produitLieId: null,
  fichiers: [
    { id: "TEST_f1", nomFr: "TEST_Patron", nomEn: "TEST_Pattern", format: "pdf_a4", tailleOctets: 1000, ordre: 1, version: 1 },
    { id: "TEST_f2", nomFr: "TEST_Patron 2", nomEn: "TEST_Pattern 2", format: "pdf_a4", tailleOctets: 1000, ordre: 2, version: 1 },
    { id: "TEST_f3", nomFr: "TEST_Gabarit", nomEn: "TEST_Template", format: "svg", tailleOctets: 1000, ordre: 3, version: 1 },
  ],
  video: { dureeSecondes: 60, extrait: false, extraitSansParole: false, extraitSousTitres: [] },
  chapitres: [],
  sousTitres: [],
};

function dansFenetre(contenu: ReactNode, locale: "fr" | "en" = "fr") {
  return rendre(
    <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits" idFormulaire={ID}>
      {contenu}
    </FenetreFormulaire>,
    locale,
  );
}

const PHOTO = { id: "TEST_ph1", fichier: `${KIT.id}/a.jpg`, altFr: "TEST_Face", altEn: "TEST_Front", position: 1 };
const enTete = (partiel: Partial<ProduitEnTete> = {}): ProduitEnTete => ({ id: KIT.id, titre: "TEST_Kit", publie: false, archive: false, photo: null, ...partiel });
const enregistrerEnTete = () => screen.getAllByRole("button", { name: "Enregistrer" })[0];

// Vrai si a précède b dans le document.
const avant = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
  vi.clearAllMocks();
  faux.enregistrerProduit.mockReset();
  faux.enregistrerKit.mockReset();
  faux.enregistrerProduit.mockResolvedValue({ statut: "succes", id: "TEST_id", cree: false });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
});

describe("FenetreFormulaire : fond plein écran (9.16 f)", () => {
  it("fond fixe sur tout l'écran, flouté ; la fenêtre défile à l'intérieur ; le cadre admin recouvert devient inerte puis est rendu", () => {
    const { unmount } = rendre(
      <div data-coque-admin="">
        <nav aria-label="TEST_menu">
          <button type="button">TEST_menu</button>
        </nav>
        <div>
          <header>TEST_barre</header>
          <div id="contenu-admin">
            <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits" idFormulaire={ID}>
              <p>TEST_contenu</p>
            </FenetreFormulaire>
          </div>
        </div>
      </div>,
    );
    const fond = document.querySelector("[data-fond-fenetre]") as HTMLElement;
    const racine = document.querySelector("[data-fenetre-formulaire]") as HTMLElement;
    expect(racine.className).toContain("fixed");
    expect(racine.className).toContain("inset-0");
    expect(fond.className).toContain("backdrop-blur-sm");
    expect(fond.className).toContain("bg-scrim");
    expect((document.querySelector("[data-defilement-fenetre]") as HTMLElement).className).toContain("overflow-y-auto");
    expect(document.querySelector("nav")?.hasAttribute("inert")).toBe(true);
    expect(document.querySelector("header")?.hasAttribute("inert")).toBe(true);
    expect(racine.closest("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("FormulaireProduit dans la fenêtre (9.16 f)", () => {
  it("ordre de la maquette : nom, description, prix, univers, image, statut, puis la famille et les autres champs ; champs sombres, étiquettes en majuscules", () => {
    dansFenetre(<FormulaireProduit univers={UNIVERS} idFormulaire={ID} />);
    const titre = screen.getByLabelText("Titre en français");
    const description = screen.getByLabelText("Description en français");
    const prix = screen.getByLabelText("Prix en dollars US (USD)");
    const univers = screen.getByRole("combobox", { name: "Univers" });
    const image = screen.getByRole("heading", { level: 2, name: "Image" });
    const statut = screen.getByRole("heading", { level: 2, name: "Statut" });
    const famille = screen.getByRole("group", { name: "Famille" });
    const adresse = screen.getByLabelText("Adresse du produit");
    for (const [a, b] of [
      [titre, description],
      [description, prix],
      [prix, univers],
      [univers, image],
      [image, statut],
      [statut, famille],
      [famille, adresse],
    ] as const) {
      expect(avant(a, b)).toBe(true);
    }
    expect(titre.className).toContain("bg-admin-champ");
    expect(screen.getByText("Titre en français").className).toContain("uppercase");
    // « Enregistrer » de l'en-tête soumet le formulaire principal, qui porte les premiers champs.
    expect(screen.getAllByRole("button", { name: "Enregistrer" })[0].getAttribute("form")).toBe(ID);
    expect(titre.closest("form")?.id).toBe(ID);
    // Création : photos et statut disponibles après le premier enregistrement, et le texte le dit.
    expect(screen.getByText(/Les photos .* s'ajoutent après le premier enregistrement/)).toBeTruthy();
    expect(screen.getByText(/Le statut se change après le premier enregistrement/)).toBeTruthy();
    // Pas de type de fichier hors Kit.
    expect(screen.queryByText("Type de fichier")).toBeNull();
  });

  it("Vêtement : tailles XS à XXL, couleurs, et stock par taille et couleur", async () => {
    const user = userEvent.setup();
    dansFenetre(<FormulaireProduit univers={UNIVERS} idFormulaire={ID} />);
    await user.click(screen.getByRole("radio", { name: /^Vêtement/ }));
    for (const taille of ["XS", "S", "M", "L", "XL", "XXL"]) expect(screen.getByRole("checkbox", { name: `Proposer la taille ${taille}` })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Proposer la taille Sur mesure" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ajouter une couleur" }));
    await user.type(screen.getByLabelText("Nom de la couleur en français"), "TEST_Noir");
    const groupe = screen.getByRole("group", { name: "Tailles et stock : TEST_Noir" });
    await user.click(within(groupe).getByRole("checkbox", { name: "Proposer la taille L" }));
    expect(within(groupe).getByLabelText("Stock")).toBeTruthy();
    expect(screen.queryByText("Type de fichier")).toBeNull();
  });

  it("Kit : la saisie déjà faite est gardée, type de fichier en lecture seule, zone des fichiers ; retour à Cosplay sans perte", async () => {
    const user = userEvent.setup();
    dansFenetre(<FormulaireProduit univers={UNIVERS} idFormulaire={ID} />);
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Kit Itachi");
    await user.type(screen.getByLabelText("Prix en dollars US (USD)"), "12");
    await user.click(screen.getByRole("radio", { name: /^Kit/ }));
    expect((screen.getByLabelText("Titre en français") as HTMLInputElement).value).toBe("TEST_Kit Itachi");
    expect((screen.getByLabelText("Prix en dollars US (USD)") as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("Adresse du Kit") as HTMLInputElement).value).toBe("test-kit-itachi");
    expect(screen.getByText("Type de fichier")).toBeTruthy();
    expect(screen.getByText("Aucun fichier joint pour le moment.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Fichier numérique du Kit" })).toBeTruthy();
    expect(screen.getByText(/Les fichiers du Kit .* s'ajoutent après le premier enregistrement/)).toBeTruthy();
    // Sections du Kit.
    expect(screen.getByRole("group", { name: "Niveau" })).toBeTruthy();
    expect(screen.getByLabelText("Matériel nécessaire en français")).toBeTruthy();
    await user.type(screen.getByLabelText("Titre en français"), " bis");
    await user.click(screen.getByRole("radio", { name: /^Cosplay/ }));
    expect((screen.getByLabelText("Titre en français") as HTMLInputElement).value).toBe("TEST_Kit Itachi bis");
    expect(screen.queryByText("Type de fichier")).toBeNull();
  });

  it("Échap après une saisie : « Quitter sans enregistrer ? » ; après un enregistrement réussi, Échap ramène à la liste", async () => {
    const user = userEvent.setup();
    const produit: ProduitAdmin = { ...KIT, famille: "cosplay", fichiers: [], video: null };
    dansFenetre(<FormulaireProduit univers={UNIVERS} produit={produit} idFormulaire={ID} milieu={<p>TEST_zones</p>} />);
    await user.type(screen.getByLabelText("Titre en anglais"), "TEST_en");
    await user.keyboard("{Escape}");
    const confirmation = screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" });
    await user.click(within(confirmation).getByRole("button", { name: "Continuer la saisie" }));
    // « Enregistrer » de l'en-tête soumet le formulaire principal.
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);
    expect(faux.enregistrerProduit).toHaveBeenCalledWith(expect.objectContaining({ titreEn: "TEST_en", famille: "cosplay" }));
    expect(await screen.findByText("Produit enregistré.")).toBeTruthy();
    // Le bouton de l'en-tête n'est plus occupé : la fenêtre sait que l'enregistrement est fini.
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Enregistrer" })[0].getAttribute("aria-disabled")).toBeNull());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.push).toHaveBeenCalledWith("/admin/produits");
  });
});

describe("FormulaireKit : type de fichier (Q24)", () => {
  it("formats déduits des fichiers joints et de la vidéo, sans doublon, en lecture seule", () => {
    dansFenetre(<FormulaireKit univers={UNIVERS} liables={[]} produit={KIT} idFormulaire={ID} milieu={<p>TEST_zones</p>} />);
    const valeur = screen.getByText("PDF A4, SVG, Vidéo");
    expect(valeur.tagName).toBe("DD");
    expect(screen.queryByRole("textbox", { name: "Type de fichier" })).toBeNull();
    expect(screen.getByText("TEST_zones")).toBeTruthy();
  });
});

describe("FenetreFormulaire : sans formulaire rendu", () => {
  it("pas de bouton « Enregistrer » dans l'en-tête quand aucun formulaire n'est désigné (lecture impossible)", () => {
    rendre(
      <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits">
        <p>TEST_erreur</p>
      </FenetreFormulaire>,
    );
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    expect(screen.getByRole("link", { name: "Fermer et revenir à la liste" })).toBeTruthy();
  });
});

describe("Saisie suivie par source (9.16 f, revue)", () => {
  it("texte alternatif saisi dans la zone image, puis le formulaire enregistré : Échap demande encore « Quitter sans enregistrer ? »", async () => {
    const user = userEvent.setup();
    const produit: ProduitAdmin = { ...KIT, famille: "cosplay", fichiers: [], video: null };
    dansFenetre(<FormulaireProduit univers={UNIVERS} produit={produit} idFormulaire={ID} milieu={<ZonesEnTete produit={enTete()} kit={false} />} />);
    await user.type(screen.getByLabelText("Texte alternatif en français"), "TEST_alt");
    await user.click(enregistrerEnTete());
    expect(await screen.findByText("Produit enregistré.")).toBeTruthy();
    await waitFor(() => expect(enregistrerEnTete().getAttribute("aria-disabled")).toBeNull());
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" })).toBeTruthy();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("envoi de photo en cours : Échap ne quitte pas ; un enregistrement du formulaire fini pendant l'envoi laisse l'en-tête occupé ; envoi réussi : Échap ramène à la liste", async () => {
    faux.demanderEnvoiPhoto.mockResolvedValueOnce({ statut: "succes", objet: `${KIT.id}/u.jpg`, jeton: "TEST_jeton" });
    faux.demarrerEnvoiTus.mockImplementationOnce(async () => ({ terminer: Promise.resolve(), annuler: vi.fn() }));
    let finir: (v: unknown) => void = () => {};
    faux.finaliserPhoto.mockReturnValueOnce(new Promise((r) => (finir = r)));
    const user = userEvent.setup({ applyAccept: false });
    const produit: ProduitAdmin = { ...KIT, famille: "cosplay", fichiers: [], video: null };
    dansFenetre(<FormulaireProduit univers={UNIVERS} produit={produit} idFormulaire={ID} milieu={<ZonesEnTete produit={enTete()} kit={false} />} />);
    await user.type(screen.getByLabelText("Texte alternatif en français"), "Face");
    await user.type(screen.getByLabelText("Texte alternatif en anglais"), "Front");
    await user.upload(screen.getByLabelText("Choisir une image"), new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Ajouter la photo" }));
    expect(await screen.findByText("Traitement de la photo…")).toBeTruthy();
    await waitFor(() => expect(enregistrerEnTete().getAttribute("aria-disabled")).toBe("true"));
    await user.keyboard("{Escape}");
    expect(faux.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // Le formulaire principal s'enregistre pendant l'envoi : l'en-tête reste occupé (deux sources comptées, jamais un seul booléen).
    fireEvent.submit(document.getElementById(ID)!);
    expect(await screen.findByText("Produit enregistré.")).toBeTruthy();
    expect(enregistrerEnTete().getAttribute("aria-disabled")).toBe("true");
    await act(async () => finir({ statut: "succes", id: "TEST_photo" }));
    expect(await screen.findByText("Photo ajoutée.")).toBeTruthy();
    await waitFor(() => expect(enregistrerEnTete().getAttribute("aria-disabled")).toBeNull());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.push).toHaveBeenCalledWith("/admin/produits");
  });
});

describe("Choix de la famille pendant une création en cours", () => {
  it("physique : les familles sont désactivées pendant l'envoi", async () => {
    // Promesse libérée en fin de test : React regroupe les transitions asynchrones en cours (une promesse jamais tenue bloquerait les tests suivants).
    let liberer: (v: unknown) => void = () => {};
    faux.enregistrerProduit.mockReturnValueOnce(new Promise((r) => (liberer = r)));
    const user = userEvent.setup();
    dansFenetre(<FormulaireProduit univers={UNIVERS} idFormulaire={ID} />);
    await user.click(screen.getByRole("radio", { name: /^Cosplay/ }));
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Cos");
    await user.click(enregistrerEnTete());
    await waitFor(() => expect((screen.getByRole("radio", { name: /^Kit/ }) as HTMLInputElement).matches(":disabled")).toBe(true));
    await act(async () => liberer({ statut: "erreur", erreur: "generique" }));
  });

  it("Kit : les familles sont désactivées pendant l'envoi (le formulaire du Kit n'est jamais retiré en plein enregistrement)", async () => {
    // Promesse libérée en fin de test : React regroupe les transitions asynchrones en cours (une promesse jamais tenue bloquerait les tests suivants).
    let liberer: (v: unknown) => void = () => {};
    faux.enregistrerKit.mockReturnValueOnce(new Promise((r) => (liberer = r)));
    const user = userEvent.setup();
    dansFenetre(<FormulaireProduit univers={UNIVERS} idFormulaire={ID} />);
    await user.click(screen.getByRole("radio", { name: /^Kit/ }));
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Kit");
    await user.click(enregistrerEnTete());
    expect(faux.enregistrerKit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((screen.getByRole("radio", { name: /^Cosplay/ }) as HTMLInputElement).matches(":disabled")).toBe(true));
    await act(async () => liberer({ statut: "erreur", erreur: "generique" }));
  });
});

describe("ENREGISTRER de l'en-tête pour un Kit", () => {
  it("création : appelle enregistrerKit puis mène à la fiche du Kit créé", async () => {
    faux.enregistrerKit.mockResolvedValueOnce({ statut: "succes", id: "TEST_kit-id", cree: true });
    const user = userEvent.setup();
    dansFenetre(<FormulaireProduit univers={UNIVERS} idFormulaire={ID} />);
    await user.click(screen.getByRole("radio", { name: /^Kit/ }));
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Kit");
    await user.click(enregistrerEnTete());
    expect(faux.enregistrerKit).toHaveBeenCalledWith(expect.objectContaining({ titreFr: "TEST_Kit", id: "" }));
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/admin/produits/TEST_kit-id?cree=1"));
  });

  it("modification : appelle enregistrerKit, puis Échap ramène à la liste sans confirmation", async () => {
    faux.enregistrerKit.mockResolvedValueOnce({ statut: "succes", id: KIT.id, cree: false });
    const user = userEvent.setup();
    dansFenetre(<FormulaireKit univers={UNIVERS} liables={[]} produit={KIT} idFormulaire={ID} milieu={<p>TEST_zones</p>} />);
    await user.type(screen.getByLabelText("Titre en anglais"), "TEST_en");
    await user.click(enregistrerEnTete());
    expect(faux.enregistrerKit).toHaveBeenCalledWith(expect.objectContaining({ id: KIT.id, titreEn: "TEST_en" }));
    await waitFor(() => expect(enregistrerEnTete().getAttribute("aria-disabled")).toBeNull());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.push).toHaveBeenCalledWith("/admin/produits");
  });
});

describe("ZonesEnTete avec un produit", () => {
  it("Kit : une seule zone de fichiers ; autre famille : aucune", () => {
    const { unmount } = dansFenetre(<ZonesEnTete produit={enTete()} kit />);
    expect(screen.getAllByRole("heading", { level: 2, name: "Fichier numérique du Kit" })).toHaveLength(1);
    expect(screen.getAllByLabelText("Fichier à envoyer")).toHaveLength(1);
    unmount();
    dansFenetre(<ZonesEnTete produit={enTete()} kit={false} />);
    expect(screen.queryByRole("heading", { name: "Fichier numérique du Kit" })).toBeNull();
    expect(screen.queryByLabelText("Fichier à envoyer")).toBeNull();
  });

  it("statut : brouillon, publié, archivé", () => {
    const { unmount: u1 } = dansFenetre(<ZonesEnTete produit={enTete()} kit={false} />);
    expect(screen.getByRole("button", { name: "Statut : Brouillon" })).toBeTruthy();
    u1();
    const { unmount: u2 } = dansFenetre(<ZonesEnTete produit={enTete({ publie: true })} kit={false} />);
    expect(screen.getByRole("button", { name: "Statut : Publié" })).toBeTruthy();
    u2();
    dansFenetre(<ZonesEnTete produit={enTete({ archive: true })} kit={false} />);
    expect(screen.getByRole("button", { name: "Statut : Archivé" })).toBeTruthy();
  });

  it("vignette : la photo principale avec son texte alternatif dans la langue de la page ; sans photo, aucune image", () => {
    const { unmount } = dansFenetre(<ZonesEnTete produit={enTete({ photo: PHOTO })} kit={false} />, "en");
    expect(screen.getByRole("img", { name: "TEST_Front" })).toBeTruthy();
    unmount();
    const { unmount: u2 } = dansFenetre(<ZonesEnTete produit={enTete({ photo: PHOTO })} kit={false} />);
    expect(screen.getByRole("img", { name: "TEST_Face" })).toBeTruthy();
    u2();
    dansFenetre(<ZonesEnTete produit={enTete()} kit={false} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("Menu STATUT dans la fenêtre", () => {
  it("Échap dans le menu ouvert le referme sans quitter la fenêtre ni ouvrir la confirmation", async () => {
    const user = userEvent.setup();
    dansFenetre(<PublicationProduit produitId={KIT.id} publie={false} />);
    // Une saisie a eu lieu : un Échap qui atteindrait la fenêtre ouvrirait la confirmation.
    fireEvent.input(document.querySelector("[data-defilement-fenetre]")!);
    const menu = screen.getByRole("button", { name: "Statut : Brouillon" });
    await user.click(menu);
    await user.keyboard("{Escape}");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("les choix ne prennent pas le focus au clic de souris (Safari) : la liste ne se ferme pas avant le clic", async () => {
    const user = userEvent.setup();
    dansFenetre(<PublicationProduit produitId={KIT.id} publie={false} />);
    await user.click(screen.getByRole("button", { name: "Statut : Brouillon" }));
    for (const libelle of ["Brouillon", "Publié", "Archivé"]) {
      expect(fireEvent.mouseDown(screen.getByRole("button", { name: libelle }))).toBe(false);
    }
  });
});
