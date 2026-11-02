// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => {
  const refresh = vi.fn();
  return { ajouter: vi.fn(), confirmer: vi.fn(), retirer: vi.fn(), refresh, routeur: { refresh } };
});
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => faux.routeur }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/paiement/actions", () => ({
  ajouterCoupleAction: (...a: unknown[]) => faux.ajouter(...a),
  confirmerCoupleAction: (...a: unknown[]) => faux.confirmer(...a),
  retirerCoupleAction: (...a: unknown[]) => faux.retirer(...a),
}));

import { CouvertureAgregateur } from "@/components/admin/CouvertureAgregateur";
import type { CoupleCouverture } from "@/modules/paiement/couverture";

const couples: CoupleCouverture[] = [
  { id: "00000000-0000-4000-8000-0000000000c1", prestataire: "pawapay", pays: "TZ", operateur: "TEST_a", source: "TEST document, page 4", etat: "a_verifier" },
  { id: "00000000-0000-4000-8000-0000000000c2", prestataire: "pawapay", pays: "KE", operateur: "TEST_b", source: "TEST contrat", etat: "confirme" },
];

beforeEach(() => {
  vi.clearAllMocks();
  faux.ajouter.mockResolvedValue({ ok: true });
  faux.confirmer.mockResolvedValue({ ok: true });
  faux.retirer.mockResolvedValue({ ok: true });
});

async function remplir(pays: string, operateur: string, source: string) {
  if (pays) await userEvent.type(screen.getByLabelText("Code du pays (2 lettres, norme ISO)"), pays);
  if (operateur) await userEvent.type(screen.getByLabelText("Opérateur"), operateur);
  if (source) await userEvent.type(screen.getByLabelText("Source (document ou contrat)"), source);
}

describe("CouvertureAgregateur", () => {
  it("liste les couples avec leur état en texte et leur source ; un couple à vérifier se confirme, un confirmé non", () => {
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={couples} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("À vérifier")).toBeTruthy();
    expect(within(items[0]).getByText("Source : TEST document, page 4")).toBeTruthy();
    expect(within(items[0]).getByRole("button", { name: /^Confirmer / })).toBeTruthy();
    expect(within(items[1]).getByText("Confirmé")).toBeTruthy();
    expect(within(items[1]).queryByRole("button", { name: /^Confirmer / })).toBeNull();
    expect(within(items[1]).getByRole("button", { name: /^Retirer / })).toBeTruthy();
  });
  it("aucun couple : message honnête, aucun pays ni opérateur affiché", () => {
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={[]} />);
    expect(screen.getByText(/Aucun couple pays-opérateur saisi/)).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
  it("confirmer et retirer appellent le serveur puis relisent la liste", async () => {
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={couples} />);
    await userEvent.click(screen.getByRole("button", { name: /^Confirmer / }));
    expect(faux.confirmer).toHaveBeenCalledWith(couples[0].id);
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
    await userEvent.click(screen.getAllByRole("button", { name: /^Retirer / })[1]);
    expect(faux.retirer).toHaveBeenCalledWith(couples[1].id);
  });
  it("ajoute un couple avec sa source, puis vide le formulaire", async () => {
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={[]} />);
    await remplir("tz", "TEST_op", "TEST source");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter à la couverture de TEST_PawaPay" }));
    expect(faux.ajouter).toHaveBeenCalledWith({ prestataire: "pawapay", pays: "tz", operateur: "TEST_op", source: "TEST source" });
    await waitFor(() => expect((screen.getByLabelText("Opérateur") as HTMLInputElement).value).toBe(""));
  });
  it("sans source : erreur reliée au champ Source (aria-invalid et aria-describedby), formulaire conservé", async () => {
    faux.ajouter.mockResolvedValue({ ok: false, erreur: "source_manquante" });
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={[]} />);
    await remplir("tz", "TEST_op", "");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter à la couverture de TEST_PawaPay" }));
    const champ = await screen.findByLabelText("Source (document ou contrat)");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    // L'erreur ET l'aide de la source sont reliées au champ, l'erreur d'abord.
    const [idErreur, idAide] = (champ.getAttribute("aria-describedby") ?? "").split(" ");
    expect(document.getElementById(idErreur)?.textContent).toBe("La source est obligatoire : indique le document ou le contrat.");
    expect(document.getElementById(idErreur)?.getAttribute("role")).toBe("alert");
    expect(document.getElementById(idAide)?.textContent).toContain("Elle est obligatoire");
    expect((screen.getByLabelText("Opérateur") as HTMLInputElement).value).toBe("TEST_op");
  });
  it("couple déjà saisi : erreur reliée au champ Opérateur", async () => {
    faux.ajouter.mockResolvedValue({ ok: false, erreur: "couple_existant" });
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={[]} />);
    await remplir("tz", "TEST_op", "TEST source");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter à la couverture de TEST_PawaPay" }));
    expect((await screen.findByLabelText("Opérateur")).getAttribute("aria-invalid")).toBe("true");
  });
  it("droit retiré : message général en alerte", async () => {
    faux.confirmer.mockResolvedValue({ ok: false, erreur: "non_autorise" });
    rendre(<CouvertureAgregateur prestataire="pawapay" nom="TEST_PawaPay" couples={couples} />);
    await userEvent.click(screen.getByRole("button", { name: /^Confirmer / }));
    expect((await screen.findByRole("alert")).textContent).toContain("Tu n'as plus le droit");
  });
});
