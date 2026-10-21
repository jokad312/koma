// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
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
const verifierCode = vi.fn();
const declarerAge = vi.fn();
vi.mock("@/modules/comptes/actions", () => ({
  demanderCode: (...a: unknown[]) => demanderCode(...a),
  verifierCode: (...a: unknown[]) => verifierCode(...a),
  declarerAge: (...a: unknown[]) => declarerAge(...a),
}));

import { FormulaireConnexion } from "../../src/app/[locale]/connexion/FormulaireConnexion";

beforeEach(() => {
  vi.clearAllMocks();
});

async function allerAuCode(user: ReturnType<typeof userEvent.setup>) {
  demanderCode.mockResolvedValue({ ok: true, email: "moi@example.com" });
  await user.type(screen.getByLabelText("Adresse email"), "moi@example.com");
  await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
  await screen.findByText("Un code a été envoyé à moi@example.com.");
}

describe("FormulaireConnexion", () => {
  it("n'affiche aucun message d'envoi avant la réponse du serveur", async () => {
    const user = userEvent.setup();
    let repondre: (v: unknown) => void = () => {};
    demanderCode.mockReturnValue(new Promise((r) => (repondre = r)));
    rendre(<FormulaireConnexion />);
    await user.type(screen.getByLabelText("Adresse email"), "moi@example.com");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(screen.queryByText(/Un code a été envoyé/)).toBeNull();
    expect(screen.queryByLabelText("Code à 6 chiffres")).toBeNull();
    repondre({ ok: true, email: "moi@example.com" });
    expect(await screen.findByText("Un code a été envoyé à moi@example.com.")).toBeTruthy();
  });

  it("échec d'envoi : aucun message d'envoi, l'erreur est affichée", async () => {
    const user = userEvent.setup();
    demanderCode.mockResolvedValue({ ok: false, erreur: "limite" });
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
    declarerAge.mockResolvedValue({ ok: true, retour: "/fr/cosplays" });
    await user.type(age, "25");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith("/fr/cosplays"));
    expect(declarerAge).toHaveBeenCalledWith({ age: "25", langue: "fr", retour: "/fr/cosplays" });
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
