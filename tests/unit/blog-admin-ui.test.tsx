// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerArticleAction: vi.fn(),
  publierArticleAction: vi.fn(),
  restaurerArticleAction: vi.fn(),
  archiverArticleAction: vi.fn(),
  demanderEnvoiImageArticle: vi.fn(),
  finaliserImageArticle: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/blog/actions", () => ({
  enregistrerArticleAction: (...a: unknown[]) => faux.enregistrerArticleAction(...a),
  publierArticleAction: (...a: unknown[]) => faux.publierArticleAction(...a),
  restaurerArticleAction: (...a: unknown[]) => faux.restaurerArticleAction(...a),
  archiverArticleAction: (...a: unknown[]) => faux.archiverArticleAction(...a),
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
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import type { Article, ArticleImage } from "@/modules/blog/types";

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
  extraitFr: null,
  extraitEn: null,
  slug: null,
  lienProduitId: null,
  images: [],
  publieLe: null,
  creeLe: "2026-11-01T10:00:00.000Z",
  modifieLe: "2026-11-01T10:00:00.000Z",
  archiveLe: null,
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
      article: { titreFr: "Nouvel article", texteFr: "Un texte", titreEn: null, texteEn: null, extraitFr: null, extraitEn: null, slug: "nouvel-article", lienProduitId: null, images: [] },
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
    const fichier = screen.getByLabelText("Choisir une image");
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
    await userEvent.upload(screen.getByLabelText("Choisir une image"), new File(["x"], "face.jpg", { type: "image/jpeg" }));
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
    await userEvent.upload(screen.getByLabelText("Choisir une image"), new File(["x"], "face.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'image" }));
    expect(await screen.findByText("Le texte alternatif doit avoir de 1 à 200 caractères.")).toBeTruthy();
    expect(faux.demanderEnvoiImageArticle).not.toHaveBeenCalled();
  });
});

async function choisirStatut(user: ReturnType<typeof userEvent.setup>, statut: "Brouillon" | "Publié" | "Archivé") {
  await user.click(screen.getByRole("button", { name: /^Statut :/ }));
  await user.click(screen.getByRole("button", { name: new RegExp(`^${statut}`) }));
}

// Story 9.16 h) : menu STATUT (Brouillon / Publié / Archivé) qui déclenche les actions existantes, sur le modèle des produits (9.16 f).
describe("PublicationArticle (menu STATUT)", () => {
  it("brouillon : « Statut : Brouillon », liste des 3 statuts avec l'actuel marqué ; Échap referme sans quitter", async () => {
    const user = userEvent.setup();
    rendre(<PublicationArticle peutPublier articleId={ARTICLE.id} publie={false} />);
    const menu = screen.getByRole("button", { name: "Statut : Brouillon" });
    expect(screen.getByRole("heading", { level: 2, name: "Statut" })).toBeTruthy();
    await user.click(menu);
    const liste = document.getElementById(menu.getAttribute("aria-controls") ?? "")!;
    const choix = within(liste).getAllByRole("button");
    expect(choix.map((b) => b.textContent)).toEqual(["Brouillon", "Publié", "Archivé"]);
    expect(choix[0].getAttribute("aria-current")).toBe("true");
    await user.keyboard("{Escape}");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menu);
  });

  it("STATUT → Publié : publie et annonce le résultat réel, puis relit", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    const user = userEvent.setup();
    rendre(<PublicationArticle peutPublier articleId={ARTICLE.id} publie={false} />);
    await choisirStatut(user, "Publié");
    await waitFor(() => expect(faux.publierArticleAction).toHaveBeenCalledWith({ id: ARTICLE.id, publier: true }));
    expect(await screen.findByText("Article publié.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("publication incomplète : refus avec la liste des manques, le statut reste Brouillon", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "erreur", erreur: "publication_incomplete" });
    const user = userEvent.setup();
    rendre(<PublicationArticle peutPublier articleId={ARTICLE.id} publie={false} />);
    await choisirStatut(user, "Publié");
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Il manque encore des éléments pour publier");
    expect(alerte.textContent).toContain("Le titre en français");
    expect(screen.getByRole("button", { name: "Statut : Brouillon" })).toBeTruthy();
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("publié, STATUT → Brouillon : dépublie", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    const user = userEvent.setup();
    rendre(<PublicationArticle peutPublier articleId={ARTICLE.id} publie />);
    await choisirStatut(user, "Brouillon");
    await waitFor(() => expect(faux.publierArticleAction).toHaveBeenCalledWith({ id: ARTICLE.id, publier: false }));
    expect(await screen.findByText("Article dépublié : il n'est plus visible sur le site.")).toBeTruthy();
  });

  it("STATUT → Archivé : confirmation de la page 5 d'abord (Annuler : rien), puis archivage et relecture", async () => {
    faux.archiverArticleAction.mockResolvedValue({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<PublicationArticle peutPublier articleId={ARTICLE.id} publie titre="TEST_ Article" />);
    await choisirStatut(user, "Archivé");
    let confirmation = screen.getByRole("dialog", { name: "Archiver « TEST_ Article » ?" });
    await user.click(within(confirmation).getByRole("button", { name: "Annuler" }));
    expect(faux.archiverArticleAction).not.toHaveBeenCalled();
    await choisirStatut(user, "Archivé");
    confirmation = screen.getByRole("dialog", { name: "Archiver « TEST_ Article » ?" });
    await user.click(within(confirmation).getByRole("button", { name: "Archiver" }));
    expect(await screen.findByText("Article archivé.")).toBeTruthy();
    expect(faux.archiverArticleAction).toHaveBeenCalledWith({ id: ARTICLE.id });
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("archivé : « Statut : Archivé », Publié indisponible sans appel ; Brouillon restaure", async () => {
    faux.restaurerArticleAction.mockResolvedValue({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<PublicationArticle peutPublier articleId={ARTICLE.id} publie={false} archive />);
    expect(screen.getByRole("button", { name: "Statut : Archivé" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Statut :/ }));
    const publier = screen.getByRole("button", { name: /^Publié/ });
    // Réellement inactif : aucun appel, aucune action.
    expect((publier as HTMLButtonElement).disabled).toBe(true);
    expect(publier.textContent).toContain("(restaure d'abord l'article)");
    await user.click(publier);
    expect(faux.publierArticleAction).not.toHaveBeenCalled();
    await choisirStatut(user, "Brouillon");
    await waitFor(() => expect(faux.restaurerArticleAction).toHaveBeenCalledWith({ id: ARTICLE.id }));
    expect(await screen.findByText("Article restauré : il est revenu en brouillon.")).toBeTruthy();
  });
});

// Story 9.16 h) : extrait (résumé court) et formulaire en fenêtre, ordre de la maquette 06.
describe("FormulaireArticle en fenêtre (9.16 h)", () => {
  const STATUT = { publie: false, archive: false, titre: "Article de test", peutPublier: true };

  it("ordre de la maquette : titre, extrait, contenu, image, statut, puis adresse, lien Produit, images, aperçu", () => {
    const { container } = rendre(
      <FenetreFormulaire titre="Modifier l'article" retour="/admin/blog" idFormulaire="formulaire-article">
        <FormulaireArticle article={ARTICLE} produits={[]} idFormulaire="formulaire-article" statut={STATUT} />
      </FenetreFormulaire>,
    );
    const ordre = [
      screen.getByLabelText("Titre en français"),
      screen.getByLabelText("Titre en anglais"),
      screen.getByLabelText("Extrait (résumé court) en français"),
      screen.getByLabelText("Extrait (résumé court) en anglais"),
      screen.getByLabelText("Texte en français"),
      screen.getByLabelText("Texte en anglais"),
      screen.getByRole("heading", { level: 2, name: "Image" }),
      screen.getByLabelText("Choisir une image"),
      screen.getByRole("button", { name: "Statut : Brouillon" }),
      screen.getByLabelText("Adresse de l'article"),
      screen.getByLabelText("Lien vers un Produit"),
      screen.getByRole("heading", { level: 2, name: "Images de l'article" }),
      screen.getByRole("heading", { level: 2, name: "Aperçu" }),
    ];
    for (let i = 1; i < ordre.length; i++) {
      expect(ordre[i - 1].compareDocumentPosition(ordre[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // Un seul <form>, relié au bouton « Enregistrer » de l'en-tête de la fenêtre.
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(container.querySelector("form")!.id).toBe("formulaire-article");
    expect(screen.getByText("JPG/PNG/WEBP — 15 Mo max")).toBeTruthy();
  });

  it("création : statut Brouillon en lecture seule, images après le premier enregistrement", () => {
    rendre(<FormulaireArticle article={null} produits={[]} />);
    expect(screen.queryByRole("button", { name: /^Statut :/ })).toBeNull();
    expect(screen.getByText("Un nouvel article est enregistré en brouillon. Le statut se change après le premier enregistrement.")).toBeTruthy();
    expect(screen.getByText("Les images (JPG/PNG/WEBP — 15 Mo max) s'ajoutent après le premier enregistrement.")).toBeTruthy();
  });

  it("extrait : compteur, valeur envoyée au serveur ; « Enregistrer » de l'en-tête soumet le formulaire", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    const user = userEvent.setup();
    rendre(
      <FenetreFormulaire titre="Modifier l'article" retour="/admin/blog" idFormulaire="formulaire-article">
        <FormulaireArticle article={{ ...ARTICLE, extraitFr: "Résumé" }} produits={[]} idFormulaire="formulaire-article" statut={STATUT} />
      </FenetreFormulaire>,
    );
    expect(screen.getAllByText("6 sur 300 caractères")).toHaveLength(1);
    await user.type(screen.getByLabelText("Extrait (résumé court) en anglais"), "Summary");
    expect(screen.getByText("7 sur 300 caractères")).toBeTruthy();
    // Deux boutons « Enregistrer » : celui de l'en-tête (le premier) et celui du bas du formulaire.
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);
    await waitFor(() => expect(faux.enregistrerArticleAction).toHaveBeenCalledTimes(1));
    expect(faux.enregistrerArticleAction.mock.calls[0][0].article).toMatchObject({ extraitFr: "Résumé", extraitEn: "Summary" });
  });

  it("extrait de 301 caractères : le compteur le signale, le serveur refuse et l'erreur est reliée au champ", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "erreur", erreur: "extrait_invalide" });
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} statut={STATUT} />);
    const champ = screen.getByLabelText("Extrait (résumé court) en français");
    fireEvent.change(champ, { target: { value: "a".repeat(301) } });
    expect(screen.getByText("301 sur 300 caractères : trop long, raccourcis l'extrait.")).toBeTruthy();
    // Le navigateur n'empêche pas l'envoi : c'est le serveur qui refuse.
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(faux.enregistrerArticleAction).toHaveBeenCalledTimes(1));
    const message = await screen.findByText("L'extrait ne doit pas dépasser 300 caractères.");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("extrait anglais trop long : l'erreur va au champ anglais", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "erreur", erreur: "extrait_invalide" });
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} statut={STATUT} />);
    fireEvent.change(screen.getByLabelText("Extrait (résumé court) en anglais"), { target: { value: "b".repeat(301) } });
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("L'extrait ne doit pas dépasser 300 caractères.");
    expect(screen.getByLabelText("Extrait (résumé court) en anglais").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Extrait (résumé court) en français").getAttribute("aria-invalid")).toBeNull();
  });

  it("vignette de la zone image : première image de l'article", () => {
    const image = { fichier: "articles/44444444-4444-4444-8444-444444444444.jpg", altFr: "TEST_ Face", altEn: "TEST_ Front" };
    rendre(<FormulaireArticle article={{ ...ARTICLE, images: [image] }} produits={[]} statut={STATUT} />);
    // Annoncée une seule fois : la vignette de la zone d'ajout est décorative (alt vide), la miniature de la liste est décrite.
    expect(screen.getAllByAltText("TEST_ Face")).toHaveLength(1);
    expect(document.querySelectorAll('img[alt=""]').length).toBeGreaterThanOrEqual(1);
  });

  it("deux extraits trop longs : les deux champs marqués ; la saisie après la réponse ne déplace pas l'erreur", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "erreur", erreur: "extrait_invalide" });
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} statut={STATUT} />);
    const fr = screen.getByLabelText("Extrait (résumé court) en français");
    const en = screen.getByLabelText("Extrait (résumé court) en anglais");
    fireEvent.change(fr, { target: { value: "a".repeat(301) } });
    fireEvent.change(en, { target: { value: "b".repeat(301) } });
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(fr.getAttribute("aria-invalid")).toBe("true"));
    expect(en.getAttribute("aria-invalid")).toBe("true");
    // Raccourcir le français après la réponse : l'erreur reste figée sur les champs envoyés.
    fireEvent.change(fr, { target: { value: "court" } });
    expect(fr.getAttribute("aria-invalid")).toBe("true");
    expect(en.getAttribute("aria-invalid")).toBe("true");
  });

  it("avec statut, choisir « Publié » publie sans jamais enregistrer le formulaire", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    const user = userEvent.setup();
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} statut={STATUT} />);
    await choisirStatut(user, "Publié");
    await waitFor(() => expect(faux.publierArticleAction).toHaveBeenCalledWith({ id: ARTICLE.id, publier: true }));
    expect(faux.enregistrerArticleAction).not.toHaveBeenCalled();
  });

  it("Assistant (peutPublier faux) : statut en lecture seule, aucune action", () => {
    rendre(<FormulaireArticle article={ARTICLE} produits={[]} statut={{ ...STATUT, peutPublier: false }} />);
    expect(screen.queryByRole("button", { name: /^Statut :/ })).toBeNull();
    expect(screen.getByText("Publier, dépublier, archiver et restaurer sont réservés à l'administrateur.")).toBeTruthy();
  });

  it("création réussie : un second clic sur Enregistrer n'envoie pas une deuxième fois", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: true });
    const user = userEvent.setup();
    rendre(<FormulaireArticle article={null} produits={[]} />);
    await user.type(screen.getByLabelText("Titre en français"), "Nouvel article");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(faux.push).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /Enregistre/ }));
    expect(faux.enregistrerArticleAction).toHaveBeenCalledTimes(1);
  });
});

// Story 9.16 h) (revue) : la fenêtre protège la saisie, les envois et les actions de statut.
describe("FormulaireArticle dans la fenêtre : sortie protégée (9.16 h)", () => {
  const STATUT_F = { publie: false, archive: false, titre: "Article de test", peutPublier: true };
  const IMAGE: ArticleImage = { fichier: "articles/55555555-5555-4555-8555-555555555555.jpg", altFr: "TEST_ Dos", altEn: "TEST_ Back" };
  const fenetre = (article: Article = ARTICLE) =>
    rendre(
      <FenetreFormulaire titre="Modifier l'article" retour="/admin/blog" idFormulaire="formulaire-article">
        <FormulaireArticle article={article} produits={[]} idFormulaire="formulaire-article" statut={STATUT_F} />
      </FenetreFormulaire>,
    );

  it("saisie puis Échap : confirmation ; enregistrement réussi puis Échap : retour à la liste sans dialogue", async () => {
    faux.enregistrerArticleAction.mockResolvedValue({ statut: "succes", id: ARTICLE.id, cree: false });
    const user = userEvent.setup();
    fenetre();
    await user.type(screen.getByLabelText("Titre en anglais"), "TEST_en");
    await user.keyboard("{Escape}");
    const confirmation = screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" });
    await user.click(within(confirmation).getByRole("button", { name: "Continuer la saisie" }));
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);
    expect(await screen.findByText("Article enregistré.")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Enregistrer" })[0].getAttribute("aria-disabled")).toBeNull());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.push).toHaveBeenCalledWith("/admin/blog");
  });

  it("retrait d'une image puis Échap : confirmation (l'image n'est pas perdue sans prévenir)", async () => {
    const user = userEvent.setup();
    fenetre({ ...ARTICLE, images: [IMAGE] });
    await user.click(screen.getByRole("button", { name: "Retirer l'image 1" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" })).toBeTruthy();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("Échap dans le menu STATUT ouvert : la liste se referme, la fenêtre ne quitte pas et ne demande rien", async () => {
    const user = userEvent.setup();
    fenetre();
    await user.click(screen.getByRole("button", { name: "Statut : Brouillon" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Statut : Brouillon" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("publication en cours : Échap ne quitte pas ; refus : le focus va au message", async () => {
    let repondre: (v: unknown) => void = () => {};
    faux.publierArticleAction.mockReturnValue(new Promise((r) => (repondre = r)));
    const user = userEvent.setup();
    fenetre();
    await choisirStatut(user, "Publié");
    await user.keyboard("{Escape}");
    expect(faux.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    repondre({ statut: "erreur", erreur: "non_autorise" });
    const alerte = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement?.contains(alerte)).toBe(true));
  });

  it("envoi d'image en cours : Retirer et Enregistrer bloqués, Échap ne quitte pas", async () => {
    faux.demanderEnvoiImageArticle.mockResolvedValue({ statut: "succes", objet: "attente/x.jpg", jeton: "TEST_jeton" });
    faux.finaliserImageArticle.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    fenetre({ ...ARTICLE, images: [IMAGE] });
    await user.upload(screen.getByLabelText("Choisir une image"), new File(["x"], "face.jpg", { type: "image/jpeg" }));
    await user.type(screen.getByLabelText("Texte alternatif en français"), "Face");
    await user.type(screen.getByLabelText("Texte alternatif en anglais"), "Front");
    await user.click(screen.getByRole("button", { name: "Ajouter l'image" }));
    await waitFor(() => expect(faux.finaliserImageArticle).toHaveBeenCalled());
    expect((screen.getByRole("button", { name: "Retirer l'image 1" }) as HTMLButtonElement).disabled).toBe(true);
    // Les deux boutons « Enregistrer » sont occupés ; aucun envoi de l'article.
    for (const b of screen.getAllByRole("button", { name: /Enregistre/ })) await user.click(b);
    expect(faux.enregistrerArticleAction).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(faux.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ImagesArticle : retrait pendant un envoi", () => {
  it("une image retirée pendant un envoi en attente ne revient pas à la fin de l'envoi", async () => {
    const A: ArticleImage = { fichier: "articles/66666666-6666-4666-8666-666666666666.jpg", altFr: "TEST_ A", altEn: "TEST_ A" };
    const NOUVELLE: ArticleImage = { fichier: "articles/77777777-7777-4777-8777-777777777777.jpg", altFr: "Face", altEn: "Front" };
    let finir: (v: unknown) => void = () => {};
    faux.demanderEnvoiImageArticle.mockResolvedValue({ statut: "succes", objet: "attente/x.jpg", jeton: "TEST_jeton" });
    faux.finaliserImageArticle.mockReturnValue(new Promise((r) => (finir = r)));
    const vues: ArticleImage[][] = [];
    function Banc() {
      const [images, setImages] = useState<ArticleImage[]>([A]);
      vues.push(images);
      return (
        <>
          <ImagesArticle images={images} onChange={setImages} partie="ajout" />
          <button type="button" onClick={() => setImages([])}>
            TEST_retirer
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    rendre(<Banc />);
    await user.upload(screen.getByLabelText("Choisir une image"), new File(["x"], "face.jpg", { type: "image/jpeg" }));
    await user.type(screen.getByLabelText("Texte alternatif en français"), "Face");
    await user.type(screen.getByLabelText("Texte alternatif en anglais"), "Front");
    await user.click(screen.getByRole("button", { name: "Ajouter l'image" }));
    await waitFor(() => expect(faux.finaliserImageArticle).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "TEST_retirer" }));
    finir({ statut: "succes", image: NOUVELLE });
    await waitFor(() => expect(vues.at(-1)).toEqual([NOUVELLE]));
  });
});
