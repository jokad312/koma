// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerArticleAction: vi.fn(),
  publierArticleAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/blog/actions", () => ({
  enregistrerArticleAction: (...a: unknown[]) => faux.enregistrerArticleAction(...a),
  publierArticleAction: (...a: unknown[]) => faux.publierArticleAction(...a),
  demanderEnvoiImageArticle: vi.fn(),
  finaliserImageArticle: vi.fn(),
  annulerEnvoiImageArticle: vi.fn(),
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
