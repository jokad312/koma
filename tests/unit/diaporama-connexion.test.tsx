// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const reste = Object.fromEntries(Object.entries(props).filter(([cle]) => !["src", "alt", "fill", "sizes"].includes(cle)));
    // eslint-disable-next-line @next/next/no-img-element -- substitut de test de next/image
    return <img src={props.src as string} alt={props.alt as string} {...reste} />;
  },
}));

import { DiaporamaConnexion } from "../../src/app/[locale]/connexion/DiaporamaConnexion";

const IMAGES = ["/images/connexion/1-illustration.webp", "/images/connexion/2-illustration.webp", "/images/connexion/3-illustration.webp"];

// « Réduire les animations » selon le test ; panneau visible (largeur d'ordinateur), sauf avec panneauMasque.
function mouvementReduit(reduit: boolean, panneauMasque = false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (requete: string) => ({
      matches: requete.includes("reduced-motion") ? reduit : !panneauMasque,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}
const visible = (container: HTMLElement) => container.querySelector("[data-visible]")?.getAttribute("data-diapo");

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("diaporama de la connexion (9.17)", () => {
  it("fondu toutes les 3 s, dans l'ordre, puis retour à la première ; seule l'image visible a le texte alternatif « Illustration »", () => {
    mouvementReduit(false);
    const { container } = rendre(<DiaporamaConnexion images={IMAGES} />);
    expect(visible(container)).toBe("0");
    expect(screen.getAllByRole("img", { name: "Illustration" })).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(3000));
    expect(visible(container)).toBe("1");
    act(() => void vi.advanceTimersByTime(3000));
    expect(visible(container)).toBe("2");
    act(() => void vi.advanceTimersByTime(3000));
    expect(visible(container)).toBe("0");
    // Transition d'opacité (fondu), coupée si l'utilisateur réduit les animations.
    expect(container.querySelector("[data-visible]")?.className).toMatch(/transition-opacity.*motion-reduce:transition-none/);
  });

  it("« réduire les animations » : première image fixe, aucun bouton Pause", () => {
    mouvementReduit(true);
    const { container } = rendre(<DiaporamaConnexion images={IMAGES} />);
    act(() => void vi.advanceTimersByTime(9000));
    expect(visible(container)).toBe("0");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("panneau masqué (sous 768 px) : aucun défilement", () => {
    mouvementReduit(false, true);
    const { container } = rendre(<DiaporamaConnexion images={IMAGES} />);
    act(() => void vi.advanceTimersByTime(9000));
    expect(visible(container)).toBe("0");
  });

  it("Pause arrête le défilement, Lecture le reprend (contenu qui bouge : WCAG 2.2.2)", async () => {
    mouvementReduit(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = rendre(<DiaporamaConnexion images={IMAGES} />);
    const bouton = screen.getByRole("button", { name: "Mettre en pause le défilement des images" });
    expect(bouton.getAttribute("aria-pressed")).toBe("false");
    await user.click(bouton);
    expect(bouton.getAttribute("aria-pressed")).toBe("true");
    act(() => void vi.advanceTimersByTime(9000));
    expect(visible(container)).toBe("0");
    await user.click(within(container).getByRole("button", { name: "Mettre en pause le défilement des images" }));
    act(() => void vi.advanceTimersByTime(3000));
    expect(visible(container)).toBe("1");
  });
});
