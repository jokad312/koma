// @vitest-environment jsdom
// Story 8.2 : tâche « Photos » : compteurs réels lus en base ; réponse illisible = message d'erreur, jamais un faux zéro.
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return { getTranslations: async (ns: string) => createTranslator({ locale: "fr", messages, namespace: ns as never }) };
});
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc }) }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import { TachePhotos } from "@/components/admin/TachePhotos";

const P = fr.Admin.taches.photos;
async function afficher() {
  render(<NextIntlClientProvider locale="fr" messages={fr}>{await TachePhotos()}</NextIntlClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("TachePhotos", () => {
  it("les trois compteurs viennent de la base, chacun à sa place", async () => {
    faux.rpc.mockResolvedValue({ data: { a_valider: 3, realisations: 2, retraits: 1 }, error: null });
    await afficher();
    expect(faux.rpc).toHaveBeenCalledWith("compter_photos_a_traiter");
    expect(screen.getByText(P.aValider.replace("{nombre}", "3"))).toBeTruthy();
    expect(screen.getByText(P.realisations.replace("{nombre}", "2"))).toBeTruthy();
    expect(screen.getByText(P.retraits.replace("{nombre}", "1"))).toBeTruthy();
  });

  it("erreur ou réponse sans les deux nombres : message d'erreur, aucun zéro", async () => {
    for (const reponse of [{ data: null, error: { message: "TEST" } }, { data: { a_valider: 2 }, error: null }]) {
      faux.rpc.mockResolvedValueOnce(reponse);
      const { unmount } = render(<NextIntlClientProvider locale="fr" messages={fr}>{await TachePhotos()}</NextIntlClientProvider>);
      expect(screen.getByText(P.erreurLecture)).toBeTruthy();
      expect(screen.queryByText(P.aValider.replace("{nombre}", "0"))).toBeNull();
      unmount();
    }
  });
});
