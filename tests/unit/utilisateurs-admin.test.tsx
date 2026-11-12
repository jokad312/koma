// @vitest-environment jsdom
// Story 9.10 : page « Utilisateurs » de l'admin. Grille de cartes en lecture seule (initiales, nom ou email masqué, date, rôle, Commandes, Pass), recherche, compteur ;
// lecture serveur par la fonction SQL réservée à l'Admin (réponse validée, erreur relancée). Données TEST ; rien de réel.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const etat = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: etat.rpc }) }));

import { GrilleUtilisateurs } from "@/components/admin/GrilleUtilisateurs";
import { lireUtilisateursAdmin, type UtilisateurAdmin } from "@/modules/admin/utilisateurs";

const AUTEUR = { type: "compte", id: "TEST_admin", role: "admin" } as never;

const UTILISATEURS: UtilisateurAdmin[] = [
  { id: "TEST_1", nom: "TEST_Alice Exemple", emailMasque: "te***@example.invalid", inscritLe: "2026-10-22T13:16:27Z", role: "admin", commandes: 3, pass: 1 },
  { id: "TEST_2", nom: null, emailMasque: "bo***@example.invalid", inscritLe: "2026-11-01T08:00:00Z", role: null, commandes: 0, pass: 0 },
  { id: "TEST_3", nom: "TEST_Chloé", emailMasque: null, inscritLe: null, role: "benevole", commandes: 1, pass: 2 },
];

describe("GrilleUtilisateurs", () => {
  it("compteur annoncé en statut et une carte par utilisateur, en grille (1 colonne sur téléphone, 2 à 4 ensuite)", () => {
    rendre(<GrilleUtilisateurs utilisateurs={UTILISATEURS} />);
    expect(screen.getByRole("status").textContent).toBe("3 utilisateurs");
    const liste = screen.getByRole("list");
    expect(liste.className).toContain("grid-cols-1");
    expect(liste.className).toContain("2xl:grid-cols-4");
    expect(within(liste).getAllByRole("listitem")).toHaveLength(3);
  });

  it("carte : initiales, nom (ou email masqué), email masqué sous le nom, date d'inscription, rôle, Commandes et Pass", () => {
    rendre(<GrilleUtilisateurs utilisateurs={UTILISATEURS} />);
    const [alice, bob, chloe] = screen.getAllByRole("listitem");
    expect(within(alice).getByRole("heading", { name: "TEST_Alice Exemple" })).toBeTruthy();
    expect(within(alice).getByText("te***@example.invalid")).toBeTruthy();
    expect(within(alice).getByText("TA")).toBeTruthy();
    expect(within(alice).getByText(/^Inscrit le /)).toBeTruthy();
    expect(within(alice).getByText("Administrateur")).toBeTruthy();
    expect(within(alice).getByText("Commandes").nextElementSibling?.textContent).toBe("3");
    expect(within(alice).getByText("Pass").nextElementSibling?.textContent).toBe("1");
    // Sans nom : l'email masqué sert de titre (une seule fois) ; sans rôle : « Utilisateur ».
    expect(within(bob).getByRole("heading", { name: "bo***@example.invalid" })).toBeTruthy();
    expect(within(bob).getByText("Utilisateur")).toBeTruthy();
    // Sans date : « Date d'inscription inconnue » (jamais une date inventée).
    expect(within(chloe).getByText("Date d'inscription inconnue")).toBeTruthy();
    expect(within(chloe).getByText("Bénévole")).toBeTruthy();
  });

  it("lecture seule : aucun lien, aucun bouton, aucun champ de rôle dans les cartes", () => {
    rendre(<GrilleUtilisateurs utilisateurs={UTILISATEURS} />);
    for (const carte of screen.getAllByRole("listitem")) {
      expect(within(carte).queryByRole("link")).toBeNull();
      expect(within(carte).queryByRole("button")).toBeNull();
      expect(within(carte).queryByRole("combobox")).toBeNull();
    }
  });

  it("recherche : nom, email masqué ou rôle, sans tenir compte de la casse ni des accents ; le compteur suit ; aucun résultat annoncé", async () => {
    const user = userEvent.setup();
    rendre(<GrilleUtilisateurs utilisateurs={UTILISATEURS} />);
    const champ = screen.getByRole("searchbox", { name: "Rechercher un utilisateur" });
    await user.type(champ, "chloe");
    expect(screen.getByRole("status").textContent).toBe("1 utilisateur");
    await user.clear(champ);
    await user.type(champ, "BO***");
    expect(screen.getByRole("status").textContent).toBe("1 utilisateur");
    await user.clear(champ);
    await user.type(champ, "administrateur");
    expect(screen.getByRole("status").textContent).toBe("1 utilisateur");
    await user.clear(champ);
    await user.type(champ, "zzz");
    expect(screen.getByRole("status").textContent).toBe("Aucun utilisateur");
    expect(screen.getByText("Aucun utilisateur ne correspond à ta recherche.")).toBeTruthy();
  });

  it("aucun Compte : message", () => {
    rendre(<GrilleUtilisateurs utilisateurs={[]} />);
    expect(screen.getByText("Aucun Compte pour le moment.")).toBeTruthy();
  });

  it("libellés en anglais", () => {
    rendre(<GrilleUtilisateurs utilisateurs={UTILISATEURS} />, "en");
    expect(screen.getByRole("status").textContent).toBe("3 users");
    expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
  });
});

describe("lireUtilisateursAdmin", () => {
  it("appelle la fonction réservée à l'Admin avec l'auteur et valide chaque ligne (rôle inconnu : sans rôle ; ligne illisible : ignorée)", async () => {
    etat.rpc.mockResolvedValue({
      data: [
        { id: "TEST_1", nom: "TEST_Alice", email_masque: "te***@example.invalid", inscrit_le: "2026-10-22T13:16:27Z", role: "assistant", commandes: 2, pass: 1 },
        { id: "TEST_2", nom: 12, email_masque: null, inscrit_le: null, role: "pirate", commandes: "x", pass: null },
        null,
        { nom: "sans identifiant" },
      ],
      error: null,
    });
    const liste = await lireUtilisateursAdmin(AUTEUR);
    expect(etat.rpc).toHaveBeenCalledWith("lister_utilisateurs_admin", { p_auteur: AUTEUR });
    expect(liste).toEqual([
      { id: "TEST_1", nom: "TEST_Alice", emailMasque: "te***@example.invalid", inscritLe: "2026-10-22T13:16:27Z", role: "assistant", commandes: 2, pass: 1 },
      { id: "TEST_2", nom: null, emailMasque: null, inscritLe: null, role: null, commandes: 0, pass: 0 },
    ]);
  });
  it("erreur de la base ou réponse inattendue : relancée, jamais une liste vide inventée", async () => {
    etat.rpc.mockResolvedValue({ data: null, error: { message: "KS_DROIT_REFUSE" } });
    await expect(lireUtilisateursAdmin(AUTEUR)).rejects.toThrow();
    etat.rpc.mockResolvedValue({ data: { pas: "un tableau" }, error: null });
    await expect(lireUtilisateursAdmin(AUTEUR)).rejects.toThrow();
  });
});
