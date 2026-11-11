// @vitest-environment jsdom
// Story 7.8 : côté Admin. « Libérer le Verrou » (avec confirmation, résultat réel du serveur seulement) sur la page de l'Événement, et les anomalies
// « scans_non_synchronises » et « scan_conflit » lisibles dans les tâches admin (FR et EN).
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ forcer: vi.fn(), rafraichir: vi.fn() }));
vi.mock("@/modules/scan/hors-ligne-actions", () => ({ forcerLiberationVerrouAction: faux.forcer }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: faux.rafraichir }) }));
vi.mock("next-intl/server", async () => {
  const intl = await import("next-intl");
  const creer = (messages: Record<string, unknown>) => (ns: string) => intl.createTranslator({ locale: "fr", messages, namespace: ns as never });
  return {
    getTranslations: async (ns: string) => creer(fr as Record<string, unknown>)(ns),
    getFormatter: async () => intl.createFormatter({ locale: "fr", timeZone: "UTC" }),
  };
});

import { ListeTaches } from "@/components/admin/ListeTaches";
import { SectionVerrou } from "@/components/admin/SectionVerrou";

const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const VERROU = { id: "00000000-0000-4000-8000-0000000000f1", email: "test-benevole@example.invalid", prisLe: "2027-01-09T08:00:00.000Z", expireLe: "2027-01-10T22:00:00.000Z", listeTelechargee: true, echu: false };

beforeEach(() => {
  faux.forcer.mockReset();
  faux.rafraichir.mockReset();
});

describe("section « Scan hors ligne » de l'Événement", () => {
  it("sans Verrou : le dit, aucun bouton de libération", () => {
    rendre(<SectionVerrou evenementId={EVENEMENT} verrou={null} />);
    expect(screen.getByText("Aucun appareil ne tient le Verrou hors ligne.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Libérer le Verrou" })).toBeNull();
  });

  it("avec un Verrou : le Compte qui le tient, jamais l'identifiant d'appareil ; la libération demande une confirmation puis attend la réponse du serveur", async () => {
    faux.forcer.mockResolvedValue({ ok: true, statut: "force" });
    const { container } = rendre(<SectionVerrou evenementId={EVENEMENT} verrou={VERROU} />);
    expect(container.textContent).toContain("test-benevole@example.invalid");
    expect(container.textContent).toContain("La liste des pass a été téléchargée");
    await userEvent.click(screen.getByRole("button", { name: "Libérer le Verrou" }));
    expect(faux.forcer).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la libération" }));
    expect(faux.forcer).toHaveBeenCalledWith({ evenementId: EVENEMENT });
    expect(await screen.findByText(/Verrou libéré\. Une tâche signale/)).toBeTruthy();
    expect(faux.rafraichir).toHaveBeenCalled();
  });

  it("annuler la confirmation ne libère rien ; un refus du serveur n'affiche aucun succès", async () => {
    faux.forcer.mockResolvedValue({ ok: false, erreur: "non_autorise" });
    rendre(<SectionVerrou evenementId={EVENEMENT} verrou={VERROU} />);
    await userEvent.click(screen.getByRole("button", { name: "Libérer le Verrou" }));
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(faux.forcer).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Libérer le Verrou" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la libération" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Tu n'as pas le droit de libérer ce Verrou.");
    expect(screen.queryByText(/Verrou libéré\./)).toBeNull();
  });

  it("l'anglais est complet", () => {
    rendre(<SectionVerrou evenementId={EVENEMENT} verrou={VERROU} />, "en");
    expect(screen.getByRole("button", { name: "Release the lock" })).toBeTruthy();
  });
});

describe("tâches admin", () => {
  let n = 0;
  const tache = (type: string, details: object) => ({ id: `00000000-0000-4000-8000-00000000000${++n}`, type, gravite: "attention" as const, cibleType: "verrou", cibleId: VERROU.id, details, creeLe: "2027-01-10T20:00:00.000Z" });
  async function rendreTaches(taches: Parameters<typeof ListeTaches>[0]["taches"]) {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="fr" messages={fr}>
        {await ListeTaches({ taches })}
      </NextIntlClientProvider>,
    );
    return html;
  }
  it("scans_non_synchronises : titre, date de prise du Verrou et nombre de scans déjà synchronisés", async () => {
    const html = await rendreTaches([tache("scans_non_synchronises", { pris_le: "2027-01-09T08:00:00.000Z", scans_synchronises: 3 })]);
    expect(html).toContain("Scans hors ligne peut-être non synchronisés");
    expect(html).toContain("Verrou hors ligne libéré de force");
    expect(html).toContain("3 scans avaient été synchronisés");
    expect(html).toContain("vérifie à l&#x27;entrée de l&#x27;événement");
  });
  it("scan_conflit : le motif est écrit en clair", async () => {
    const html = await rendreTaches([tache("scan_conflit", { motif: "deja_scanne" }), tache("scan_conflit", { motif: "annule" })]);
    expect(html).toContain("Scan hors ligne en conflit");
    expect(html).toContain("le pass avait déjà été scanné");
    expect(html).toContain("le pass a été annulé");
  });
  it("un motif inconnu n'invente aucun texte", async () => {
    const html = await rendreTaches([tache("scan_conflit", { motif: "autre_chose" })]);
    expect(html).toContain("Scan hors ligne en conflit");
    expect(html).not.toContain("n&#x27;a pas pu être appliqué");
  });
  it("les clés FR et EN du Scan hors ligne sont identiques", () => {
    const cles = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => cles(v, p ? `${p}.${k}` : k)) : [p]);
    const sous = (m: Record<string, unknown>, chemin: string[]) => chemin.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m);
    for (const chemin of [["Scan"], ["Admin", "evenements", "verrou"], ["Admin", "taches"]]) {
      expect(cles(sous(en as Record<string, unknown>, chemin)).sort(), chemin.join(".")).toEqual(cles(sous(fr as Record<string, unknown>, chemin)).sort());
    }
  });
});
