// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonSecondaire } from "@/components/ui/BoutonSecondaire";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { MotifManga } from "@/components/ui/MotifManga";
import { Squelette } from "@/components/ui/Squelette";
import { ID_RACINE_PAGE } from "@/components/layout/constantes";
import { rendre } from "./aides-dom";

describe("Bouton", () => {
  it("bouton principal : fond rouge, texte blanc, cible de 44 px", () => {
    rendre(<Bouton>Payer</Bouton>);
    const b = screen.getByRole("button", { name: "Payer" });
    expect(b.className).toContain("bg-primary");
    expect(b.className).toContain("text-on-primary");
    expect(b.className).toContain("min-h-touch");
    expect((b).getAttribute("type")).toBe("button");
  });

  it("désactivé : focalisable, aria-disabled, raison reliée, clic ignoré, jamais d'opacité", async () => {
    const surClic = vi.fn();
    rendre(
      <Bouton desactive raison="Choisis une taille." onClick={surClic}>
        Ajouter
      </Bouton>,
    );
    const b = screen.getByRole("button", { name: "Ajouter" });
    expect((b).getAttribute("aria-disabled")).toBe("true");
    expect((b as HTMLButtonElement).disabled).toBe(false);
    expect(b.className).not.toMatch(/opacity/);
    expect(b.className).toContain("bg-surface");
    expect(b.className).toContain("border-border-field");
    expect(b.className).toContain("text-text-secondary");
    expect(b.getAttribute("aria-describedby")).toBeTruthy();
    expect((screen.getByText("Choisis une taille.")).getAttribute("id")).toBe(b.getAttribute("aria-describedby")!);
    await userEvent.setup().click(b);
    expect(surClic).not.toHaveBeenCalled();
    b.focus();
    expect(document.activeElement).toBe(b);
  });

  it("en cours : clic bloqué (pas de double soumission), aria-busy et aria-disabled", async () => {
    const surClic = vi.fn();
    rendre(
      <Bouton enCours onClick={surClic}>
        Paiement…
      </Bouton>,
    );
    const b = screen.getByRole("button", { name: "Paiement…" });
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.getAttribute("aria-disabled")).toBe("true");
    await userEvent.setup().click(b);
    expect(surClic).not.toHaveBeenCalled();
  });

  it("avec href : lien qui transmet onClick et aria-*, sans clic quand désactivé", async () => {
    const surClic = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    rendre(
      <Bouton href="/kits" onClick={surClic} aria-label="Voir les kits">
        Kits
      </Bouton>,
    );
    const lien = screen.getByRole("link", { name: "Voir les kits" });
    expect(lien.getAttribute("href")).toBe("/fr/kits");
    await userEvent.setup().click(lien);
    expect(surClic).toHaveBeenCalledTimes(1);
  });

  it("avec href et en cours : plus de lien, bouton bloqué", () => {
    rendre(
      <Bouton href="/kits" enCours>
        Kits
      </Bouton>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Kits" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("le bouton secondaire est une pilule surface à contour de contrôle", () => {
    rendre(<BoutonSecondaire>Annuler</BoutonSecondaire>);
    const b = screen.getByRole("button", { name: "Annuler" });
    expect(b.className).toContain("bg-surface");
    expect(b.className).toContain("border-border-field");
    expect(b.className).not.toContain("bg-primary");
  });
});

function Exemple() {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div id={ID_RACINE_PAGE}>
      <button ref={ref} type="button" onClick={() => setOuvert(true)}>
        Ouvrir
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Confirmation" retourFocus={ref}>
        <button type="button">Confirmer</button>
      </Dialogue>
    </div>
  );
}

describe("Dialogue", () => {
  it("s'ouvre en dialogue modal, focus au premier élément, page inert", async () => {
    const user = userEvent.setup();
    rendre(<Exemple />);
    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    const d = screen.getByRole("dialog", { name: "Confirmation" });
    expect((d).getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fermer" }));
    expect(document.getElementById(ID_RACINE_PAGE)?.hasAttribute("inert")).toBe(true);
  });

  it("piège le focus : Tab depuis le dernier élément revient au premier", async () => {
    const user = userEvent.setup();
    rendre(<Exemple />);
    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Confirmer" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fermer" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Confirmer" }));
  });

  it("Échap ferme, retire inert et rend le focus au bouton d'origine", async () => {
    const user = userEvent.setup();
    rendre(<Exemple />);
    const ouvrir = screen.getByRole("button", { name: "Ouvrir" });
    await user.click(ouvrir);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.getElementById(ID_RACINE_PAGE)?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(ouvrir);
  });

  it("« Fermer » ferme aussi", async () => {
    const user = userEvent.setup();
    rendre(<Exemple />);
    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function DeuxDialogues({ surFermerB }: { surFermerB: () => void }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <div id={ID_RACINE_PAGE}>
      <button type="button" onClick={() => setB(true)}>
        OuvrirB
      </button>
      <Dialogue ouvert={a} onFermer={() => setA(false)} titre="A">
        <p>a</p>
      </Dialogue>
      <Dialogue
        ouvert={b}
        onFermer={() => {
          surFermerB();
          setB(false);
        }}
        titre="B"
      >
        <p>b</p>
      </Dialogue>
    </div>
  );
}

describe("Dialogues empilés (UX-DR15)", () => {
  it("un second dialogue ne s'empile pas : il se referme, puis peut s'ouvrir quand le premier est fermé", async () => {
    const surFermerB = vi.fn();
    const { container } = rendre(<DeuxDialogues surFermerB={surFermerB} />);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    // La page est inert : on déclenche l'ouverture de B directement.
    const ouvrirB = container.querySelector("button") as HTMLButtonElement;
    ouvrirB.click();
    await screen.findByRole("dialog", { name: "A" });
    await vi.waitFor(() => expect(surFermerB).toHaveBeenCalled());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "A" })).toBeTruthy();
    // Fermeture de A, puis B peut s'ouvrir.
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    ouvrirB.click();
    await screen.findByRole("dialog", { name: "B" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});

describe("Squelette, MessageEtat, MotifManga", () => {
  it("squelette : région aria-busy avec « Chargement… » masqué", () => {
    const { container } = rendre(<Squelette />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText("Chargement…").className).toContain("sr-only");
  });

  it("message d'état : erreur en alerte, le reste en statut, jamais la couleur seule", () => {
    rendre(
      <>
        <MessageEtat type="erreur">Échec.</MessageEtat>
        <MessageEtat type="succes">Fait.</MessageEtat>
      </>,
    );
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("Échec.");
    expect(alerte.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Fait.");
  });

  it("motif manga : décoratif, caché des technologies d'assistance", () => {
    const { container } = rendre(<MotifManga variante="traits" />);
    const motif = container.querySelector(".motif-manga");
    expect(motif?.getAttribute("aria-hidden")).toBe("true");
    expect(motif?.className).toContain("motif-traits");
  });
});
