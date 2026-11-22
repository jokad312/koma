// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptTheme } from "@/components/layout/ScriptTheme";
import { installerGardeTraduction, SCRIPT_GARDE_TRADUCTION } from "@/lib/dom/garde-traduction";
import { SCRIPT_TETE } from "@/lib/theme/script";
import { rendre, traduireCommeLeNavigateur } from "./aides-dom";

// Bug A3 (2026-11-22) : après la traduction automatique du navigateur, React retire ou insère un nœud à côté d'un texte remplacé
// par des <font> : « NotFoundError » sur removeChild / insertBefore, page blanche. La garde ne tolère que ce cas.

const originaux = {
  removeChild: Node.prototype.removeChild,
  insertBefore: Node.prototype.insertBefore,
  appendChild: Node.prototype.appendChild,
};

const erreurs: unknown[] = [];
const surErreur = (e: ErrorEvent) => {
  erreurs.push(e.error ?? e.message);
  e.preventDefault();
};
let avertissement: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  erreurs.length = 0;
  window.addEventListener("error", surErreur);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  avertissement = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
function restaurerOriginaux() {
  Node.prototype.removeChild = originaux.removeChild;
  Node.prototype.insertBefore = originaux.insertBefore;
  Node.prototype.appendChild = originaux.appendChild;
}

afterEach(() => {
  window.removeEventListener("error", surErreur);
  vi.restoreAllMocks();
  restaurerOriginaux();
});

function gardeInstallee() {
  return (Node.prototype.removeChild as unknown as { gardeTraduction?: boolean }).gardeTraduction === true;
}

function avertissementsDom() {
  return avertissement.mock.calls.filter((appel: unknown[]) => String(appel[0]).startsWith("[dom]"));
}

// Plusieurs enfants texte dans un même élément ; le clic en retire un.
function TexteRetire() {
  const [complet, setComplet] = useState(true);
  return (
    <div>
      <p data-testid="texte">
        {"Envoyer à "}
        {complet ? " — " : null}
        {complet ? "client@example.test" : null}
      </p>
      <button type="button" onClick={() => setComplet(false)}>
        Retirer
      </button>
    </div>
  );
}

// Un nœud inséré devant un texte (forme de l'ancien Bouton, avant d879ee1).
function InsertionDevant() {
  const [enCours, setEnCours] = useState(false);
  return (
    <div>
      <p data-testid="texte">
        {enCours ? <span data-testid="indicateur" /> : null}
        {"Recevoir un code"}
      </p>
      <button type="button" onClick={() => setEnCours(true)}>
        Insérer
      </button>
    </div>
  );
}

function cliquerApresTraduction(nomBouton: string) {
  traduireCommeLeNavigateur(screen.getByTestId("texte"));
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: nomBouton }));
  });
}

// act() regroupe les erreurs du rendu dans une AggregateError ; les DOMException de jsdom ne sont pas des Error de ce contexte.
function estNotFound(e: unknown): boolean {
  if (e instanceof AggregateError) return e.errors.some(estNotFound);
  return typeof e === "object" && e !== null && (e as { name?: unknown }).name === "NotFoundError";
}

describe("sans la garde : le plantage est reproduit", () => {
  it("texte retiré après traduction : NotFoundError", () => {
    rendre(<TexteRetire />);
    let levee: unknown;
    try {
      cliquerApresTraduction("Retirer");
    } catch (e) {
      levee = e;
    }
    expect([levee, ...erreurs].some(estNotFound)).toBe(true);
    // Page blanche : React a démonté l'arbre.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("insertion devant un texte remplacé : NotFoundError", () => {
    rendre(<InsertionDevant />);
    let levee: unknown;
    try {
      cliquerApresTraduction("Insérer");
    } catch (e) {
      levee = e;
    }
    expect([levee, ...erreurs].some(estNotFound)).toBe(true);
  });
});

describe("avec la garde", () => {
  it("texte retiré après traduction : aucune exception, l'application continue, un journal [dom] removeChild", () => {
    installerGardeTraduction(true);
    rendre(<TexteRetire />);
    expect(() => cliquerApresTraduction("Retirer")).not.toThrow();
    expect(erreurs).toEqual([]);
    expect(screen.getByRole("button", { name: "Retirer" }).isConnected).toBe(true);
    // Limite connue : les <font> du traducteur ne sont pas retirés ; le texte retiré reste affiché (traduit) jusqu'au prochain rendu.
    expect(screen.getByTestId("texte").textContent).toContain("[traduit] client@example.test");
    const journaux = avertissementsDom();
    expect(journaux.length).toBeGreaterThan(0);
    for (const appel of journaux) expect(appel).toEqual(["[dom] nœud déplacé par une traduction ou une extension :", "removeChild", "p"]);
  });

  it("insertion devant un texte remplacé : nœud inséré en fin de parent, aucune exception, un journal [dom] insertBefore", () => {
    installerGardeTraduction(true);
    rendre(<InsertionDevant />);
    expect(() => cliquerApresTraduction("Insérer")).not.toThrow();
    expect(erreurs).toEqual([]);
    const parent = screen.getByTestId("texte");
    expect(parent.lastChild).toBe(screen.getByTestId("indicateur"));
    expect(avertissementsDom()).toEqual([["[dom] nœud déplacé par une traduction ou une extension :", "insertBefore", "p"]]);
  });

  it("journaliser faux (production) : mêmes cas rattrapés, aucun journal", () => {
    installerGardeTraduction(false);
    rendre(<TexteRetire />);
    expect(() => cliquerApresTraduction("Retirer")).not.toThrow();
    expect(erreurs).toEqual([]);
    expect(avertissement).not.toHaveBeenCalled();
  });

  it("le journal ne contient ni le texte de la page ni l'adresse email", () => {
    installerGardeTraduction(true);
    rendre(<TexteRetire />);
    cliquerApresTraduction("Retirer");
    const contenu = JSON.stringify(avertissement.mock.calls);
    expect(contenu).not.toContain("client@example.test");
    expect(contenu).not.toContain("Envoyer");
  });
});

// Chaque opération construit son propre DOM et renvoie ce qu'elle observe : valeur renvoyée, erreur et DOM final.
type Observation = { resultat: string; erreur: string | null; dom: string };
const operations: Record<string, () => Observation> = {
  "retrait d'un enfant": () => {
    const p = document.createElement("p");
    const a = p.appendChild(document.createTextNode("a"));
    p.appendChild(document.createTextNode("b"));
    return observer(p, () => (p.removeChild(a) === a ? "enfant renvoyé" : "autre"));
  },
  "insertion devant un enfant": () => {
    const p = document.createElement("p");
    const ref = p.appendChild(document.createElement("b"));
    const n = document.createElement("i");
    return observer(p, () => (p.insertBefore(n, ref) === n ? "nœud renvoyé" : "autre"));
  },
  "insertion en fin (référence null)": () => {
    const p = document.createElement("p");
    p.appendChild(document.createElement("b"));
    const n = document.createElement("i");
    return observer(p, () => (p.insertBefore(n, null) === n ? "nœud renvoyé" : "autre"));
  },
  "removeChild(null)": () => {
    const p = document.createElement("p");
    return observer(p, () => String(p.removeChild(null as unknown as Node)));
  },
  "ancêtre inséré dans un descendant": () => {
    const p = document.createElement("p");
    const enfant = p.appendChild(document.createElement("span"));
    const ref = enfant.appendChild(document.createElement("b"));
    return observer(p, () => String(enfant.insertBefore(p, ref)));
  },
  "ancêtre ajouté en fin d'un descendant": () => {
    const p = document.createElement("p");
    const enfant = p.appendChild(document.createElement("span"));
    return observer(p, () => String(enfant.insertBefore(p, null)));
  },
};

function observer(racine: Element, action: () => string): Observation {
  let resultat = "";
  let erreur: string | null = null;
  try {
    resultat = action();
  } catch (e) {
    erreur = `${(e as Error).constructor.name}:${(e as Error).name}`;
  }
  return { resultat, erreur, dom: racine.outerHTML };
}

describe("sans traduction : comportement strictement inchangé", () => {
  for (const [nom, operation] of Object.entries(operations)) {
    it(`${nom} : même résultat, même erreur, même DOM, aucun journal`, () => {
      const avant = operation();
      installerGardeTraduction(true);
      const apres = operation();
      expect(apres).toEqual(avant);
      expect(avertissement).not.toHaveBeenCalled();
    });
  }

  it("les erreurs natives restent levées (removeChild(null), ancêtre dans un descendant)", () => {
    installerGardeTraduction(true);
    expect(operations["removeChild(null)"]().erreur).toMatch(/^TypeError/);
    expect(operations["ancêtre inséré dans un descendant"]().erreur).toMatch(/HierarchyRequestError$/);
  });

  it("rendu React normal, sans traduction : aucun journal", () => {
    installerGardeTraduction(true);
    rendre(<TexteRetire />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
    });
    expect(screen.getByTestId("texte").textContent).toBe("Envoyer à ");
    expect(avertissement).not.toHaveBeenCalled();
  });
});

describe("installation", () => {
  it("double installation (script de <head> puis effet client) : une seule enveloppe", () => {
    new Function(SCRIPT_GARDE_TRADUCTION)();
    const retirer = Node.prototype.removeChild;
    const inserer = Node.prototype.insertBefore;
    expect(retirer).not.toBe(originaux.removeChild);
    expect(inserer).not.toBe(originaux.insertBefore);
    installerGardeTraduction(true);
    installerGardeTraduction(false);
    expect(Node.prototype.removeChild).toBe(retirer);
    expect(Node.prototype.insertBefore).toBe(inserer);
  });

  it("le script complet de <head> installe la garde (journal hors production) et reste sans erreur", () => {
    expect(() => new Function(SCRIPT_TETE)()).not.toThrow();
    const p = document.createElement("p");
    const etranger = document.createElement("b");
    expect(p.removeChild(etranger)).toBe(etranger);
    expect(avertissementsDom()).toEqual([["[dom] nœud déplacé par une traduction ou une extension :", "removeChild", "p"]]);
  });

  it("rendu purement client : l'effet de ScriptTheme installe la garde", () => {
    expect(gardeInstallee()).toBe(false);
    const { container } = rendre(<ScriptTheme />);
    // Rendu client : aucun <script> n'est créé, seul l'effet agit.
    expect(container.querySelector("script")).toBeNull();
    expect(gardeInstallee()).toBe(true);
  });

  it("nœud d'une autre fenêtre (iframe) : reconnu, le cas est rattrapé", () => {
    installerGardeTraduction(false);
    const cadre = document.body.appendChild(document.createElement("iframe"));
    const etranger = cadre.contentDocument!.createElement("b");
    expect(etranger instanceof Node).toBe(false);
    const p = document.createElement("p");
    expect(p.removeChild(etranger)).toBe(etranger);
    cadre.remove();
  });

  it("installer puis restaurer : les originaux reviennent", () => {
    installerGardeTraduction(true);
    expect(gardeInstallee()).toBe(true);
    expect(Node.prototype.removeChild).not.toBe(originaux.removeChild);
    expect(Node.prototype.insertBefore).not.toBe(originaux.insertBefore);
    restaurerOriginaux();
    expect(gardeInstallee()).toBe(false);
    expect(Node.prototype.removeChild).toBe(originaux.removeChild);
    expect(Node.prototype.insertBefore).toBe(originaux.insertBefore);
  });
});
