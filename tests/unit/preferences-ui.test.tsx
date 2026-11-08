// @vitest-environment jsdom
// Story 9.4 : interrupteurs de « Préférences » ; « Actif » / « Désactivé » seulement après la réponse réelle du serveur.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ regler: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/preferences/actions", () => ({ reglerPreferenceAction: (...a: unknown[]) => faux.regler(...a) }));

import { InterrupteursPreferences } from "@/components/compte/InterrupteursPreferences";

const P = fr.Preferences;
const initiales = { relances: true, nouveautes: false, alertesFestival: false, mineurBloque: false };

beforeEach(() => vi.clearAllMocks());

describe("InterrupteursPreferences", () => {
  it("trois interrupteurs nommés, avec leur état écrit en mots", () => {
    rendre(<InterrupteursPreferences initiales={initiales} />);
    const relances = screen.getByRole("switch", { name: P.relances.nom });
    expect(relances.getAttribute("aria-checked")).toBe("true");
    expect(relances.textContent).toContain(P.actif);
    expect(screen.getByRole("switch", { name: P.nouveautes.nom }).textContent).toContain(P.desactive);
    expect(screen.getByRole("switch", { name: P.alertes.nom }).getAttribute("aria-checked")).toBe("false");
  });

  it("l'état change seulement après la réponse du serveur, et c'est celui qu'il renvoie", async () => {
    let terminer: (v: { ok: true; actif: boolean }) => void = () => undefined;
    faux.regler.mockReturnValue(new Promise((r) => (terminer = r)));
    rendre(<InterrupteursPreferences initiales={initiales} />);
    const nouveautes = screen.getByRole("switch", { name: P.nouveautes.nom });
    await userEvent.click(nouveautes);
    expect(faux.regler).toHaveBeenCalledWith({ objet: "nouveautes", actif: true });
    expect(nouveautes.getAttribute("aria-checked")).toBe("false");
    expect(nouveautes.textContent).toContain(P.enregistrement);
    terminer({ ok: true, actif: true });
    await waitFor(() => expect(nouveautes.getAttribute("aria-checked")).toBe("true"));
    expect(nouveautes.textContent).toContain(P.actif);
  });

  it("échec : l'état précédent reste et le message le dit", async () => {
    faux.regler.mockResolvedValue({ ok: false, erreur: "erreur" });
    rendre(<InterrupteursPreferences initiales={initiales} />);
    const relances = screen.getByRole("switch", { name: P.relances.nom });
    await userEvent.click(relances);
    expect(await screen.findByText(P.erreur)).toBeTruthy();
    expect(relances.getAttribute("aria-checked")).toBe("true");
  });

  it("au clavier, le focus reste sur l'interrupteur pendant l'enregistrement (aria-disabled, jamais disabled)", async () => {
    let terminer: (v: { ok: true; actif: boolean }) => void = () => undefined;
    faux.regler.mockReturnValue(new Promise((r) => (terminer = r)));
    rendre(<InterrupteursPreferences initiales={initiales} />);
    const alertes = screen.getByRole("switch", { name: P.alertes.nom });
    alertes.focus();
    await userEvent.keyboard("{Enter}");
    expect(alertes.getAttribute("aria-disabled")).toBe("true");
    expect(alertes.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(alertes);
    await userEvent.keyboard("{Enter}");
    expect(faux.regler).toHaveBeenCalledTimes(1);
    terminer({ ok: true, actif: true });
    await waitFor(() => expect(alertes.getAttribute("aria-checked")).toBe("true"));
  });

  it("session expirée : message dédié", async () => {
    faux.regler.mockResolvedValue({ ok: false, erreur: "non_connecte" });
    rendre(<InterrupteursPreferences initiales={initiales} />);
    await userEvent.click(screen.getByRole("switch", { name: P.relances.nom }));
    expect(await screen.findByText(P.erreurSession)).toBeTruthy();
  });

  it("textes FR et EN en parité ; la case de consentement est le texte fourni par Jonathan", () => {
    const cles = (o: unknown, p = ""): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "object" && v !== null ? cles(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(cles(en.Preferences).sort()).toEqual(cles(fr.Preferences).sort());
    expect(cles(en.Desinscription).sort()).toEqual(cles(fr.Desinscription).sort());
    expect(fr.Consentement.emails).toBe("Recevoir par email les nouveautés de mes univers et les rappels utiles. Tu peux te désabonner à tout moment.");
    expect(en.Consentement.emails).toBe("Email me new arrivals from my universes and helpful reminders. You can unsubscribe at any time.");
  });
});
