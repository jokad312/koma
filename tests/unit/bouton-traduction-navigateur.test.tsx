// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Bouton } from "@/components/ui/Bouton";
import { rendre } from "./aides-dom";

// Bug du 2026-11-22 (/fr/connexion, « Recevoir un code ») : la traduction automatique du navigateur remplace le nœud texte du libellé
// par ses propres éléments <font>. React insérait ensuite l'indicateur « en cours » devant ce nœud texte disparu :
// « NotFoundError: Failed to execute 'insertBefore' on 'Node' ». Le test simule cette traduction, comme le fait Google Traduction.
// Vérifié : sur l'ancien Bouton, le premier cas échoue avec « NotFoundError: The child can not be found in the parent ».

function traduireCommeLeNavigateur(racine: HTMLElement) {
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  const textes: Text[] = [];
  while (parcours.nextNode()) textes.push(parcours.currentNode as Text);
  for (const texte of textes) {
    const exterieur = document.createElement("font");
    const interieur = document.createElement("font");
    interieur.textContent = `[traduit] ${texte.data}`;
    exterieur.appendChild(interieur);
    texte.replaceWith(exterieur);
  }
  return textes.length;
}

// Même forme que FormulaireConnexion : le clic passe le bouton « en cours » et change son libellé ; un second bouton le remet au repos.
function BoutonEnvoi() {
  const [enCours, setEnCours] = useState(false);
  return (
    <div>
      <Bouton onClick={() => setEnCours(true)} enCours={enCours}>
        {enCours ? "Envoi en cours…" : "Recevoir un code"}
      </Bouton>
      <button type="button" onClick={() => setEnCours(false)}>
        Fin
      </button>
    </div>
  );
}

// Même forme que les boutons « Restaurer » de l'admin (icône et libellé).
function BoutonRestaurer() {
  const [enCours, setEnCours] = useState(false);
  return (
    <div>
      <Bouton variante="secondaire" onClick={() => setEnCours(true)} enCours={enCours}>
        <RotateCcw aria-hidden="true" className={enCours ? "hidden" : "size-5"} />
        <span>{enCours ? "Restauration…" : "Restaurer"}</span>
      </Bouton>
      <button type="button" onClick={() => setEnCours(false)}>
        Fin
      </button>
    </div>
  );
}

// Bouton qui devient désactivé avec une raison, suivi d'un texte nu de l'appelant.
function BoutonAvecRaison() {
  const [desactive, setDesactive] = useState(false);
  return (
    <div>
      {desactive ? (
        <Bouton desactive raison="Choisis une taille.">
          Ajouter
        </Bouton>
      ) : (
        <Bouton onClick={() => setDesactive(true)}>Ajouter</Bouton>
      )}
      Texte de l’appelant
    </div>
  );
}

const erreurs: unknown[] = [];
const surErreur = (e: ErrorEvent) => erreurs.push(e.error ?? e.message);
const surRejet = (e: PromiseRejectionEvent) => erreurs.push(e.reason);
let consoleErreur: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  erreurs.length = 0;
  window.addEventListener("error", surErreur);
  window.addEventListener("unhandledrejection", surRejet);
  consoleErreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  window.removeEventListener("error", surErreur);
  window.removeEventListener("unhandledrejection", surRejet);
  vi.restoreAllMocks();
});

function indicateurDe(bouton: HTMLElement) {
  const indicateur = bouton.querySelector("[data-indicateur-en-cours]");
  expect(indicateur).not.toBeNull();
  return indicateur as HTMLElement;
}

describe("Bouton et traduction automatique du navigateur", () => {
  it("libellé traduit : le clic ne plante pas, l'indicateur s'affiche, le libellé change, puis tout revient au repos", async () => {
    const u = userEvent.setup();
    rendre(<BoutonEnvoi />);
    const bouton = screen.getByRole("button", { name: "Recevoir un code" });
    expect(traduireCommeLeNavigateur(bouton)).toBeGreaterThan(0);
    expect(bouton.querySelector("font")).not.toBeNull();

    await u.click(bouton);

    await waitFor(() => expect(bouton.getAttribute("aria-busy")).toBe("true"));
    expect(bouton.isConnected).toBe(true);
    const indicateur = indicateurDe(bouton);
    expect(indicateur.classList.contains("animate-spin")).toBe(true);
    expect(indicateur.classList.contains("hidden")).toBe(false);
    expect(indicateur.getAttribute("aria-hidden")).toBe("true");
    // Le libellé affiché est le nouveau, pas l'ancien texte traduit resté figé.
    expect(bouton.textContent).toContain("Envoi en cours…");

    // Retour au repos sur un libellé de nouveau traduit.
    traduireCommeLeNavigateur(bouton);
    await u.click(screen.getByRole("button", { name: "Fin" }));
    await waitFor(() => expect(bouton.getAttribute("aria-busy")).toBeNull());
    expect(indicateurDe(bouton).classList.contains("hidden")).toBe(true);
    expect(bouton.textContent).toContain("Recevoir un code");

    expect(erreurs).toEqual([]);
    expect(consoleErreur).not.toHaveBeenCalled();
  });

  it("icône et libellé (boutons « Restaurer » de l'admin) : aller-retour sans plantage après traduction", async () => {
    const u = userEvent.setup();
    rendre(<BoutonRestaurer />);
    const bouton = screen.getByRole("button", { name: "Restaurer" });
    traduireCommeLeNavigateur(bouton);
    await u.click(bouton);
    await waitFor(() => expect(bouton.getAttribute("aria-busy")).toBe("true"));
    traduireCommeLeNavigateur(bouton);
    await u.click(screen.getByRole("button", { name: "Fin" }));
    await waitFor(() => expect(bouton.getAttribute("aria-busy")).toBeNull());
    expect(bouton.querySelector("svg")?.classList.contains("hidden")).toBe(false);
    expect(erreurs).toEqual([]);
    expect(consoleErreur).not.toHaveBeenCalled();
  });

  it("passage à désactivé avec raison, à côté d'un texte traduit de l'appelant : sans plantage, raison affichée", async () => {
    const { container } = rendre(<BoutonAvecRaison />);
    traduireCommeLeNavigateur(container as HTMLElement);
    await userEvent.setup().click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true"));
    expect(screen.getByText("Choisis une taille.")).toBeTruthy();
    expect(erreurs).toEqual([]);
    expect(consoleErreur).not.toHaveBeenCalled();
  });

  it("hors « en cours » : l'indicateur reste dans le DOM, masqué et caché aux technologies d'assistance", () => {
    rendre(<Bouton>Payer</Bouton>);
    const bouton = screen.getByRole("button", { name: "Payer" });
    const indicateur = indicateurDe(bouton);
    expect(indicateur.classList.contains("hidden")).toBe(true);
    expect(indicateur.getAttribute("aria-hidden")).toBe("true");
  });
});
