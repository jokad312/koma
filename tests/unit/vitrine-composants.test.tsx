// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const envoyer = vi.fn();
vi.mock("@/modules/contact/actions", () => ({ envoyerMessageContact: (...a: unknown[]) => envoyer(...a) }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("server-only", () => ({}));
// Composants serveur asynchrones : getTranslations lit les vrais messages français.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages, namespace: namespace as never }) };
});

import { BoutonWhatsApp } from "@/components/vitrine/BoutonWhatsApp";
import { FormulaireContact } from "@/components/vitrine/FormulaireContact";
import { QuestionsFaq } from "@/components/vitrine/QuestionsFaq";
import { PiedDePage } from "@/components/layout/PiedDePage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BoutonWhatsApp", () => {
  it("lien wa.me avec les seuls chiffres, nouvel onglet, rel sécurisé, sans message prérempli", () => {
    rendre(<BoutonWhatsApp numero="+243970000000" />);
    const lien = screen.getByRole("link", { name: /Écrire sur WhatsApp/ });
    expect(lien.getAttribute("href")).toBe("https://wa.me/243970000000");
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(lien.getAttribute("rel")).toBe("noopener noreferrer");
    expect(lien.getAttribute("href")).not.toContain("text=");
    expect(lien.textContent).toContain("s'ouvre dans un nouvel onglet");
  });

  it("sans numéro (ou numéro mal formé) : aucun bouton, aucun numéro de repli", () => {
    for (const numero of [null, "", "abc", "970000000"]) {
      const { container, unmount } = rendre(<BoutonWhatsApp numero={numero} />);
      expect(container.innerHTML).toBe("");
      unmount();
    }
  });
});

describe("QuestionsFaq", () => {
  const elements = [
    { cle: "a", question: "TEST_Question A", reponse: "TEST_Réponse A" },
    { cle: "b", question: "TEST_Question B", reponse: "TEST_Réponse B" },
  ];

  it("accordéons natifs indépendants : plusieurs peuvent rester ouverts", () => {
    const { container } = rendre(<QuestionsFaq elements={elements} />);
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(2);
    details.forEach((d) => (d.open = true));
    expect([...details].every((d) => d.open)).toBe(true);
    expect(details[0].querySelector("summary")?.textContent).toContain("TEST_Question A");
  });

  it("1 colonne sur mobile, 2 à lg, cartes rounded-lg", () => {
    const { container } = rendre(<QuestionsFaq elements={elements} />);
    const grille = container.firstElementChild as HTMLElement;
    expect(grille.className).toContain("lg:grid-cols-2");
    expect(grille.className).not.toMatch(/(^|\s)grid-cols-2/);
    expect(container.querySelector("details")?.className).toContain("rounded-lg");
    expect(container.querySelector("summary")?.className).toContain("min-h-touch");
  });
});

describe("FormulaireContact", () => {
  async function remplir(user: ReturnType<typeof userEvent.setup>, valeurs: { nom?: string; email?: string; message?: string }) {
    if (valeurs.nom !== undefined) await user.type(screen.getByRole("textbox", { name: "Nom" }), valeurs.nom);
    if (valeurs.email !== undefined) await user.type(screen.getByRole("textbox", { name: "Adresse email" }), valeurs.email);
    if (valeurs.message !== undefined) await user.type(screen.getByRole("textbox", { name: /^Message/ }), valeurs.message);
  }

  it("libellés visibles et langue de la route dans le formulaire", () => {
    const { container } = rendre(<FormulaireContact />, "en");
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect((container.querySelector('input[name="langue"]') as HTMLInputElement).value).toBe("en");
  });

  it("« Message envoyé » seulement après la réponse réelle, puis champs vidés", async () => {
    let repondre: (v: unknown) => void = () => {};
    envoyer.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    const user = userEvent.setup();
    rendre(<FormulaireContact />);
    await remplir(user, { nom: "TEST_Awa", email: "TEST_awa@example.invalid", message: "Bonjour, ceci est un message." });
    await user.click(screen.getByRole("button", { name: "Envoyer le message" }));

    expect(await screen.findByRole("button", { name: "Envoi…" })).toBeTruthy();
    expect(screen.queryByText(/Message envoyé/)).toBeNull();

    await act(async () => repondre({ statut: "succes" }));
    expect(await screen.findByText(/Message envoyé/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Nom" }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: "Adresse email" }) as HTMLInputElement).value).toBe("");
  });

  it("champ invalide : erreur sous le champ liée par aria-describedby, résumé en alerte, saisie gardée", async () => {
    envoyer.mockResolvedValue({
      statut: "erreur",
      erreur: "champs",
      champs: { email: "email_invalide" },
      valeurs: { nom: "TEST_Awa", email: "faux", message: "Bonjour, ceci est un message." },
    });
    const user = userEvent.setup();
    rendre(<FormulaireContact />);
    await remplir(user, { nom: "TEST_Awa", email: "faux", message: "Bonjour, ceci est un message." });
    await user.click(screen.getByRole("button", { name: "Envoyer le message" }));

    const champ = await screen.findByRole("textbox", { name: "Adresse email" });
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const erreur = document.getElementById(champ.getAttribute("aria-describedby") ?? "");
    expect(erreur?.textContent).toBe("Saisis une adresse email valide.");
    expect(screen.getByRole("alert").textContent).toBe("Il y a des erreurs à corriger.");
    expect((champ as HTMLInputElement).value).toBe("faux");
    expect((screen.getByRole("textbox", { name: "Nom" }) as HTMLInputElement).value).toBe("TEST_Awa");
    expect(screen.queryByText(/Message envoyé/)).toBeNull();
  });

  it("limite atteinte : message de réessai, saisie gardée, aucun succès", async () => {
    envoyer.mockResolvedValue({
      statut: "erreur",
      erreur: "trop_d_essais",
      champs: {},
      valeurs: { nom: "TEST_Awa", email: "TEST_awa@example.invalid", message: "Bonjour, ceci est un message." },
    });
    const user = userEvent.setup();
    rendre(<FormulaireContact />);
    await remplir(user, { nom: "TEST_Awa" });
    await user.click(screen.getByRole("button", { name: "Envoyer le message" }));
    expect(await screen.findByText(/Trop de messages envoyés/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Adresse email" }) as HTMLInputElement).value).toBe("TEST_awa@example.invalid");
    expect(screen.queryByText(/Message envoyé/)).toBeNull();
  });

  it("échec de la base : pas de succès, saisie gardée", async () => {
    envoyer.mockResolvedValue({ statut: "erreur", erreur: "generique", champs: {}, valeurs: { nom: "TEST_Awa", email: "a@example.invalid", message: "Bonjour, ceci est un message." } });
    const user = userEvent.setup();
    rendre(<FormulaireContact />);
    await user.click(screen.getByRole("button", { name: "Envoyer le message" }));
    expect(await screen.findByText(/n'a pas pu être envoyé/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Nom" }) as HTMLInputElement).value).toBe("TEST_Awa");
    expect(screen.queryByText(/Message envoyé/)).toBeNull();
  });
});

describe("PiedDePage : carte Aide", () => {
  async function rendrePied(numero: string | null) {
    const element = await PiedDePage({ nomSite: "TEST_SITE", numeroWhatsapp: numero });
    return rendre(element);
  }

  it("FAQ et Contact toujours, WhatsApp si un numéro est réglé", async () => {
    await rendrePied("+243970000000");
    const aide = screen.getByRole("region", { name: "Aide" });
    expect(within(aide).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/faq", "/contact", "https://wa.me/243970000000"]);
    expect(within(aide).getByRole("link", { name: /WhatsApp/ }).getAttribute("rel")).toBe("noopener noreferrer");
    // Chaque lien du pied a une cible tactile de 44 px.
    for (const l of within(aide).getAllByRole("link")) expect(l.className).toContain("min-h-touch");
  });

  it("sans numéro : aucun lien WhatsApp", async () => {
    await rendrePied(null);
    const aide = screen.getByRole("region", { name: "Aide" });
    expect(within(aide).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/faq", "/contact"]);
  });

  it("carte Infos légales : quatre liens de 44 px vers les pages légales", async () => {
    await rendrePied(null);
    const legal = screen.getByRole("region", { name: "Infos légales" });
    const liens = within(legal).getAllByRole("link");
    expect(liens.map((l) => l.getAttribute("href"))).toEqual(["/mentions-legales", "/cgv", "/livraison-et-retours", "/confidentialite"]);
    for (const l of liens) expect(l.className).toContain("min-h-touch");
  });

  it("le pied rendu côté serveur est rendable avec les messages français", async () => {
    const element = await PiedDePage({ nomSite: "TEST_SITE", numeroWhatsapp: null });
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="fr" messages={fr}>
        {element}
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Infos légales");
  });
});

describe("FormulaireContact : lien de confidentialité", () => {
  it("lien vers /confidentialite de 44 px, sans case à cocher", () => {
    rendre(<FormulaireContact />);
    const lien = screen.getByRole("link", { name: /Politique de confidentialité/ });
    expect(lien.getAttribute("href")).toBe("/confidentialite");
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(lien.getAttribute("rel")).toBe("noopener");
    expect(lien.className).toContain("min-h-touch");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
