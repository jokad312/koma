// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import fr from "../../messages/fr.json";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const remplacer = vi.fn();
const rafraichir = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: remplacer, refresh: rafraichir, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("retour=/fr/cosplays"),
}));

const demanderCode = vi.fn();
// Premier envoi : action de formulaire (état précédent, données du formulaire).
const demanderCodeParFormulaire = vi.fn();
const verifierCode = vi.fn();
const declarerAge = vi.fn();
const enregistrerQuestionsAccueil = vi.fn();
vi.mock("@/modules/comptes/actions", () => ({
  demanderCode: (...a: unknown[]) => demanderCode(...a),
  demanderCodeParFormulaire: (...a: unknown[]) => demanderCodeParFormulaire(...a),
  verifierCode: (...a: unknown[]) => verifierCode(...a),
  declarerAge: (...a: unknown[]) => declarerAge(...a),
  enregistrerQuestionsAccueil: (...a: unknown[]) => enregistrerQuestionsAccueil(...a),
  connecterAvecGoogle: vi.fn(),
}));

import { FormulaireConnexion } from "../../src/app/[locale]/connexion/FormulaireConnexion";

beforeEach(() => {
  vi.clearAllMocks();
});

async function allerAuCode(user: ReturnType<typeof userEvent.setup>) {
  demanderCodeParFormulaire.mockResolvedValue({ ok: true, email: "moi@example.com", envoyeLe: Date.now() });
  await user.type(screen.getByLabelText("Adresse email"), "moi@example.com");
  await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
  await screen.findByText("Un code a été envoyé à moi@example.com.");
}

describe("FormulaireConnexion", () => {
  it("Chrome ou Safari : « Continuer avec Google » avec le G officiel, le code email reste disponible", () => {
    rendre(<FormulaireConnexion google="disponible" />);
    const bouton = screen.getByRole("button", { name: "Continuer avec Google" });
    expect(bouton.querySelector("img")?.getAttribute("src")).toContain("/google/google-g.svg");
    expect(bouton.className).toContain("min-h-touch");
    expect(screen.getByRole("button", { name: "Recevoir un code" })).toBeTruthy();
  });

  it("navigateur intégré : pas de bouton Google, message clair, code email disponible", () => {
    rendre(<FormulaireConnexion google="indisponible" />);
    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
    expect(screen.getByText(/Google bloque sa connexion/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recevoir un code" })).toBeTruthy();
  });

  it("retour de Google en échec : message d'erreur annoncé, rien d'autre perdu", () => {
    rendre(<FormulaireConnexion erreurGoogle />);
    expect(screen.getByRole("alert").textContent).toContain("La connexion avec Google n'a pas abouti");
    expect(screen.getByLabelText("Adresse email")).toBeTruthy();
  });

  it("n'affiche aucun message d'envoi avant la réponse du serveur", async () => {
    const user = userEvent.setup();
    let repondre: (v: unknown) => void = () => {};
    demanderCodeParFormulaire.mockReturnValue(new Promise((r) => (repondre = r)));
    rendre(<FormulaireConnexion />);
    await user.type(screen.getByLabelText("Adresse email"), "moi@example.com");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(screen.queryByText(/Un code a été envoyé/)).toBeNull();
    expect(screen.queryByLabelText("Code à 6 chiffres")).toBeNull();
    repondre({ ok: true, email: "moi@example.com", envoyeLe: Date.now() });
    expect(await screen.findByText("Un code a été envoyé à moi@example.com.")).toBeTruthy();
  });

  it("le premier envoi part par l'action du formulaire, avec l'adresse saisie et la langue", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    expect(demanderCodeParFormulaire).toHaveBeenCalledTimes(1);
    const donnees = demanderCodeParFormulaire.mock.calls[0][1] as FormData;
    expect(donnees.get("email")).toBe("moi@example.com");
    expect(donnees.get("langue")).toBe("fr");
  });

  it("une adresse tapée avant l'hydratation n'est pas effacée quand React prend la main", async () => {
    const arbre = (
      <NextIntlClientProvider locale="fr" messages={fr}>
        <FormulaireConnexion />
      </NextIntlClientProvider>
    );
    // Page rendue par le serveur, pas encore hydratée : le visiteur tape son adresse.
    const conteneur = document.body.appendChild(document.createElement("div"));
    conteneur.innerHTML = renderToString(arbre);
    const champ = conteneur.querySelector("input[name=email]") as HTMLInputElement;
    champ.value = "moi@example.com";
    // React prend la main.
    await act(async () => {
      render(arbre, { container: conteneur, hydrate: true });
    });
    expect((screen.getByLabelText("Adresse email") as HTMLInputElement).value).toBe("moi@example.com");
    // Et l'envoi emporte cette adresse (un champ contrôlé par un état vide enverrait une adresse vide).
    demanderCodeParFormulaire.mockResolvedValue({ ok: true, email: "moi@example.com", envoyeLe: Date.now() });
    await userEvent.setup().click(screen.getByRole("button", { name: "Recevoir un code" }));
    await screen.findByText("Un code a été envoyé à moi@example.com.");
    expect((demanderCodeParFormulaire.mock.calls[0][1] as FormData).get("email")).toBe("moi@example.com");
  });

  it("échec d'envoi : aucun message d'envoi, l'erreur est affichée", async () => {
    const user = userEvent.setup();
    demanderCodeParFormulaire.mockResolvedValue({ ok: false, erreur: "limite", email: "moi@example.com" });
    rendre(<FormulaireConnexion />);
    await user.type(screen.getByLabelText("Adresse email"), "moi@example.com");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(await screen.findByText(/Trop de demandes de code/)).toBeTruthy();
    expect(screen.queryByText(/Un code a été envoyé/)).toBeNull();
  });

  it("champ de code unique : one-time-code, numérique, 6 caractères, collage permis, pas de soumission automatique", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    const champ = screen.getByLabelText("Code à 6 chiffres") as HTMLInputElement;
    expect(champ.getAttribute("autocomplete")).toBe("one-time-code");
    expect(champ.getAttribute("inputmode")).toBe("numeric");
    expect(champ.getAttribute("pattern")).toBe("[0-9]*");
    expect(champ.getAttribute("maxlength")).toBe("6");
    await user.click(champ);
    await user.paste("123 456");
    expect(champ.value).toBe("123456");
    expect(verifierCode).not.toHaveBeenCalled();
    expect(screen.getByText("Le code est valable 10 minutes.")).toBeTruthy();
    expect(screen.getByText(/Tu pourras renvoyer le code dans \d+ secondes/)).toBeTruthy();
  });

  it("code faux : message relié au champ, saisie modifiable", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: false, erreur: "code_faux" });
    const champ = screen.getByLabelText("Code à 6 chiffres") as HTMLInputElement;
    await user.type(champ, "111111");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    const message = await screen.findByText("Ce code n'est pas le bon. Vérifie-le ou demande un nouveau code.");
    expect(champ.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.value).toBe("111111");
    await user.type(champ, "{Backspace}2");
    expect(champ.value).toBe("111112");
    expect(verifierCode).toHaveBeenCalledWith(expect.objectContaining({ code: "111111", retour: "/fr/cosplays", langue: "fr" }));
  });

  it("code expiré : « Ce code a expiré. »", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: false, erreur: "code_expire" });
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "111111");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    expect(await screen.findByText("Ce code a expiré.")).toBeTruthy();
  });

  it("aide : adresse, courriers indésirables, changer d'adresse", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    expect(screen.getByText("Vérifie que l'adresse moi@example.com est correcte.")).toBeTruthy();
    expect(screen.getByText("Regarde dans tes courriers indésirables.")).toBeTruthy();
    await user.click(screen.getByText("Je n'ai pas reçu l'email"));
    await user.click(screen.getByRole("button", { name: "Changer d'adresse email" }));
    expect(screen.getByLabelText("Adresse email")).toBeTruthy();
  });

  it("code correct, Compte sans âge : étape âge, puis retour à la page quittée", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: true, etape: "age", retour: "/fr/cosplays" });
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    const age = await screen.findByLabelText("Âge");
    declarerAge.mockResolvedValue({ ok: true, retour: "/fr/cosplays", etape: "termine" });
    await user.type(age, "25");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith("/fr/cosplays"));
    expect(declarerAge).toHaveBeenCalledWith({ age: "25", langue: "fr", retour: "/fr/cosplays" });
  });

  async function allerAuxQuestions(user: ReturnType<typeof userEvent.setup>) {
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: true, etape: "age", retour: "/fr/cosplays" });
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    declarerAge.mockResolvedValue({ ok: true, retour: "/fr/cosplays", etape: "questions" });
    await user.type(await screen.findByLabelText("Âge"), "25");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await screen.findByRole("heading", { name: "Quelques questions" });
  }

  it("après l'âge : questions facultatives, « Passer » ramène à la page quittée sans réponse", async () => {
    const user = userEvent.setup();
    await allerAuxQuestions(user);
    expect(remplacer).not.toHaveBeenCalled();
    enregistrerQuestionsAccueil.mockResolvedValue({ ok: true, retour: "/fr/cosplays" });
    await user.click(screen.getByRole("button", { name: "Passer" }));
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith("/fr/cosplays"));
    expect(enregistrerQuestionsAccueil).toHaveBeenCalledWith({ origine: "", preference: "", langue: "fr", retour: "/fr/cosplays" });
  });

  it("questions : réponses envoyées, sélecteur à deux options sans action au choix, pas de question « univers »", async () => {
    const user = userEvent.setup();
    await allerAuxQuestions(user);
    expect(screen.queryByText(/univers/i)).toBeNull();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["porter", "fabriquer"]);
    await user.selectOptions(screen.getByLabelText("Comment nous as-tu connus ?"), "ami");
    await user.click(screen.getByRole("radio", { name: "Fabriquer" }));
    expect(enregistrerQuestionsAccueil).not.toHaveBeenCalled();
    expect(remplacer).not.toHaveBeenCalled();
    enregistrerQuestionsAccueil.mockResolvedValue({ ok: true, retour: "/fr/cosplays" });
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith("/fr/cosplays"));
    expect(enregistrerQuestionsAccueil).toHaveBeenCalledWith({ origine: "ami", preference: "fabriquer", langue: "fr", retour: "/fr/cosplays" });
  });

  it("questions : échec d'enregistrement, message clair et « Passer » reste possible", async () => {
    const user = userEvent.setup();
    await allerAuxQuestions(user);
    enregistrerQuestionsAccueil.mockResolvedValue({ ok: false, erreur: "generique" });
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByText(/n'ont pas pu être enregistrées/)).toBeTruthy();
    expect(remplacer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Passer" })).toBeTruthy();
  });

  it("Compte complet qui n'a jamais vu les questions : elles s'ouvrent directement", () => {
    rendre(<FormulaireConnexion etapeInitiale="questions" />);
    expect(screen.getByRole("heading", { name: "Quelques questions" })).toBeTruthy();
  });

  it("Compte complet : retour direct", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: true, etape: "termine", retour: "/fr/cosplays" });
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith("/fr/cosplays"));
  });

  it("moins de 13 ans : message clair, pas de retour", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: true, etape: "age", retour: "/fr" });
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    declarerAge.mockResolvedValue({ ok: false, erreur: "moins_13" });
    await user.type(await screen.findByLabelText("Âge"), "12");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByText(/Il faut avoir au moins 13 ans/)).toBeTruthy();
    expect(remplacer).not.toHaveBeenCalled();
  });

  it("âge invalide : erreur sur le champ", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireConnexion />);
    await allerAuCode(user);
    verifierCode.mockResolvedValue({ ok: true, etape: "age", retour: "/fr" });
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    declarerAge.mockResolvedValue({ ok: false, erreur: "age_invalide" });
    const age = await screen.findByLabelText("Âge");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    const message = await screen.findByText("Saisis ton âge en chiffres, entre 0 et 120.");
    expect(age.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
  });
});
