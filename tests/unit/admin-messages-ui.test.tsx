// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ marquer: vi.fn(), refresh: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/admin/actions", () => ({ marquerMessageTraite: (...a: unknown[]) => faux.marquer(...a) }));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: faux.refresh }) }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return {
    getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages, namespace: namespace as never }),
    getFormatter: async () => ({ dateTime: () => "TEST_date" }),
  };
});

import { BoutonMarquerTraite } from "@/components/admin/BoutonMarquerTraite";
import { ListeMessages } from "@/components/admin/ListeMessages";

const ID = "00000000-0000-4000-8000-0000000000bb";

beforeEach(() => vi.clearAllMocks());

describe("ListeMessages", () => {
  it("état vide", async () => {
    rendre(await ListeMessages({ messages: [] }));
    expect(screen.getByText("Aucun nouveau message.")).toBeTruthy();
  });

  it("un message : nom, lien mailto, date, texte et bouton", async () => {
    rendre(await ListeMessages({ messages: [{ id: ID, nom: "TEST_Awa", email: "TEST_awa@example.invalid", message: "TEST_texte du message", langue: "fr", creeLe: "2026-10-22T10:00:00Z" }] }));
    expect(screen.getByRole("heading", { name: "TEST_Awa" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "TEST_awa@example.invalid" }).getAttribute("href")).toBe("mailto:TEST_awa@example.invalid");
    expect(screen.getByText("TEST_texte du message")).toBeTruthy();
    expect(screen.getByText("Reçu le TEST_date")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marquer comme traité" })).toBeTruthy();
  });
});

describe("BoutonMarquerTraite", () => {
  async function cliquer() {
    const user = userEvent.setup();
    rendre(<BoutonMarquerTraite id={ID} />);
    await user.click(screen.getByRole("button", { name: "Marquer comme traité" }));
  }

  it("succès : message affiché après la réponse, liste relue", async () => {
    faux.marquer.mockResolvedValue({ statut: "succes", id: ID });
    await cliquer();
    expect(await screen.findByText("Message marqué comme traité.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalledTimes(1);
  });

  it("pas de succès avant la réponse", async () => {
    let repondre: (v: unknown) => void = () => {};
    faux.marquer.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    await cliquer();
    expect(await screen.findByRole("button", { name: "Enregistrement…" })).toBeTruthy();
    expect(screen.queryByText("Message marqué comme traité.")).toBeNull();
    expect(faux.refresh).not.toHaveBeenCalled();
    // Libère l'action en attente pour ne rien laisser traîner entre les tests.
    await act(async () => repondre({ statut: "erreur", id: ID, erreur: "generique" }));
  });

  it.each([
    ["non_autorise", /plus le droit de traiter/, false],
    ["message_introuvable", /déjà traité ou n'existe plus/, true],
    ["generique", /n'a pas pu être marqué comme traité/, false],
    ["suppression_echouee", /n'a pas pu être marqué comme traité/, false],
  ])("erreur %s : bon message, aucun succès, refresh seulement si introuvable", async (erreur, texte, refresh) => {
    faux.marquer.mockResolvedValue({ statut: "erreur", id: ID, erreur });
    await cliquer();
    expect(await screen.findByText(texte)).toBeTruthy();
    expect(screen.queryByText("Message marqué comme traité.")).toBeNull();
    expect(faux.refresh).toHaveBeenCalledTimes(refresh ? 1 : 0);
  });
});
