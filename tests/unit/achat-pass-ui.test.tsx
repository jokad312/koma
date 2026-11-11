// @vitest-environment jsdom
// Story 7.4 : sélecteur de Pass (compteurs −/+ de 44 px à valeur annoncée, jamais de Stand, un nom par personne, son propre Pass repris du Compte),
// Récapitulatif calculé par le serveur, mention photos et vidéos jamais pré-cochée, Commande créée seulement après la réponse réelle du serveur.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ recap: vi.fn(), creer: vi.fn(), push: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/evenements/achat-actions", () => ({
  lireRecapitulatifPassAction: (...a: unknown[]) => faux.recap(...a),
  creerCommandePassAction: (...a: unknown[]) => faux.creer(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: faux.push }),
}));

import { FormulaireAchatPass, nomValable } from "@/components/festival/FormulaireAchatPass";

const A = fr.Festival.achat;
const EVENEMENT = "00000000-0000-4000-8000-0000000000c1";
const TYPES = [
  { id: "00000000-0000-4000-8000-0000000000d1", nom: "TEST_Simple", prixCents: 1500, inclus: "TEST_entrée", complet: false },
  { id: "00000000-0000-4000-8000-0000000000d2", nom: "TEST_VIP", prixCents: 3000, inclus: null, complet: false },
  { id: "00000000-0000-4000-8000-0000000000d3", nom: "TEST_Plein", prixCents: 1000, inclus: null, complet: true },
];
const RECAP = {
  lignes: [{ typePassId: TYPES[0].id, nom: "TEST_Simple", nombre: 2, prixCents: 1500, reductionCents: 0, titulaires: ["TEST_Alice", "TEST_Bob"] }],
  personnes: 2,
  sousTotalCents: 3000,
  reductionCents: 0,
  code: null,
  totalCents: 3000,
};

function formulaire(nomCompte: string | null = "TEST_Alice") {
  return rendre(<FormulaireAchatPass evenementId={EVENEMENT} slug="test-evenement" nomCompte={nomCompte} types={TYPES} />);
}
const plus = (nom: string) => screen.getByRole("button", { name: A.ajouter.replace("{nom}", nom) });
const moins = (nom: string) => screen.getByRole("button", { name: A.retirer.replace("{nom}", nom) });

beforeEach(() => {
  vi.clearAllMocks();
  faux.recap.mockResolvedValue({ ok: true, recap: RECAP });
  faux.creer.mockResolvedValue({ ok: true, numero: "KS-2099-000001", expireLe: "2099-01-01T00:00:00Z" });
});

describe("sélecteur de Pass", () => {
  it("un compteur −/+ de 44 px par Type, à 0 au départ ; un Type complet n'a pas de compteur ; aucun bouton d'ajout au Panier", () => {
    formulaire();
    expect(screen.getAllByRole("group")).toHaveLength(2);
    for (const b of [plus("TEST_Simple"), moins("TEST_Simple"), plus("TEST_VIP")]) expect(b.className).toContain("size-11");
    expect((moins("TEST_Simple") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: new RegExp(`${A.ajouter.replace("{nom}", "TEST_Plein")}`) })).toBeNull();
    expect(screen.getByText(A.complet)).toBeTruthy();
    expect(screen.queryByText(/panier/i)).toBeNull();
  });

  it("la valeur du compteur est annoncée (zone polie) et suit les clics", async () => {
    formulaire();
    const groupe = screen.getByRole("group", { name: A.quantite.replace("{nom}", "TEST_Simple") });
    const sortie = within(groupe).getByRole("status");
    expect(sortie.textContent).toBe("0");
    expect(sortie.getAttribute("aria-live")).toBe("polite");
    await userEvent.click(plus("TEST_Simple"));
    await userEvent.click(plus("TEST_Simple"));
    expect(sortie.textContent).toBe("2");
    await userEvent.click(moins("TEST_Simple"));
    expect(sortie.textContent).toBe("1");
  });

  it("un champ de nom par personne ; le premier Pass reprend le nom du Compte (aucun champ), les autres sont à écrire", async () => {
    formulaire("TEST_Alice");
    await userEvent.click(plus("TEST_Simple"));
    await userEvent.click(plus("TEST_Simple"));
    await userEvent.click(plus("TEST_VIP"));
    expect(screen.getByText(A.noms.moiConnu.replace("{type}", "TEST_Simple").replace("{nom}", "TEST_Alice"))).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("sans nom de Compte, le premier Pass demande le nom de l'acheteur (jamais inventé) ; décocher « pour moi » ouvre tous les champs", async () => {
    formulaire(null);
    await userEvent.click(plus("TEST_Simple"));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByLabelText(A.noms.moiSaisie.replace("{type}", "TEST_Simple"))).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: A.noms.moi }));
    expect(screen.getByLabelText(A.noms.champ.replace("{type}", "TEST_Simple").replace("{numero}", "1"))).toBeTruthy();
  });

  it("le maximum par commande désactive « + »", async () => {
    formulaire();
    for (let i = 0; i < 20; i++) await userEvent.click(plus("TEST_Simple"));
    expect((plus("TEST_VIP") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(A.maxAtteint.replace("{max}", "20"))).toBeTruthy();
  });

  it("aucun Pass choisi, ou un nom invalide : message, et le serveur n'est pas appelé", async () => {
    formulaire(null);
    await userEvent.click(screen.getByRole("button", { name: A.voirRecap }));
    expect(await screen.findByText(A.champs.aucun)).toBeTruthy();
    await userEvent.click(plus("TEST_Simple"));
    await userEvent.type(screen.getByLabelText(A.noms.moiSaisie.replace("{type}", "TEST_Simple")), "A<");
    await userEvent.click(screen.getByRole("button", { name: A.voirRecap }));
    expect(await screen.findByText(A.champs.nom)).toBeTruthy();
    expect(faux.recap).not.toHaveBeenCalled();
  });
});

describe("nomValable", () => {
  it("2 à 80 caractères, sans chevrons ni caractère de contrôle", () => {
    expect(nomValable("Al")).toBe(true);
    expect(nomValable(" A ")).toBe(false);
    expect(nomValable("x".repeat(80))).toBe(true);
    expect(nomValable("x".repeat(81))).toBe(false);
    expect(nomValable("a<b")).toBe(false);
    expect(nomValable("ab\u0007")).toBe(false);
  });
});

async function versRecap() {
  formulaire("TEST_Alice");
  await userEvent.click(plus("TEST_Simple"));
  await userEvent.click(plus("TEST_Simple"));
  await userEvent.type(screen.getByLabelText(A.noms.champ.replace("{type}", "TEST_Simple").replace("{numero}", "2")), "TEST_Bob");
  await userEvent.click(screen.getByRole("button", { name: A.voirRecap }));
  await screen.findByRole("heading", { name: A.recap.titre });
}

describe("Récapitulatif et confirmation", () => {
  it("le Récapitulatif vient du serveur : Types, noms, prix USD, total", async () => {
    await versRecap();
    expect(faux.recap).toHaveBeenCalledTimes(1);
    expect(faux.recap.mock.calls[0][0]).toMatchObject({ evenementId: EVENEMENT, pourMoi: true, lignes: [{ typePassId: TYPES[0].id, titulaires: ["TEST_Alice", "TEST_Bob"] }] });
    expect(screen.getByText(A.recap.ligne.replace("{nombre}", "2").replace("{nom}", "TEST_Simple"))).toBeTruthy();
    expect(screen.getByText(A.recap.noms.replace("{noms}", "TEST_Alice, TEST_Bob"))).toBeTruthy();
    expect(screen.getAllByText(/30,00[\s ]\$US/).length).toBeGreaterThanOrEqual(2);
  });

  it("la case de la mention n'est jamais pré-cochée et porte le texte de Jonathan ; sans elle, rien n'est créé", async () => {
    await versRecap();
    const caseMention = screen.getByRole("checkbox", { name: "[Texte à fournir]" }) as HTMLInputElement;
    expect(caseMention.checked).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: A.confirmer }));
    expect(await screen.findByText(A.champs.mention)).toBeTruthy();
    expect(faux.creer).not.toHaveBeenCalled();
  });

  it("confirmation : total vu envoyé au serveur avec une clé d'idempotence, puis choix du moyen de paiement de la Commande", async () => {
    await versRecap();
    await userEvent.click(screen.getByRole("checkbox", { name: "[Texte à fournir]" }));
    await userEvent.click(screen.getByRole("button", { name: A.confirmer }));
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/commande/KS-2099-000001"));
    expect(faux.creer).toHaveBeenCalledTimes(1);
    expect(faux.creer.mock.calls[0][0]).toMatchObject({ evenementId: EVENEMENT, mention: true, totalAttenduCents: 3000, pourMoi: true });
    expect(String(faux.creer.mock.calls[0][0].cleIdempotence).length).toBeGreaterThanOrEqual(8);
  });

  it("refus du serveur : message lisible, aucune redirection ; Complet est dit comme tel", async () => {
    faux.creer.mockResolvedValue({ ok: false, erreur: "complet" });
    await versRecap();
    await userEvent.click(screen.getByRole("checkbox", { name: "[Texte à fournir]" }));
    await userEvent.click(screen.getByRole("button", { name: A.confirmer }));
    expect(await screen.findByText(A.erreurs.complet)).toBeTruthy();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("total changé : le nouveau total est montré avec l'ancien, il faut reconfirmer", async () => {
    faux.creer.mockResolvedValue({ ok: false, erreur: "total_change", recap: { ...RECAP, sousTotalCents: 3200, totalCents: 3200 } });
    await versRecap();
    await userEvent.click(screen.getByRole("checkbox", { name: "[Texte à fournir]" }));
    await userEvent.click(screen.getByRole("button", { name: A.confirmer }));
    expect(await screen.findByText(/Le total a changé/)).toBeTruthy();
    expect(screen.getAllByText(/32,00[\s ]\$US/).length).toBeGreaterThan(0);
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("Code promo refusé par le serveur : la raison s'affiche sous le champ, le total reste sans réduction", async () => {
    await versRecap();
    faux.recap.mockResolvedValue({ ok: true, recap: { ...RECAP, code: { valide: false, erreur: "code_premier_achat" } } });
    await userEvent.type(screen.getByLabelText(fr.Commande.code.label), "TEST");
    await userEvent.click(screen.getByRole("button", { name: fr.Commande.code.appliquer }));
    expect(await screen.findByText(fr.Commande.code.erreurs.code_premier_achat)).toBeTruthy();
    expect(faux.recap.mock.calls.at(-1)?.[0]).toMatchObject({ code: "TEST" });
  });

  it("« Modifier mon choix » revient au sélecteur sans rien créer", async () => {
    await versRecap();
    await userEvent.click(screen.getByRole("button", { name: A.modifier }));
    expect(screen.getByRole("button", { name: A.voirRecap })).toBeTruthy();
    expect(faux.creer).not.toHaveBeenCalled();
  });
});
