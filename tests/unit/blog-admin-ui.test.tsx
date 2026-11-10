// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerArticleAction: vi.fn(),
  publierArticleAction: vi.fn(),
  demanderEnvoiImageArticle: vi.fn(),
  finaliserImageArticle: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/blog/actions", () => ({
  enregistrerArticleAction: (...a: unknown[]) => faux.enregistrerArticleAction(...a),
  publierArticleAction: (...a: unknown[]) => faux.publierArticleAction(...a),
  demanderEnvoiImageArticle: (...a: unknown[]) => faux.demanderEnvoiImageArticle(...a),
  finaliserImageArticle: (...a: unknown[]) => faux.finaliserImageArticle(...a),
  annulerEnvoiImageArticle: vi.fn(),
}));
vi.mock("@/lib/supabase/envoi-tus", () => ({
  demarrerEnvoiTus: async () => ({ terminer: Promise.resolve(), annuler: async () => {} }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push, refresh: faux.refresh }),
  usePathname: () => "/admin/blog",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { FormulaireArticle } from "@/components/admin/FormulaireArticle";
import { ImagesArticle } from "@/components/admin/ImagesArticle";
import { PublicationArticle } from "@/components/admin/PublicationArticle";
import type { Article } from "@/modules/blog/types";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
});

const ARTICLE: Article = {
  id: "00000000-0000-4000-8000-0000000000a2",
  auteurId: "00000000-0000-4000-8000-0000000000a1",
  titreFr: "Article de test",
  titreEn: null,
  texteFr: "Texte de test",
  texteEn: null,
  slug: null,
  lienProduitId: null,
  images: [],
  publieLe: null,
  creeLe: "2026-11-01T10:00:00.000Z",
  modifieLe: "2026-11-01T10:00:00.000Z",
};

describe("FormulaireArticle", () => {
  it("l'aperçu nettoie le HTML brut, les scripts et les liens javascript:", async () => {
    const { container } = rendre(<FormulaireArticle article={null} produits={[]} />);
    const texte = screen.getByLabelText("Texte en français");
    await userEvent.click(texte);
    await userEvent.paste("<script>alert(1)</script>\n\n[piege](javascript:alert(1))");
    const apercu = () => container.querySelector("[data-apercu]");
    await waitFor(() => expect(apercu()?.textContent).toContain("piege"));
    expect(apercu()?.querySelector("script")).toBeNull();
    expect(apercu()?.querySelector("a")).toBeNull();
    expect(apercu()?.innerHTML).not.toContain("alert(1)");
  });

  it("création : envoie la saisie puis ouvre la fiche d'édition", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: true });
    rendre(<FormulaireArticle article={null} produits={[]} />);
    await userEvent.type(screen.getByLabelText("Titre en français"), "Nouvel article");
    await userEvent.type(screen.getByLabelText("Texte en français"), "Un texte");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(faux.enregistrerArticleAction).toHaveBeenCalledTimes(1));
    expect(faux.enregistrerArticleAction).toHaveBeenCalledWith({
      id: null,
      article: { titreFr: "Nouvel article", texteFr: "Un texte", titreEn: null, texteEn: null, slug: "nouvel-article", lienProduitId: null, images: [] },
    });
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith(`/admin/blog/${ARTICLE.id}?cree=1`));
  });

  it("échec serveur : message affiché, saisie conservée, aucun succès", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "erreur", erreur: "titre_invalide" });
    rendre(<FormulaireArticle article={null} produits={[]} />);
    await userEvent.type(screen.getByLabelText("Titre en français"), "Titre");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Le titre doit avoir de 1 à 120 caractères.")).toBeTruthy();
    expect((screen.getByLabelText("Titre en français") as HTMLInputElement).value).toBe("Titre");
    expect(faux.refresh).not.toHaveBeenCalled();
  });
});

describe("ImagesArticle", () => {
  it("liste les images avec leurs textes alternatifs et retire celle choisie de la liste", async () => {
    const onChange = vi.fn();
    rendre(
      <ImagesArticle
        images={[
          { fichier: "articles/11111111-1111-4111-8111-111111111111.jpg", altFr: "Face du costume", altEn: "Costume front" },
          { fichier: "articles/22222222-2222-4222-8222-222222222222.jpg", altFr: "Dos du costume", altEn: "Costume back" },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Texte alternatif en français : Face du costume")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retirer l'image 1" }));
    expect(onChange).toHaveBeenCalledWith([{ fichier: "articles/22222222-2222-4222-8222-222222222222.jpg", altFr: "Dos du costume", altEn: "Costume back" }]);
  });
});

describe("ImagesArticle dans le formulaire de l'article (pas de <form> imbriqué)", () => {
  const IMAGE = { fichier: "articles/33333333-3333-4333-8333-333333333333.jpg", altFr: "Face", altEn: "Front" };

  it("aucun <form> dans un <form>, aucune erreur React de structure HTML", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = rendre(<FormulaireArticle article={ARTICLE} produits={[]} />);
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(container.querySelectorAll("form form")).toHaveLength(0);
    expect(erreurs.mock.calls.map((c) => String(c[0])).filter((m) => /cannot be a descendant|validateDOMNesting|hydrat/i.test(m))).toEqual([]);
    erreurs.mockRestore();
  });

  it("Entrée dans un champ de l'ajout n'enregistre pas l'article", async () => {
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} />);
    await userEvent.type(screen.getByLabelText("Texte alternatif en français"), "Une description{Enter}");
    expect(faux.enregistrerArticleAction).not.toHaveBeenCalled();
    // Entrée sans fichier : l'ajout est refusé avec son message, toujours sans enregistrer l'article.
    expect(await screen.findByText("Ce fichier n'est pas une image JPEG, PNG ou WebP valide.")).toBeTruthy();
    expect(faux.demanderEnvoiImageArticle).not.toHaveBeenCalled();
  });

  it("Entrée sur le champ fichier n'est pas interceptée (elle ouvre le sélecteur du navigateur)", async () => {
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} />);
    const fichier = screen.getByLabelText("Fichier");
    const evenement = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    fichier.dispatchEvent(evenement);
    expect(evenement.defaultPrevented).toBe(false);
    expect(faux.demanderEnvoiImageArticle).not.toHaveBeenCalled();
  });

  it("« Ajouter l'image » ne déclenche pas l'enregistrement ; « Enregistrer » ne déclenche pas l'ajout", async () => {
    faux.demanderEnvoiImageArticle.mockResolvedValue({ statut: "succes", objet: "attente/x.jpg", jeton: "TEST_jeton" });
    faux.finaliserImageArticle.mockResolvedValue({ statut: "succes", image: IMAGE });
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} />);

    // Ajout complet : fichier, deux textes alternatifs, bouton « Ajouter l'image ».
    await userEvent.upload(screen.getByLabelText("Fichier"), new File(["x"], "face.jpg", { type: "image/jpeg" }));
    await userEvent.type(screen.getByLabelText("Texte alternatif en français"), "Face");
    await userEvent.type(screen.getByLabelText("Texte alternatif en anglais"), "Front");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'image" }));
    expect(await screen.findByText("Image ajoutée. Elle sera enregistrée avec l'article.")).toBeTruthy();
    expect(faux.finaliserImageArticle).toHaveBeenCalledWith({ objet: "attente/x.jpg", altFr: "Face", altEn: "Front" });
    expect(faux.enregistrerArticleAction).not.toHaveBeenCalled();
    expect(screen.getByText("Texte alternatif en français : Face")).toBeTruthy();

    // Enregistrer envoie l'article avec l'image, une seule fois, sans relancer d'ajout.
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(faux.enregistrerArticleAction).toHaveBeenCalledTimes(1));
    expect(faux.enregistrerArticleAction.mock.calls[0][0].article.images).toEqual([IMAGE]);
    expect(faux.demanderEnvoiImageArticle).toHaveBeenCalledTimes(1);

    // Retrait : l'image sort de la liste puis de l'envoi suivant.
    await userEvent.click(screen.getByRole("button", { name: "Retirer l'image 1" }));
    expect(screen.queryByText("Texte alternatif en français : Face")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(faux.enregistrerArticleAction).toHaveBeenCalledTimes(2));
    expect(faux.enregistrerArticleAction.mock.calls[1][0].article.images).toEqual([]);
  });

  it("texte alternatif manquant : refus avant tout envoi", async () => {
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} />);
    await userEvent.upload(screen.getByLabelText("Fichier"), new File(["x"], "face.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'image" }));
    expect(await screen.findByText("Le texte alternatif doit avoir de 1 à 200 caractères.")).toBeTruthy();
    expect(faux.demanderEnvoiImageArticle).not.toHaveBeenCalled();
  });
});

describe("PublicationArticle", () => {  it("brouillon : publie et annonce le résultat réel", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    rendre(<PublicationArticle articleId={ARTICLE.id} publie={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(faux.publierArticleAction).toHaveBeenCalledWith({ id: ARTICLE.id, publier: true }));
    expect(await screen.findByText("Article publié.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("publication incomplète : refuse et liste ce qui manque", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "erreur", erreur: "publication_incomplete" });
    rendre(<PublicationArticle articleId={ARTICLE.id} publie={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByText(/Il manque encore des éléments pour publier/)).toBeTruthy();
    expect(screen.getByText("Le titre en français")).toBeTruthy();
    expect(faux.refresh).not.toHaveBeenCalled();
  });
});
