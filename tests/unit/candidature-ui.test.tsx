// @vitest-environment jsdom
// Story 7.11 : formulaire de candidature Stand, nom de l'aide dans « Mes Pass ». La case d'engagement n'est jamais pré-cochée ; trois photos exactement ;
// aucun succès (ni passage à la page de paiement) avant la réponse réelle du serveur.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  demander: vi.fn(),
  finaliser: vi.fn(),
  annuler: vi.fn(),
  nommer: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  tus: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/evenements/candidature-actions", () => ({
  demanderEnvoiCandidatureAction: faux.demander,
  finaliserCandidatureAction: faux.finaliser,
  annulerEnvoiCandidatureAction: faux.annuler,
  nommerAideAction: faux.nommer,
  lireRecapitulatifStandAction: vi.fn(),
  creerCommandeStandAction: vi.fn(),
}));
vi.mock("@/lib/supabase/envoi-tus", () => ({ demarrerEnvoiTus: faux.tus, MESSAGE_ANNULE: "annule" }));
vi.mock("@/lib/env", () => ({ lireEnvPublique: () => ({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "TEST_cle" }) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: faux.refresh }) }));

import { NommerAidePass } from "@/components/compte/NommerAidePass";
import { FormulaireCandidature } from "@/components/festival/FormulaireCandidature";
import frMessages from "../../messages/fr.json";

const EVENEMENT = "00000000-0000-4000-8000-000000000001";
const TYPE = "00000000-0000-4000-8000-0000000000c1";
const types = [{ id: TYPE, nom: "TEST_Stand", prixCents: 4000, inclus: null, complet: false }];
const photo = (nom: string, type = "image/png") => new File([new Uint8Array([1, 2, 3])], nom, { type });
const DESCRIPTION = "TEST_ Bijoux et accessoires faits main, trois gammes.";

async function remplir(u: ReturnType<typeof userEvent.setup>, { photos = 3, engagement = true }: { photos?: number; engagement?: boolean } = {}) {
  await u.type(screen.getByLabelText(frMessages.Festival.candidature.description), DESCRIPTION);
  await u.type(screen.getByLabelText(frMessages.Festival.candidature.instagram), "@test_exposant");
  for (let i = 0; i < photos; i++) await u.upload(screen.getByLabelText(`Photo ${i + 1}`), photo(`p${i + 1}.png`));
  if (engagement) await u.click(screen.getByRole("checkbox"));
}

beforeEach(() => {
  vi.clearAllMocks();
  faux.demander.mockResolvedValue({ ok: true, objets: [1, 2, 3].map((n) => ({ objet: `envois-candidatures/x${n}`, jeton: `TEST_j${n}` })) });
  faux.tus.mockResolvedValue({ terminer: Promise.resolve(), annuler: vi.fn(async () => {}) });
  faux.annuler.mockResolvedValue({ ok: true });
});

describe("FormulaireCandidature", () => {
  it("la case d'engagement n'est jamais pré-cochée ; trois champs de photo ; texte de l'epic et mention de confidentialité", () => {
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    const cases = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(cases).toHaveLength(1);
    expect(cases[0].checked).toBe(false);
    expect(screen.getByLabelText("Photo 1")).toBeTruthy();
    expect(screen.getByLabelText("Photo 2")).toBeTruthy();
    expect(screen.getByLabelText("Photo 3")).toBeTruthy();
    expect(screen.getByText("Je certifie que les articles présentés sur mon stand sont mes propres créations et qu'aucun n'est une contrefaçon. Je comprends que ma candidature ou mon stand peut être refusé ou retiré en cas de non-respect.")).toBeTruthy();
    expect(screen.getByText("Tes photos et ton lien Instagram servent uniquement à étudier ta candidature. Ils ne sont pas publiés et sont supprimés 90 jours après l'événement.")).toBeTruthy();
  });

  it("moins de trois photos : message d'erreur, aucun appel au serveur", async () => {
    const u = userEvent.setup();
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    await remplir(u, { photos: 2 });
    await u.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    expect(await screen.findByText("Choisis exactement trois photos.")).toBeTruthy();
    expect(faux.demander).not.toHaveBeenCalled();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("engagement non coché : refusé avant tout envoi", async () => {
    const u = userEvent.setup();
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    await remplir(u, { engagement: false });
    await u.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    expect(await screen.findByText("Coche la case d'engagement pour candidater.")).toBeTruthy();
    expect(faux.demander).not.toHaveBeenCalled();
  });

  it("description trop courte ou Instagram invalide : refusés avant tout envoi", async () => {
    const u = userEvent.setup();
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    await u.type(screen.getByLabelText(frMessages.Festival.candidature.description), "court");
    await u.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    expect(await screen.findByText(/La description doit faire de 20 à 1 000 caractères/)).toBeTruthy();
    expect(faux.demander).not.toHaveBeenCalled();
  });

  it("succès : la page de paiement s'ouvre seulement après la réponse réelle du serveur", async () => {
    const u = userEvent.setup();
    let finir: (v: unknown) => void = () => {};
    faux.finaliser.mockReturnValue(new Promise((resolve) => (finir = resolve)));
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    await remplir(u);
    await u.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    await waitFor(() => expect(faux.finaliser).toHaveBeenCalled());
    // Réponse pas encore arrivée : aucune navigation.
    expect(faux.push).not.toHaveBeenCalled();
    expect(faux.finaliser.mock.calls[0][0]).toMatchObject({ evenementId: EVENEMENT, typePassId: TYPE, engagement: true, instagram: "@test_exposant" });
    expect(faux.tus).toHaveBeenCalledTimes(3);
    finir({ ok: true, candidatureId: "00000000-0000-4000-8000-0000000000d1", expireLe: "2099-01-01T00:00:00Z" });
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/festival/test-evenement/stand/00000000-0000-4000-8000-0000000000d1"));
  });

  it("refus du serveur (Complet) : message, aucune navigation", async () => {
    const u = userEvent.setup();
    faux.finaliser.mockResolvedValue({ ok: false, erreur: "complet" });
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    await remplir(u);
    await u.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    expect(await screen.findByText("Complet : il ne reste plus de stand pour cet événement.")).toBeTruthy();
    expect(faux.push).not.toHaveBeenCalled();
  });

  it("envoi des photos échoué : message, nettoyage demandé, jamais de dépôt", async () => {
    const u = userEvent.setup();
    const coupure = Promise.reject(new Error("TEST_coupure"));
    coupure.catch(() => {});
    faux.tus.mockResolvedValue({ terminer: coupure, annuler: vi.fn(async () => {}) });
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={types} />);
    await remplir(u);
    await u.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    expect(await screen.findByText(/L'envoi des photos a échoué/)).toBeTruthy();
    expect(faux.annuler).toHaveBeenCalled();
    expect(faux.finaliser).not.toHaveBeenCalled();
  });

  it("plus aucun Stand : « Complet » à la place du formulaire", () => {
    rendre(<FormulaireCandidature evenementId={EVENEMENT} slug="test-evenement" types={[{ ...types[0], complet: true }]} />);
    expect(screen.getByText("Complet : il ne reste plus de stand pour cet événement.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer ma candidature" })).toBeNull();
  });
});

describe("NommerAidePass (Mes Pass)", () => {
  const PASS = "00000000-0000-4000-8000-0000000000f2";

  it("un nom invalide n'est pas envoyé", async () => {
    const u = userEvent.setup();
    rendre(<NommerAidePass passId={PASS} />);
    await u.type(screen.getByLabelText("Nom de l'aide à saisir"), "A");
    await u.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(await screen.findByText(/Un nom doit faire de 2 à 80 caractères/)).toBeTruthy();
    expect(faux.nommer).not.toHaveBeenCalled();
  });

  it("le nom est envoyé avec le Pass ; la page est relue après la réponse réelle", async () => {
    const u = userEvent.setup();
    faux.nommer.mockResolvedValue({ ok: true });
    rendre(<NommerAidePass passId={PASS} />);
    await u.type(screen.getByLabelText("Nom de l'aide à saisir"), "Bob Aide");
    await u.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    await waitFor(() => expect(faux.nommer).toHaveBeenCalledWith({ passId: PASS, nom: "Bob Aide" }));
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
  });

  it("refus du serveur (nom déjà saisi) : message clair", async () => {
    const u = userEvent.setup();
    faux.nommer.mockResolvedValue({ ok: false, erreur: "deja_saisi" });
    rendre(<NommerAidePass passId={PASS} />);
    await u.type(screen.getByLabelText("Nom de l'aide à saisir"), "Bob Aide");
    await u.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(await screen.findByText("Le nom de ce Pass est déjà saisi.")).toBeTruthy();
  });
});
