// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { versSaisieBoutique } from "@/lib/dates";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  enregistrerEvenementAction: vi.fn(),
  publierEvenementAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/evenements/actions", () => ({
  enregistrerEvenementAction: (...a: unknown[]) => faux.enregistrerEvenementAction(...a),
  publierEvenementAction: (...a: unknown[]) => faux.publierEvenementAction(...a),
  demanderEnvoiImageEvenement: vi.fn(),
  finaliserImageEvenement: vi.fn(),
  annulerEnvoiImageEvenement: vi.fn(),
}));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: async () => ({ terminer: Promise.resolve(), annuler: async () => {} }) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push, refresh: faux.refresh }),
  usePathname: () => "/admin/evenements",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { FormulaireEvenement } from "@/components/admin/FormulaireEvenement";
import { PublicationEvenement } from "@/components/admin/PublicationEvenement";
import type { Evenement } from "@/modules/evenements/types";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
});

const EVENEMENT: Evenement = {
  id: "00000000-0000-4000-8000-0000000000e2",
  titreFr: "TEST_Festival",
  titreEn: "TEST_Festival EN",
  slug: "test-festival",
  descriptionFr: "Programme",
  descriptionEn: "Programme EN",
  lieuType: "plein_air",
  lieuFr: "TEST_Lieu",
  lieuEn: "TEST_Place",
  // 2027-03-14 08:00 UTC = 10:00 à Goma.
  debutLe: "2027-03-14T08:00:00.000Z",
  finLe: null,
  capacite: 500,
  venteOuvreLe: null,
  venteFermeLe: null,
  images: [],
  publieLe: null,
  modifieLe: "2026-11-10T10:00:00.000Z",
  types: [
    { id: "00000000-0000-4000-8000-0000000000f1", nomFr: "TEST_Standard", nomEn: "TEST_Standard EN", prixCents: 1550, quota: 200, inclusFr: "Entrée", inclusEn: "Entry", estStand: false },
  ],
};

describe("versSaisieBoutique", () => {
  it("instant UTC → heure de Goma (UTC+2), format datetime-local", () => {
    expect(versSaisieBoutique("2027-03-14T08:00:00.000Z")).toBe("2027-03-14T10:00");
    expect(versSaisieBoutique("2027-03-14T23:30:00.000Z")).toBe("2027-03-15T01:30");
  });
  it("absent ou invalide : champ vide", () => {
    expect(versSaisieBoutique(null)).toBe("");
    expect(versSaisieBoutique("n'importe quoi")).toBe("");
  });
});

describe("FormulaireEvenement", () => {
  it("création : aucun Type de pass ni valeur par défaut ; les photos s'ajoutent après la création", () => {
    rendre(<FormulaireEvenement evenement={null} />);
    expect(screen.getByText("Aucun Type de pass pour le moment.")).toBeTruthy();
    expect((screen.getByLabelText("Début de l'événement") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Capacité/) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Les photos s'ajoutent une fois l'événement créé.")).toBeTruthy();
  });

  it("modification : valeurs relues, date affichée à l'heure de Goma, Type de pass rempli", () => {
    rendre(<FormulaireEvenement evenement={EVENEMENT} />);
    expect((screen.getByLabelText("Début de l'événement") as HTMLInputElement).value).toBe("2027-03-14T10:00");
    expect((screen.getByLabelText("Prix (USD)") as HTMLInputElement).value).toBe("15.50");
    expect((screen.getByLabelText("Quota (nombre de Pass)") as HTMLInputElement).value).toBe("200");
    expect(screen.getByRole("heading", { name: "Photos" })).toBeTruthy();
  });

  it("ajouter un Type de pass, cocher Stand : le quota devient « Nombre de Stands disponibles » ; retirer le supprime", async () => {
    const user = userEvent.setup();
    rendre(<FormulaireEvenement evenement={null} />);
    await user.click(screen.getByRole("button", { name: "Ajouter un Type de pass" }));
    expect(screen.getByLabelText("Quota (nombre de Pass)")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Stand" }));
    expect(screen.getByLabelText("Nombre de Stands disponibles")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retirer le Type de pass 1" }));
    expect(screen.getByText("Aucun Type de pass pour le moment.")).toBeTruthy();
  });

  it("enregistrement : l'action reçoit la saisie telle quelle (dates sans fuseau, Type avec prix en USD) ; création → fiche d'édition", async () => {
    faux.enregistrerEvenementAction.mockResolvedValue({ statut: "succes", id: "TEST_id", cree: true });
    const user = userEvent.setup();
    rendre(<FormulaireEvenement evenement={null} />);
    await user.type(screen.getByLabelText("Titre en français"), "TEST_Mon festival");
    await user.click(screen.getByRole("button", { name: "Ajouter un Type de pass" }));
    await user.type(screen.getByLabelText("Nom en français"), "TEST_Stand");
    await user.type(screen.getByLabelText("Prix (USD)"), "120");
    await user.click(screen.getByRole("checkbox", { name: "Stand" }));
    await user.type(screen.getByLabelText("Nombre de Stands disponibles"), "10");
    await user.click(screen.getByRole("button", { name: "Enregistrer l'événement" }));
    await waitFor(() => expect(faux.enregistrerEvenementAction).toHaveBeenCalledTimes(1));
    const envoi = faux.enregistrerEvenementAction.mock.calls[0][0];
    expect(envoi.id).toBeNull();
    expect(envoi.evenement).toMatchObject({ titreFr: "TEST_Mon festival", slug: "test-mon-festival", debut: null, capacite: null });
    expect(envoi.evenement.types).toEqual([
      expect.objectContaining({ id: null, nomFr: "TEST_Stand", nomEn: null, prixUsd: "120", quota: "10", estStand: true }),
    ]);
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/admin/evenements/TEST_id?cree=1"));
  });

  it("échec : message d'erreur du champ concerné, saisie conservée, jamais de succès", async () => {
    faux.enregistrerEvenementAction.mockResolvedValue({ statut: "erreur", erreur: "slug_pris" });
    const user = userEvent.setup();
    rendre(<FormulaireEvenement evenement={EVENEMENT} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer l'événement" }));
    expect(await screen.findByText("Cette adresse est déjà utilisée par un autre événement.")).toBeTruthy();
    expect((screen.getByLabelText("Titre en français") as HTMLInputElement).value).toBe("TEST_Festival");
    expect(screen.queryByText("Événement enregistré.")).toBeNull();
  });

  it("modification réussie : confirmation seulement après la réponse du serveur", async () => {
    faux.enregistrerEvenementAction.mockResolvedValue({ statut: "succes", id: EVENEMENT.id, cree: false });
    const user = userEvent.setup();
    rendre(<FormulaireEvenement evenement={EVENEMENT} />);
    expect(screen.queryByText("Événement enregistré.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enregistrer l'événement" }));
    expect(await screen.findByText("Événement enregistré.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
    expect(faux.enregistrerEvenementAction.mock.calls[0][0].evenement.types[0]).toMatchObject({ id: "00000000-0000-4000-8000-0000000000f1", prixUsd: "15.50" });
  });
});

describe("PublicationEvenement", () => {
  it("brouillon incomplet : liste de ce qui manque, lue en base", () => {
    rendre(<PublicationEvenement evenementId={EVENEMENT.id} publie={false} manques={["titre_en", "photo"]} />);
    const liste = screen.getByText("Pour publier, il manque :").parentElement!;
    expect(within(liste).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["le titre en anglais", "au moins une photo, chacune avec ses textes alternatifs"]);
  });

  it("publication : succès affiché seulement après la réponse ; refus : liste du serveur et message", async () => {
    faux.publierEvenementAction.mockResolvedValueOnce({ statut: "erreur", erreur: "publication_incomplete", manques: ["date"] });
    const user = userEvent.setup();
    rendre(<PublicationEvenement evenementId={EVENEMENT.id} publie={false} manques={[]} />);
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByText("La publication est refusée : des éléments manquent (liste ci-dessus).")).toBeTruthy();
    expect(screen.getByText("la date de début")).toBeTruthy();
    expect(screen.queryByText("Événement publié.")).toBeNull();
    faux.publierEvenementAction.mockResolvedValueOnce({ statut: "succes", id: EVENEMENT.id, cree: false });
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByText("Événement publié.")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("publié : bouton Dépublier ; s'il n'est plus complet, la liste de ce qui manque est montrée", () => {
    rendre(<PublicationEvenement evenementId={EVENEMENT.id} publie manques={["photo"]} />);
    expect(screen.getByRole("button", { name: "Dépublier" })).toBeTruthy();
    expect(screen.getByText("Cet événement est publié mais il n'est plus complet. Il manque :")).toBeTruthy();
    expect(screen.queryByText("Pour publier, il manque :")).toBeNull();
  });

  it("refus : le focus va sur le message d'erreur", async () => {
    faux.publierEvenementAction.mockResolvedValue({ statut: "erreur", erreur: "generique" });
    const user = userEvent.setup();
    rendre(<PublicationEvenement evenementId={EVENEMENT.id} publie={false} manques={[]} />);
    await user.click(screen.getByRole("button", { name: "Publier" }));
    const message = await screen.findByText("Le changement n'a pas pu être enregistré. Réessaie.");
    await waitFor(() => expect(message.closest("[tabindex='-1']")).toBe(document.activeElement));
  });
});
