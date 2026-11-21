// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const M = fr.Admin.codesPromo;

const faux = vi.hoisted(() => {
  const refresh = vi.fn();
  return { creer: vi.fn(), modifier: vi.fn(), changerEtat: vi.fn(), refresh, routeur: { refresh } };
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
vi.mock("@/modules/promo/actions", () => ({
  creerCodePromoAction: (...a: unknown[]) => faux.creer(...a),
  modifierCodePromoAction: (...a: unknown[]) => faux.modifier(...a),
  changerEtatCodePromoAction: (...a: unknown[]) => faux.changerEtat(...a),
}));

import { AnnoncesCodesPromo } from "@/components/admin/AnnoncesCodesPromo";
import { FormulaireCodePromo } from "@/components/admin/FormulaireCodePromo";
import { ListeCodesPromo } from "@/components/admin/ListeCodesPromo";
import type { CodePromo } from "@/modules/promo/types";
import { formaterUsd } from "@/lib/argent";

const CODE: CodePromo = {
  id: "00000000-0000-4000-8000-0000000000d1",
  code: "SOLDES10",
  affilie: "TEST_Affilié",
  reductionPct: 20,
  commissionPct: 5,
  plafond: 50,
  actif: true,
  creeLe: "2026-11-04T10:00:00Z",
  modifieLe: "2026-11-04T10:00:00Z",
  ventes: 0,
  montantCents: 0,
  commissionCents: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  faux.creer.mockResolvedValue({ ok: true });
  faux.modifier.mockResolvedValue({ ok: true });
  faux.changerEtat.mockResolvedValue({ ok: true });
});

// Presse-papiers du navigateur : remis dans son état d'origine après chaque test (aucune fuite d'un test à l'autre).
const presseOrigine = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (presseOrigine) Object.defineProperty(navigator, "clipboard", presseOrigine);
  else delete (navigator as unknown as Record<string, unknown>).clipboard;
});

async function remplirCreation(valeurs: { code?: string; affilie?: string; reduction?: string; commission?: string; plafond?: string } = {}) {
  const champs = {
    code: valeurs.code ?? "soldes10",
    affilie: valeurs.affilie ?? "TEST_Affilié",
    reduction: valeurs.reduction ?? "20",
    commission: valeurs.commission ?? "5",
    plafond: valeurs.plafond ?? "",
  };
  await userEvent.type(screen.getByLabelText("Code"), champs.code);
  await userEvent.type(screen.getByLabelText("Affilié"), champs.affilie);
  await userEvent.type(screen.getByLabelText("Pourcentage de réduction"), champs.reduction);
  await userEvent.type(screen.getByLabelText("Taux de commission"), champs.commission);
  if (champs.plafond) await userEvent.type(screen.getByLabelText("Plafond d'utilisations"), champs.plafond);
}

describe("FormulaireCodePromo : création", () => {
  it("affiche les champs validés et le plafond vide (50 par défaut côté serveur)", () => {
    rendre(<FormulaireCodePromo />);
    expect(screen.getByRole("heading", { name: "Créer un Code promo" })).toBeTruthy();
    for (const libelle of ["Code", "Affilié", "Pourcentage de réduction", "Taux de commission", "Plafond d'utilisations", "Actif"]) {
      expect(screen.getByLabelText(libelle)).toBeTruthy();
    }
    expect((screen.getByLabelText("Plafond d'utilisations") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Actif") as HTMLInputElement).checked).toBe(true);
  });

  it("envoie la saisie brute au serveur puis vide le formulaire et relit la liste", async () => {
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    expect(faux.creer).toHaveBeenCalledWith({
      code: "soldes10",
      affilie: "TEST_Affilié",
      reductionPct: "20",
      commissionPct: "5",
      plafond: "",
      actif: true,
    });
    await waitFor(() => expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe(""));
    expect((screen.getByLabelText("Affilié") as HTMLInputElement).value).toBe("");
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("code déjà pris : erreur reliée au champ Code, saisie conservée", async () => {
    faux.creer.mockResolvedValue({ ok: false, erreur: "code_existant" });
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    const champ = await screen.findByLabelText("Code");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const idErreur = (champ.getAttribute("aria-describedby") ?? "").split(" ").find((id) => id.endsWith("-erreur"));
    expect(idErreur).toBeTruthy();
    expect(document.getElementById(idErreur as string)?.textContent).toBe(M.erreurs.code_existant);
    // Le focus est déplacé sur le champ en erreur : le lecteur d'écran annonce son libellé et le message relié.
    expect(document.activeElement).toBe(champ);
    expect((screen.getByLabelText("Affilié") as HTMLInputElement).value).toBe("TEST_Affilié");
  });

  it("droit retiré : message général, aucun champ marqué invalide", async () => {
    faux.creer.mockResolvedValue({ ok: false, erreur: "non_autorise" });
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    expect((await screen.findByRole("alert")).textContent).toContain(M.erreurs.non_autorise);
    expect((screen.getByLabelText("Code") as HTMLInputElement).getAttribute("aria-invalid")).toBeNull();
  });

  it("le succès n'apparaît qu'après la réponse du serveur", async () => {
    rendre(<FormulaireCodePromo />);
    expect(screen.queryByRole("status")).toBeNull();
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(M.succes.creation));
  });
});

describe("FormulaireCodePromo : cas de la revue", () => {
  it("décocher « Actif » envoie actif: false", async () => {
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByLabelText("Actif"));
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    expect(faux.creer).toHaveBeenCalledWith(expect.objectContaining({ actif: false }));
  });

  it("garde anti double envoi : un second clic pendant l'envoi n'appelle pas le serveur", async () => {
    let terminer: (v: { ok: true }) => void = () => undefined;
    faux.creer.mockReturnValue(new Promise((r) => (terminer = r)));
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    const bouton = screen.getByRole("button", { name: "Créer le Code promo" });
    await userEvent.click(bouton);
    await userEvent.click(bouton);
    expect(faux.creer).toHaveBeenCalledTimes(1);
    terminer({ ok: true });
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
  });

  it("chaque erreur de champ est reliée à son champ et le focus y va", async () => {
    const cas: Array<[string, string, string]> = [
      ["reduction_invalide", "Pourcentage de réduction", M.erreurs.reduction_invalide],
      ["commission_invalide", "Taux de commission", M.erreurs.commission_invalide],
      ["plafond_invalide", "Plafond d'utilisations", M.erreurs.plafond_invalide],
      ["affilie_invalide", "Affilié", M.erreurs.affilie_invalide],
    ];
    for (const [erreur, libelle, texte] of cas) {
      faux.creer.mockResolvedValue({ ok: false, erreur });
      const { unmount } = rendre(<FormulaireCodePromo />);
      await remplirCreation();
      await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
      const champ = await screen.findByLabelText(libelle);
      await waitFor(() => expect(champ.getAttribute("aria-invalid")).toBe("true"));
      const idErreur = (champ.getAttribute("aria-describedby") ?? "").split(" ").find((id) => id.endsWith("-erreur"));
      expect(document.getElementById(idErreur as string)?.textContent).toBe(texte);
      expect(document.activeElement).toBe(champ);
      unmount();
    }
  });

  it("code introuvable : message général et la liste est relue", async () => {
    faux.modifier.mockResolvedValue({ ok: false, erreur: "introuvable" });
    rendre(<FormulaireCodePromo code={CODE} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toContain(M.erreurs.introuvable);
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("création : l'aide du plafond annonce la valeur par défaut", () => {
    rendre(<FormulaireCodePromo />);
    expect(screen.getByText(M.aides.plafond)).toBeTruthy();
    expect(screen.queryByText(M.aides.plafondModif)).toBeNull();
  });

  it("modification : l'aide du plafond ne promet pas 50, et le succès disparaît dès qu'on retape", async () => {
    rendre(<FormulaireCodePromo code={CODE} />);
    expect(screen.getByText(M.aides.plafondModif)).toBeTruthy();
    expect(screen.queryByText(M.aides.plafond)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(M.succes.modification));
    await userEvent.type(screen.getByLabelText("Affilié"), "x");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("modifier : le code est affiché en lecture seule et les valeurs sont préremplies ; l'envoi porte l'identifiant", async () => {
    rendre(<FormulaireCodePromo code={CODE} />);
    expect(screen.getByText("Code : SOLDES10")).toBeTruthy();
    expect(screen.queryByLabelText("Code")).toBeNull();
    expect((screen.getByLabelText("Affilié") as HTMLInputElement).value).toBe("TEST_Affilié");
    expect((screen.getByLabelText("Pourcentage de réduction") as HTMLInputElement).value).toBe("20");
    expect((screen.getByLabelText("Taux de commission") as HTMLInputElement).value).toBe("5");
    const plafond = screen.getByLabelText("Plafond d'utilisations") as HTMLInputElement;
    expect(plafond.value).toBe("50");
    await userEvent.clear(plafond);
    await userEvent.type(plafond, "80");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.modifier).toHaveBeenCalledWith(CODE.id, { affilie: "TEST_Affilié", reductionPct: "20", commissionPct: "5", plafond: "80", actif: true });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(M.succes.modification));
    expect(faux.refresh).toHaveBeenCalled();
  });
});

// Story 9.16 i : tableau (à partir de 1024 px) et cartes (en dessous) sont tous deux dans le DOM ; jsdom n'applique pas les classes : on lit le tableau.
const PARAMETRES = { filtre: "tous" as const, page: 1 };
const tableau = () => screen.getByRole("table");
// Chaque code est un <tbody> : sa ligne principale et la ligne de ses valeurs (conditions, ventes).
const ligne = (code: string) => within(tableau()).getByText(code, { selector: "span" }).closest("tbody") as HTMLElement;
const annonce = () => document.querySelector("[data-annonce-codes]")?.textContent ?? "";
const espaces = (texte: string | null | undefined) => (texte ?? "").replace(/[  ]/g, " ");

describe("ListeCodesPromo (9.16 i)", () => {
  it("colonnes de la maquette, valeurs existantes sur la ligne suivante ; N° = rang dans la liste (debut + 1) ; date courte à l'heure de Goma", () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={20} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const entetes = within(tableau()).getAllByRole("columnheader").map((th) => th.textContent);
    expect(entetes).toEqual([M.colonnes.numero, M.colonnes.influenceur, M.colonnes.date, M.colonnes.code, M.colonnes.etat, M.colonnes.actions]);
    const l = ligne("SOLDES10");
    const cellules = within(l).getAllByRole("cell");
    expect(cellules[0].textContent).toBe("21");
    expect(cellules[1].textContent).toContain("TEST_Affilié");
    expect(cellules[2].textContent).toBe("4 nov. 2026");
    expect(within(l).getByText("20 %")).toBeTruthy();
    expect(within(l).getByText("5 %")).toBeTruthy();
    expect(within(l).getByText("50")).toBeTruthy();
    expect(l.querySelector("[data-etat]")?.textContent).toBe("Actif");
  });

  it("état inactif : le texte le dit, jamais la couleur seule ; Réactiver à la place de la corbeille", () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[{ ...CODE, actif: false }]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const l = ligne("SOLDES10");
    expect(l.querySelector("[data-etat]")?.textContent).toBe("Inactif");
    expect(within(l).queryByRole("button", { name: "Désactiver le code SOLDES10" })).toBeNull();
    expect(within(l).getByRole("button", { name: "Réactiver le code SOLDES10" })).toBeTruthy();
  });

  it("le crayon ouvre la fenêtre de modification sur la même route, en gardant filtre, recherche et page", () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={0} parametres={{ filtre: "actifs", q: "sol", page: 2 }} locale="fr" /></AnnoncesCodesPromo>);
    const lien = within(ligne("SOLDES10")).getByRole("link", { name: "Modifier le code SOLDES10" });
    expect(lien.getAttribute("href")).toBe(`/admin/codes-promo?q=sol&filtre=actifs&page=2&modifier=${CODE.id}`);
  });

  it("Copier : le code part dans le presse-papiers et « copié » est annoncé en statut", async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true });
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const l = ligne("SOLDES10");
    await userEvent.click(within(l).getByRole("button", { name: "Copier le code SOLDES10" }));
    expect(ecrire).toHaveBeenCalledWith("SOLDES10");
    // Annonce dans la zone de la page (pas dans la ligne : une ligne peut quitter la vue).
    await waitFor(() => expect(annonce()).toBe("Copié : SOLDES10"));
  });

  it("Copier refusé par le navigateur : un message le dit, jamais « copié »", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("refus")) }, configurable: true });
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const l = ligne("SOLDES10");
    await userEvent.click(within(l).getByRole("button", { name: "Copier le code SOLDES10" }));
    expect((await within(l).findByRole("alert")).textContent).toBe(M.actions.copieImpossible);
    expect(annonce()).toBe("");
  });

  it("corbeille : confirmation d'abord, puis désactivation de l'état seul (aucune autre valeur envoyée), liste relue, annonce et focus sur le compteur", async () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    await userEvent.click(within(ligne("SOLDES10")).getByRole("button", { name: "Désactiver le code SOLDES10" }));
    expect(faux.changerEtat).not.toHaveBeenCalled();
    const dialogue = await screen.findByRole("dialog", { name: "Désactiver le code SOLDES10 ?" });
    await userEvent.click(within(dialogue).getByRole("button", { name: M.confirmation.confirmer }));
    await waitFor(() => expect(faux.changerEtat).toHaveBeenCalledWith(CODE.id, false));
    expect(faux.modifier).not.toHaveBeenCalled();
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
    await waitFor(() => expect(annonce()).toBe("Code SOLDES10 désactivé."));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("TEST_compteur"));
  });

  it("corbeille puis Annuler : rien n'est envoyé", async () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    await userEvent.click(within(ligne("SOLDES10")).getByRole("button", { name: "Désactiver le code SOLDES10" }));
    const dialogue = await screen.findByRole("dialog", { name: "Désactiver le code SOLDES10 ?" });
    await userEvent.click(within(dialogue).getByRole("button", { name: M.confirmation.annuler }));
    expect(faux.changerEtat).not.toHaveBeenCalled();
  });

  it("Réactiver : sans confirmation, actif: true ; un refus du serveur est affiché, sans annonce de succès", async () => {
    faux.changerEtat.mockResolvedValue({ ok: false, erreur: "non_autorise" });
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[{ ...CODE, actif: false }]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const l = ligne("SOLDES10");
    await userEvent.click(within(l).getByRole("button", { name: "Réactiver le code SOLDES10" }));
    await waitFor(() => expect(faux.changerEtat).toHaveBeenCalledWith(CODE.id, true));
    expect((await within(l).findByRole("alert")).textContent).toBe(M.erreurs.non_autorise);
    expect(annonce()).toBe("");
  });

  it("story 9.3 : ventes payées, montant hors livraison et commission due, en USD, pour chaque code", () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[{ ...CODE, ventes: 2, montantCents: 10782, commissionCents: 538 }]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const bloc = within(tableau()).getByLabelText(M.ventes.titre.replace("{code}", "SOLDES10"));
    const valeur = (libelle: string) => espaces(within(bloc).getByText(libelle).nextElementSibling?.textContent);
    expect(valeur(M.ventes.nombre)).toBe("2");
    expect(valeur(M.ventes.montant)).toBe(espaces(formaterUsd(10782, "fr")));
    expect(valeur(M.ventes.commission)).toBe(espaces(formaterUsd(538, "fr")));
  });

  it("story 9.3 : un code sans vente affiche 0, jamais une valeur inventée", () => {
    rendre(<AnnoncesCodesPromo compteur="TEST_compteur"><ListeCodesPromo codes={[CODE]} debut={0} parametres={PARAMETRES} locale="fr" /></AnnoncesCodesPromo>);
    const bloc = within(tableau()).getByLabelText(M.ventes.titre.replace("{code}", "SOLDES10"));
    expect(within(bloc).getByText(M.ventes.nombre).nextElementSibling?.textContent).toBe("0");
    expect(espaces(within(bloc).getByText(M.ventes.commission).nextElementSibling?.textContent)).toBe(espaces(formaterUsd(0, "fr")));
  });
});
