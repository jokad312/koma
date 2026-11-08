// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  creerCommande: vi.fn(),
  lireRecapitulatif: vi.fn(),
  push: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/commande" }));
vi.mock("@/modules/commande/actions", () => ({
  creerCommande: (...a: unknown[]) => faux.creerCommande(...a),
  lireRecapitulatif: (...a: unknown[]) => faux.lireRecapitulatif(...a),
  obtenirKitGratuit: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { FormulaireCommande } from "@/components/commande/FormulaireCommande";
import { formaterUsd as formaterBrut } from "@/lib/argent";

// Intl met des espaces insécables autour du symbole : on les ramène à des espaces simples, comme le fait le DOM testé.
const formaterUsd = (c: number, l: "fr" | "en") => formaterBrut(c, l).replace(/[  ]/g, " ");
import type { Recapitulatif } from "@/modules/commande/types";
import frMessages from "../../messages/fr.json";

const ligne = (s: Partial<Recapitulatif["lignes"][number]> = {}): Recapitulatif["lignes"][number] => ({
  ligneId: "00000000-0000-4000-8000-0000000000c1",
  produitId: "00000000-0000-4000-8000-0000000000aa",
  famille: "cosplay",
  slug: "test-cosplay",
  titre: "TEST_Cosplay",
  taille: "M",
  nombre: 2,
  prixCents: 5000,
  etat: "sur_commande",
  origine: "fabrication",
  delaiFabricationJours: 14,
  reductionCents: 0,
  ...s,
});
const recap = (s: Partial<Recapitulatif> = {}): Recapitulatif => ({
  lignes: [ligne()],
  physique: true,
  kit: false,
  surMesure: false,
  sousTotalCents: 10000,
  forfaitCents: 0,
  reductionCents: 0,
  code: null,
  totalCents: 10000,
  indisponible: false,
  remiseManquante: true,
  empreinte: "0123456789abcdef0123456789abcdef",
  ...s,
});

const props = {
  recapInitial: recap(),
  zoneInitiale: null,
  modeInitial: null,
  telephoneInitial: "",
  adresseInitiale: "",
  lieuRetrait: "TEST_Lieu de retrait",
  origine: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FormulaireCommande", () => {
  it("Panier 100 % numérique : aucun champ de téléphone, de zone ni d'adresse", () => {
    rendre(
      <FormulaireCommande
        {...props}
        recapInitial={recap({ lignes: [ligne({ famille: "kit", taille: null, origine: null, delaiFabricationJours: null, etat: "disponible" })], physique: false, kit: true, remiseManquante: false })}
      />,
    );
    expect(screen.queryByLabelText("Numéro de téléphone")).toBeNull();
    expect(screen.queryByRole("radio", { name: "Goma" })).toBeNull();
    expect(screen.queryByLabelText("Adresse de livraison")).toBeNull();
    expect(screen.getByText("Kit numérique : accès immédiat après le paiement.")).toBeTruthy();
  });

  it("aucune case n'est pré-cochée ; la case du Kit n'existe qu'avec un Kit", () => {
    rendre(<FormulaireCommande {...props} />);
    const cases = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // CGV + case facultative « Emails commerciaux » (story 9.4), toutes décochées.
    expect(cases).toHaveLength(2);
    expect(cases.every((c) => !c.checked)).toBe(true);
    expect(screen.getByLabelText(frMessages.Consentement.emails)).toBe(cases[1]);
  });

  it("Goma : choix du Mode, lieu de retrait ; Bukavu : livraison imposée avec l'adresse, Récapitulatif relu par le serveur", async () => {
    faux.lireRecapitulatif.mockResolvedValue({ ok: true, recap: recap({ forfaitCents: 1200, totalCents: 11200, remiseManquante: false }) });
    rendre(<FormulaireCommande {...props} />);
    expect(screen.queryByRole("radio", { name: "Livraison" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Goma" }));
    await userEvent.click(screen.getByRole("radio", { name: "Retrait gratuit à Goma" }));
    expect(screen.getByText("Lieu de retrait : TEST_Lieu de retrait")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Bukavu" }));
    expect(screen.queryByRole("radio", { name: "Retrait gratuit à Goma" })).toBeNull();
    expect(screen.getByLabelText("Adresse de livraison")).toBeTruthy();
    await waitFor(() => expect(faux.lireRecapitulatif).toHaveBeenLastCalledWith({ zone: "bukavu", mode: "livraison", code: null }, "fr"));
    await screen.findByText(formaterUsd(11200, "fr"));
  });

  it("champs ou cases manquants : résumé d'erreurs, aucun appel au serveur", async () => {
    rendre(<FormulaireCommande {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    const alerte = screen.getByRole("alert");
    expect(within(alerte).getByText("Indique ton numéro de téléphone, avec l'indicatif du pays.")).toBeTruthy();
    expect(within(alerte).getByText("Choisis Goma ou Bukavu.")).toBeTruthy();
    expect(within(alerte).getByText("Coche la case des conditions générales de vente.")).toBeTruthy();
    expect(faux.creerCommande).not.toHaveBeenCalled();
  });

  async function remplir() {
    faux.lireRecapitulatif.mockResolvedValue({ ok: true, recap: recap({ forfaitCents: 0, totalCents: 10000, remiseManquante: false }) });
    await userEvent.type(screen.getByLabelText("Numéro de téléphone"), "+243990000000");
    await userEvent.click(screen.getByRole("radio", { name: "Goma" }));
    await userEvent.click(screen.getByRole("radio", { name: "Retrait gratuit à Goma" }));
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
  }

  it("tout est rempli : la commande est créée avec le total vu, puis on va à son détail ; le succès vient de la réponse du serveur", async () => {
    faux.creerCommande.mockResolvedValue({ ok: true, numero: "KS-2026-000042", expireLe: "2026-11-01T12:30:00Z" });
    rendre(<FormulaireCommande {...props} />);
    await remplir();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/commande/KS-2026-000042"));
    expect(faux.creerCommande).toHaveBeenCalledWith(
      expect.objectContaining({ zone: "goma", mode: "retrait", telephone: "+243990000000", adresse: null, totalAttenduCents: 10000, acceptations: { cgv: true, kit: undefined, surMesure: undefined }, empreinte: "0123456789abcdef0123456789abcdef", emails: false }),
      "fr",
    );
  });

  it("story 9.4 : case Emails cochée → creerCommande reçoit emails: true", async () => {
    faux.creerCommande.mockResolvedValue({ ok: true, numero: "KS-2026-000043", expireLe: "2026-11-01T12:30:00Z" });
    rendre(<FormulaireCommande {...props} />);
    await remplir();
    await userEvent.click(screen.getByLabelText(frMessages.Consentement.emails));
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.creerCommande).toHaveBeenCalledWith(expect.objectContaining({ emails: true }), "fr"));
  });

  it("total changé : « Le total a changé : ancien → nouveau », nouvelle confirmation exigée avec le nouveau total", async () => {
    faux.creerCommande
      .mockResolvedValueOnce({ ok: false, erreur: "total_change", recap: recap({ totalCents: 11000, forfaitCents: 1000, remiseManquante: false }) })
      .mockResolvedValueOnce({ ok: true, numero: "KS-2026-000043", expireLe: "2026-11-01T12:30:00Z" });
    rendre(<FormulaireCommande {...props} />);
    await remplir();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await screen.findByText(`Le total a changé : ${formaterUsd(10000, "fr")} → ${formaterUsd(11000, "fr")}. Vérifie le récapitulatif, puis confirme à nouveau.`);
    expect(faux.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/commande/KS-2026-000043"));
    expect(faux.creerCommande).toHaveBeenLastCalledWith(expect.objectContaining({ totalAttenduCents: 11000 }), "fr");
  });

  it("disponibilité ou délai changés à total égal : message clair, nouveau Récapitulatif, nouvelle confirmation avec la nouvelle empreinte", async () => {
    faux.creerCommande
      .mockResolvedValueOnce({ ok: false, erreur: "recap_change", recap: recap({ remiseManquante: false, empreinte: "ffffffffffffffffffffffffffffffff" }) })
      .mockResolvedValueOnce({ ok: true, numero: "KS-2026-000044", expireLe: "2026-11-01T12:30:00Z" });
    rendre(<FormulaireCommande {...props} />);
    await remplir();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await screen.findByText("Le récapitulatif a changé (disponibilité ou délai d'un article). Vérifie-le, puis confirme à nouveau.");
    expect(faux.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/commande/KS-2026-000044"));
    expect(faux.creerCommande).toHaveBeenLastCalledWith(expect.objectContaining({ empreinte: "ffffffffffffffffffffffffffffffff" }), "fr");
  });

  it("Commande déjà à payer : message dédié, jamais un faux succès", async () => {
    faux.creerCommande.mockResolvedValue({ ok: false, erreur: "commande_en_attente" });
    rendre(<FormulaireCommande {...props} />);
    await remplir();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await screen.findByText(/Tu as déjà une commande à payer/);
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("la même clé d'idempotence est renvoyée à chaque essai (un double toucher ne crée pas deux commandes)", async () => {
    faux.creerCommande.mockResolvedValue({ ok: false, erreur: "erreur" });
    rendre(<FormulaireCommande {...props} />);
    await remplir();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await screen.findByText("La commande n'a pas pu être créée. Réessaie.");
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.creerCommande).toHaveBeenCalledTimes(2));
    const [a, b] = faux.creerCommande.mock.calls.map((c) => (c[0] as { cleIdempotence: string }).cleIdempotence);
    expect(a).toBe(b);
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("ligne indisponible : « Plus disponible » et « Confirmer la commande » bloqué avec sa raison", () => {
    rendre(<FormulaireCommande {...props} recapInitial={recap({ lignes: [ligne({ etat: "epuise", origine: null })], indisponible: true })} />);
    expect(screen.getByText("Plus disponible")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmer la commande" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Retire d'abord de ton panier les articles qui ne sont plus disponibles.")).toBeTruthy();
  });

  it("Kit dans le Panier : la case « accès immédiat, renonciation, Licence » est exigée", async () => {
    rendre(
      <FormulaireCommande
        {...props}
        recapInitial={recap({ lignes: [ligne({ famille: "kit", taille: null, origine: null, delaiFabricationJours: null, etat: "disponible" })], physique: false, kit: true, remiseManquante: false })}
      />,
    );
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    expect(within(screen.getByRole("alert")).getByText("Coche la case de l'accès immédiat au kit.")).toBeTruthy();
    expect(faux.creerCommande).not.toHaveBeenCalled();
  });
});
