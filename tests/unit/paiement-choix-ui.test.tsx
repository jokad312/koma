// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => {
  const refresh = vi.fn();
  return { demarrer: vi.fn(), refresh, routeur: { refresh } };
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
vi.mock("@/modules/paiement/actions", () => ({ demarrerTentativeAction: (...a: unknown[]) => faux.demarrer(...a) }));

import { ChoixPaiement } from "@/components/commande/ChoixPaiement";
import type { OptionsPaiement } from "@/modules/paiement/service";

const NUMERO = "KS-2026-000042";
const AUCUN: OptionsPaiement = { carte: { disponible: false }, mobileMoney: { disponible: false, pays: [] } };
const COMPLET: OptionsPaiement = {
  carte: { disponible: true, prestataire: { code: "kpay", nom: "TEST_K-Pay" } },
  mobileMoney: {
    disponible: true,
    pays: [
      { code: "TZ", operateurs: [{ nom: "TEST_a", agregateur: "TEST_PawaPay" }, { nom: "TEST_b", agregateur: "TEST_K-Pay" }] },
      { code: "KE", operateurs: [{ nom: "TEST_c", agregateur: "TEST_MaishaPay" }] },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  faux.demarrer.mockResolvedValue({ ok: true, redirection: null });
});

describe("ChoixPaiement : disponibilité (UX-DR34, UX-DR36)", () => {
  it("sans Couverture ni carte autorisée : les deux messages, aucun bouton, aucune substitution", () => {
    rendre(<ChoixPaiement numero={NUMERO} options={AUCUN} />);
    expect(screen.getByText("Le mobile money n'est pas encore disponible dans ton pays.")).toBeTruthy();
    expect(screen.getByText("Le paiement par carte n'est pas disponible pour le moment.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("carte autorisée : « Paiement traité par {Prestataire} » en texte, sans logo, avant le bouton", () => {
    const { container } = rendre(<ChoixPaiement numero={NUMERO} options={{ ...AUCUN, carte: COMPLET.carte }} />);
    expect(screen.getByText("Paiement traité par TEST_K-Pay")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Payer par carte" })).toBeTruthy();
    expect(container.querySelector("img, svg")).toBeNull();
  });
  it("« Mobile money » est proposé avant « Carte »", () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    const titres = screen.getAllByText(/^(Mobile money|Carte)$/).map((e) => e.textContent);
    expect(titres).toEqual(["Mobile money", "Carte"]);
  });
});

describe("ChoixPaiement : pays, opérateur, numéro (UX-DR33)", () => {
  it("le pays se choisit d'abord, par une liste native ; aucun opérateur ni numéro avant", () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    const pays = screen.getByLabelText("Pays") as HTMLSelectElement;
    expect(pays.tagName).toBe("SELECT");
    expect(Array.from(pays.options).map((o) => o.value)).toEqual(["", "TZ", "KE", "__autre"]);
    expect(screen.queryByLabelText("Opérateur")).toBeNull();
    expect(screen.queryByLabelText("Numéro de téléphone")).toBeNull();
  });
  it("changer de pays réinitialise l'opérateur et annonce le nombre d'opérateurs (role=status)", async () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "TZ");
    expect(screen.getByRole("status").textContent).toBe("2 opérateurs disponibles");
    await userEvent.selectOptions(screen.getByLabelText("Opérateur"), "TEST_a");
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "KE");
    expect((screen.getByLabelText("Opérateur") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("1 opérateur disponible");
  });
  it("le numéro a un libellé visible, inputmode=tel et l'indicatif en aide", async () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "TZ");
    const champ = screen.getByLabelText("Numéro de téléphone");
    expect(champ.getAttribute("inputmode")).toBe("tel");
    const aide = document.getElementById((champ.getAttribute("aria-describedby") ?? "").split(" ").pop() ?? "");
    expect(aide?.textContent).toBe("Commence par le signe + et l'indicatif de ton pays.");
  });
  it("« Paiement traité par {Agrégateur} » est celui que le serveur retiendra pour l'opérateur choisi", async () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "TZ");
    await userEvent.selectOptions(screen.getByLabelText("Opérateur"), "TEST_a");
    expect(screen.getByText("Paiement traité par TEST_PawaPay")).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Opérateur"), "TEST_b");
    expect(screen.getAllByText("Paiement traité par TEST_K-Pay").length).toBeGreaterThan(0);
  });
  it("« Autre pays » : le mobile money n'est pas proposé, la carte reste", async () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "__autre");
    expect(screen.getByText("Le mobile money n'est pas encore disponible dans ton pays.")).toBeTruthy();
    expect(screen.queryByLabelText("Opérateur")).toBeNull();
    expect(screen.getByRole("button", { name: "Payer par carte" })).toBeTruthy();
  });
});

describe("ChoixPaiement : lancer le paiement", () => {
  async function preparer() {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "TZ");
    await userEvent.selectOptions(screen.getByLabelText("Opérateur"), "TEST_a");
    await userEvent.type(screen.getByLabelText("Numéro de téléphone"), "+255712345678");
  }
  it("le bouton est bloqué, avec sa raison, tant que l'opérateur et le numéro manquent", async () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.selectOptions(screen.getByLabelText("Pays"), "TZ");
    const bouton = screen.getByRole("button", { name: "Payer par mobile money" });
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(bouton);
    expect(faux.demarrer).not.toHaveBeenCalled();
  });
  it("n'envoie que le choix du client (jamais un Prestataire, une Famille ni un montant), puis relit la page", async () => {
    await preparer();
    await userEvent.click(screen.getByRole("button", { name: "Payer par mobile money" }));
    expect(faux.demarrer).toHaveBeenCalledWith({ numero: NUMERO, moyen: "mobile_money", pays: "TZ", operateur: "TEST_a", telephone: "+255712345678" });
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
  });
  it("le bouton se verrouille au premier toucher : un double toucher ne lance qu'une Tentative", async () => {
    let finir: (v: unknown) => void = () => undefined;
    faux.demarrer.mockReturnValueOnce(new Promise((r) => (finir = r)));
    await preparer();
    const bouton = screen.getByRole("button", { name: "Payer par mobile money" });
    await userEvent.click(bouton);
    await userEvent.click(screen.getAllByRole("button", { name: "Lancement du paiement…" })[0]);
    expect(faux.demarrer).toHaveBeenCalledTimes(1);
    finir({ ok: true, redirection: null });
  });
  it("carte : un seul appel, avec le moyen seul ; sans pays, opérateur ni numéro", async () => {
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.click(screen.getByRole("button", { name: "Payer par carte" }));
    expect(faux.demarrer).toHaveBeenCalledWith({ numero: NUMERO, moyen: "carte", pays: null, operateur: null, telephone: null });
  });
  it("pays, opérateur et numéro restent remplis après un échec (UX-DR27) et au rechargement de l'onglet", async () => {
    faux.demarrer.mockResolvedValue({ ok: false, erreur: "refuse" });
    await preparer();
    await userEvent.click(screen.getByRole("button", { name: "Payer par mobile money" }));
    expect(await screen.findByText("Le service de paiement a refusé la demande. Réessaie.")).toBeTruthy();
    expect((screen.getByLabelText("Numéro de téléphone") as HTMLInputElement).value).toBe("+255712345678");
    expect(JSON.parse(sessionStorage.getItem(`koma-paiement-${NUMERO}`) ?? "{}")).toMatchObject({ pays: "TZ", operateur: "TEST_a" });
  });
  it("numéro refusé par le serveur : erreur sous le champ, reliée par aria-describedby", async () => {
    faux.demarrer.mockResolvedValue({ ok: false, erreur: "telephone_invalide" });
    await preparer();
    await userEvent.click(screen.getByRole("button", { name: "Payer par mobile money" }));
    const champ = await screen.findByLabelText("Numéro de téléphone");
    await waitFor(() => expect(champ.getAttribute("aria-invalid")).toBe("true"));
    const ids = (champ.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids.map((i) => document.getElementById(i)?.textContent)).toContain("Le numéro doit commencer par + suivi de 8 à 15 chiffres.");
  });
  it("aucun Agrégateur ne couvre le choix : message relié au champ opérateur, avec l'invitation à choisir la carte", async () => {
    faux.demarrer.mockResolvedValue({ ok: false, erreur: "indisponible" });
    await preparer();
    await userEvent.click(screen.getByRole("button", { name: "Payer par mobile money" }));
    const champ = await screen.findByLabelText("Opérateur");
    await waitFor(() => expect(champ.getAttribute("aria-invalid")).toBe("true"));
    expect(document.getElementById(champ.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Aucun moyen de paiement disponible pour cet opérateur. Choisis un autre opérateur ou la carte.",
    );
  });
  it("un paiement déjà en cours (deuxième onglet, double toucher) : la page est relue au lieu d'afficher une erreur", async () => {
    faux.demarrer.mockResolvedValue({ ok: false, erreur: "tentative_en_cours" });
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.click(screen.getByRole("button", { name: "Payer par carte" }));
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
    expect(screen.queryByText("Un paiement est déjà en cours pour cette commande.")).toBeNull();
  });
  it("redirection du Prestataire (carte) : la page y va", async () => {
    const assigner = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign: assigner } });
    faux.demarrer.mockResolvedValue({ ok: true, redirection: "https://TEST.invalid/payer" });
    rendre(<ChoixPaiement numero={NUMERO} options={COMPLET} />);
    await userEvent.click(screen.getByRole("button", { name: "Payer par carte" }));
    await waitFor(() => expect(assigner).toHaveBeenCalledWith("https://TEST.invalid/payer"));
  });
});
