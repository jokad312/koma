// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

// Le routeur de Next est stable d'un rendu à l'autre : le faux aussi (sinon le sondage redémarrerait à chaque rendu).
const faux = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, routeur: { refresh } };
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

import { SuiviPaiement } from "@/components/commande/SuiviPaiement";
import type { EtatPaiement } from "@/modules/paiement/etat";

const NUMERO = "KS-2026-000042";
const base: EtatPaiement = { phase: "attente", statut: "en_attente", kit: false, attenteDepuisSecondes: 0, causeEchec: null, tropPercu: null };
const fetchFaux = vi.fn();

function etat(s: Partial<EtatPaiement> = {}): EtatPaiement {
  return { ...base, ...s };
}
function reponse(corps: EtatPaiement, statut = 200) {
  return { ok: statut === 200, status: statut, json: async () => corps };
}
async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchFaux);
  fetchFaux.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SuiviPaiement : attente", () => {
  it("interroge le serveur toutes les 3 secondes, sur la route de l'état de cette Commande", async () => {
    fetchFaux.mockImplementation(async () => reponse(etat()));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    expect(screen.getByText("Nous attendons la confirmation de ton paiement. Tu peux rester sur cette page.")).toBeTruthy();
    await avancer(2900);
    expect(fetchFaux).not.toHaveBeenCalled();
    await avancer(200);
    expect(fetchFaux).toHaveBeenCalledTimes(1);
    expect(fetchFaux).toHaveBeenCalledWith(`/api/commande/${NUMERO}/etat`, expect.objectContaining({ cache: "no-store" }));
    await avancer(3000);
    expect(fetchFaux).toHaveBeenCalledTimes(2);
  });
  it("aucun choix de moyen ni bouton « Payer » pendant l'attente", () => {
    fetchFaux.mockImplementation(async () => reponse(etat()));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/payer/i)).toBeNull();
  });
  it("après 2 minutes sans état final : « Paiement en cours de vérification. » sans proposer de repayer", async () => {
    // Le serveur donne l'âge réel de la Tentative à chaque lecture (100 s au départ, puis le temps qui passe).
    const t0 = Date.now();
    fetchFaux.mockImplementation(async () => reponse(etat({ attenteDepuisSecondes: 100 + Math.floor((Date.now() - t0) / 1000) })));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ attenteDepuisSecondes: 100 })} numeroWhatsapp={null} />);
    expect(screen.queryByText("Paiement en cours de vérification.")).toBeNull();
    await avancer(21_000);
    expect(screen.getByText("Paiement en cours de vérification.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /Réessayer/ })).toBeNull();
  });
  it("l'âge donné par le serveur n'est pas compté deux fois : la vérification n'apparaît pas à 1 minute", async () => {
    const t0 = Date.now();
    fetchFaux.mockImplementation(async () => reponse(etat({ attenteDepuisSecondes: Math.floor((Date.now() - t0) / 1000) })));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    await avancer(75_000);
    expect(screen.queryByText("Paiement en cours de vérification.")).toBeNull();
    await avancer(50_000);
    expect(screen.getByText("Paiement en cours de vérification.")).toBeTruthy();
  });
  it("session terminée (401) : le sondage s'arrête", async () => {
    fetchFaux.mockImplementation(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    await avancer(3100);
    await avancer(15_000);
    expect(fetchFaux).toHaveBeenCalledTimes(1);
  });
  it("une Tentative déjà ancienne retrouvée au rechargement affiche tout de suite la vérification", async () => {
    fetchFaux.mockImplementation(async () => reponse(etat({ attenteDepuisSecondes: 200 })));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ attenteDepuisSecondes: 200 })} numeroWhatsapp={null} />);
    await avancer(3100);
    expect(screen.getByText("Paiement en cours de vérification.")).toBeTruthy();
  });
  it("une coupure réseau garde l'état affiché et recommence au tour suivant", async () => {
    fetchFaux.mockRejectedValueOnce(new Error("TEST_reseau")).mockImplementation(async () => reponse(etat()));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    await avancer(3100);
    expect(screen.getByText("Paiement en attente")).toBeTruthy();
    await avancer(3000);
    expect(fetchFaux).toHaveBeenCalledTimes(2);
  });
  it("aucune annonce tant que l'état ne change pas réellement", async () => {
    fetchFaux.mockImplementation(async () => reponse(etat()));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    await avancer(10_000);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(faux.refresh).not.toHaveBeenCalled();
  });
});

describe("SuiviPaiement : états finals", () => {
  it("« Payée » arrive du serveur : annonce unique, focus sur le titre, sondage arrêté, page relue, onglet reflétant l'état", async () => {
    fetchFaux.mockImplementation(async () => reponse(etat({ phase: "payee", statut: "payee" })));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    await avancer(3100);
    const titre = screen.getByRole("heading", { name: "Payée" });
    expect(document.activeElement).toBe(titre);
    expect(screen.getByRole("status").textContent).toBe("Paiement confirmé.");
    expect(document.title).toBe("Commande payée");
    expect(faux.refresh).toHaveBeenCalledTimes(1);
    await avancer(9000);
    expect(fetchFaux).toHaveBeenCalledTimes(1);
  });
  it("Commande payée avec un Kit : « Ouvrir dans ma bibliothèque »", () => {
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ phase: "payee", statut: "livree", kit: true })} numeroWhatsapp={null} />);
    expect(screen.getByRole("link", { name: "Ouvrir dans ma bibliothèque" }).getAttribute("href")).toBe("/compte/bibliotheque");
  });
  it("Commande payée sans Kit : pas de lien vers la bibliothèque", () => {
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ phase: "payee", statut: "payee" })} numeroWhatsapp={null} />);
    expect(screen.queryByRole("link", { name: "Ouvrir dans ma bibliothèque" })).toBeNull();
  });
  it("échec confirmé : alerte, « Réessayer » sans rien ressaisir, bouton WhatsApp", () => {
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ phase: "echec", statut: "echouee", causeEchec: "client" })} numeroWhatsapp="+243000000000" />);
    expect(screen.getByRole("alert").textContent).toBe("Le paiement n'a pas abouti. Tu peux réessayer.");
    expect(screen.getByRole("link", { name: "Réessayer" }).getAttribute("href")).toBe("#commande-moyens");
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toBeTruthy();
  });
  it("l'échec arrivé pendant l'attente est annoncé et reçoit le focus", async () => {
    fetchFaux.mockImplementation(async () => reponse(etat({ phase: "echec", statut: "echouee", causeEchec: "client" })));
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat()} numeroWhatsapp={null} />);
    await avancer(3100);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Paiement non abouti" }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});

describe("SuiviPaiement : Trop-perçu", () => {
  it.each([
    ["expiree", "alors qu'elle était expirée"],
    ["deja_payee", "alors qu'elle était déjà payée"],
    ["impossible", "alors qu'elle était impossible à honorer"],
  ] as const)("motif %s : texte validé (E-13) et bouton WhatsApp, sans promesse de délai ni de mode", (motif, extrait) => {
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ phase: "expiree", statut: "expiree", tropPercu: motif })} numeroWhatsapp="+243000000000" />);
    const texte = screen.getByText(new RegExp(extrait));
    expect(texte.textContent).toContain("Jonathan va te contacter pour le remboursement.");
    expect(texte.textContent).not.toMatch(/jours|heures|virement|mobile money/i);
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toBeTruthy();
  });
  it("sans Trop-perçu : aucun texte de remboursement", () => {
    rendre(<SuiviPaiement numero={NUMERO} etatInitial={etat({ phase: "expiree", statut: "expiree" })} numeroWhatsapp={null} />);
    expect(screen.queryByText(/remboursement/)).toBeNull();
  });
});
