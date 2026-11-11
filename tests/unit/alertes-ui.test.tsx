// @vitest-environment jsdom
// Story 7.3 : formulaire « Me prévenir » (choix du canal, consentement jamais pré-coché, confirmation seulement après l'enregistrement réel,
// erreurs reliées aux champs), lien sur les cartes, bloc de la page Événement et section « Alertes » de l'admin.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ action: vi.fn(), etatCompte: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/alertes/actions", () => ({ inscrireAlerteAction: (...a: unknown[]) => faux.action(...a) }));
vi.mock("@/lib/auth/compte", () => ({ lireEtatCompte: () => faux.etatCompte() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (arg: string | { locale: "fr" | "en"; namespace: string }) => {
      const { locale, namespace } = typeof arg === "string" ? { locale: "fr" as const, namespace: arg } : arg;
      return createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never });
    },
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { CarteEvenement } from "@/components/festival/CarteEvenement";
import { FormulairePrevenir } from "@/components/festival/FormulairePrevenir";
import { SectionAlertes } from "@/components/admin/SectionAlertes";
import type { CarteEvenement as Donnees } from "@/modules/evenements/types";

const P = fr.Festival.prevenir;
const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const erreur = (e: string, champs: Record<string, string> = {}, valeurs = { canal: "email", email: "a@example.invalid", whatsapp: "", consentement: true }) => ({ statut: "erreur", erreur: e, champs, valeurs });

beforeEach(() => {
  vi.clearAllMocks();
  faux.action.mockResolvedValue({ statut: "succes" });
});

describe("FormulairePrevenir", () => {
  it("au départ : trois choix si connecté, deux sinon ; aucun champ ; case de consentement absente tant qu'aucun choix n'est fait", () => {
    const { unmount } = rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["email", "compte", "whatsapp"]);
    expect(screen.queryByLabelText(P.email.libelle)).toBeNull();
    expect(screen.queryByLabelText(P.whatsapp.libelle)).toBeNull();
    unmount();
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["email", "whatsapp"]);
    expect(screen.queryByRole("radio", { name: P.canaux.compte })).toBeNull();
  });

  it("seul le champ du canal choisi s'affiche ; la case de consentement n'est jamais pré-cochée, avec le texte de Jonathan", async () => {
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte />);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.email }));
    expect(screen.getByLabelText(P.email.libelle)).toBeTruthy();
    expect(screen.queryByLabelText(P.whatsapp.libelle)).toBeNull();
    const case1 = screen.getByRole("checkbox", { name: P.consentement.email }) as HTMLInputElement;
    expect(case1.checked).toBe(false);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.whatsapp }));
    expect(screen.queryByLabelText(P.email.libelle)).toBeNull();
    expect(screen.getByLabelText(new RegExp(P.whatsapp.libelle))).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: P.consentement.whatsapp }) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.compte }));
    expect(screen.getByText(P.compte.aide)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: P.consentement.email }) as HTMLInputElement).checked).toBe(false);
  });

  it("anglais : texte du bouton et du consentement fournis par Jonathan", async () => {
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />, "en");
    await userEvent.click(screen.getByRole("radio", { name: en.Festival.prevenir.canaux.email }));
    expect(screen.getByRole("button", { name: "Notify me" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Email me when passes for this event go on sale. I can unsubscribe at any time." })).toBeTruthy();
  });

  it("la confirmation n'apparaît qu'après la réponse réelle de l'action ; l'action reçoit canal, adresse et consentement", async () => {
    let finir!: (v: unknown) => void;
    faux.action.mockImplementation(() => new Promise((ok) => (finir = ok)));
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.email }));
    await userEvent.type(screen.getByLabelText(P.email.libelle), "a@example.invalid");
    await userEvent.click(screen.getByRole("checkbox", { name: P.consentement.email }));
    await userEvent.click(screen.getByRole("button", { name: P.bouton }));
    await waitFor(() => expect(faux.action).toHaveBeenCalled());
    expect(screen.queryByText(P.succes)).toBeNull();
    const formData = faux.action.mock.calls[0][1] as FormData;
    expect(formData.get("canal")).toBe("email");
    expect(formData.get("email")).toBe("a@example.invalid");
    expect(formData.get("consentement")).toBe("on");
    expect(formData.get("evenementId")).toBe(EVENEMENT);
    finir({ statut: "succes" });
    expect(await screen.findByText(P.succes)).toBeTruthy();
  });

  it("échec : erreur reliée au champ (aria-invalid, aria-describedby), saisie conservée, jamais de confirmation", async () => {
    faux.action.mockResolvedValue(erreur("champs", { email: "email_invalide" }, { canal: "email", email: "pas-un-email", whatsapp: "", consentement: true }));
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.email }));
    await userEvent.type(screen.getByLabelText(P.email.libelle), "pas-un-email");
    await userEvent.click(screen.getByRole("button", { name: P.bouton }));
    const message = await screen.findByText(P.erreurs.email_invalide);
    const champ = screen.getByLabelText(P.email.libelle) as HTMLInputElement;
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toBe(message.id);
    expect(champ.value).toBe("pas-un-email");
    expect(screen.getByRole("alert").textContent).toContain(P.erreurs.resume);
    expect(screen.queryByText(P.succes)).toBeNull();
  });

  it("consentement manquant : erreur reliée à la case ; refus de la base (vente ouverte) : message sobre, pas de confirmation", async () => {
    faux.action.mockResolvedValueOnce(erreur("champs", { consentement: "consentement_requis" }, { canal: "email", email: "a@example.invalid", whatsapp: "", consentement: false }));
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.email }));
    await userEvent.click(screen.getByRole("button", { name: P.bouton }));
    const message = await screen.findByText(P.erreurs.consentement_requis);
    expect(screen.getByRole("checkbox").getAttribute("aria-describedby")).toContain(message.id);
    faux.action.mockResolvedValueOnce(erreur("vente_ouverte"));
    await userEvent.click(screen.getByRole("button", { name: P.bouton }));
    expect(await screen.findByText(P.erreurs.vente_ouverte)).toBeTruthy();
    expect(screen.queryByText(P.succes)).toBeNull();
  });

  it("WhatsApp : texte de consentement adapté, aide pour se désinscrire, champ téléphone", async () => {
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.whatsapp }));
    expect(screen.getByText(P.consentement.whatsappAide)).toBeTruthy();
    const champ = screen.getByLabelText(new RegExp(P.whatsapp.libelle)) as HTMLInputElement;
    expect(champ.type).toBe("tel");
  });
});

describe("FormulairePrevenir : accessibilité (correctifs de revue)", () => {
  it("groupe de choix : radiogroup avec aria-required", () => {
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    const groupe = screen.getByRole("radiogroup");
    expect(groupe.getAttribute("aria-required")).toBe("true");
  });

  it("après une erreur de champ, le focus va au résumé des erreurs", async () => {
    faux.action.mockResolvedValue(erreur("champs", { canal: "canal_requis" }, { canal: "", email: "", whatsapp: "", consentement: false }));
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    await userEvent.click(screen.getByRole("button", { name: P.bouton }));
    const resume = await screen.findByText(P.erreurs.resume);
    await waitFor(() => expect(document.activeElement).toBe(resume.parentElement));
  });

  it("au succès, le focus va sur la confirmation (role=status)", async () => {
    rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte={false} />);
    await userEvent.click(screen.getByRole("radio", { name: P.canaux.email }));
    await userEvent.type(screen.getByLabelText(P.email.libelle), "a@example.invalid");
    await userEvent.click(screen.getByRole("checkbox", { name: P.consentement.email }));
    await userEvent.click(screen.getByRole("button", { name: P.bouton }));
    const statut = await screen.findByRole("status");
    expect(statut.textContent).toContain(P.succes);
    await waitFor(() => expect(document.activeElement).toBe(statut.parentElement));
  });

  it("non connecté ou Compte incomplet : lien vers la connexion, focus sur le message", async () => {
    for (const code of ["non_connecte", "compte_incomplet"]) {
      faux.action.mockResolvedValue(erreur(code, {}, { canal: "compte", email: "", whatsapp: "", consentement: true }));
      const { unmount } = rendre(<FormulairePrevenir evenementId={EVENEMENT} connecte />);
      await userEvent.click(screen.getByRole("radio", { name: P.canaux.compte }));
      await userEvent.click(screen.getByRole("button", { name: P.bouton }));
      const lien = await screen.findByRole("link", { name: P.erreurs.lienConnexion });
      expect(lien.getAttribute("href")).toBe("/connexion");
      await waitFor(() => expect(document.activeElement).toBe(lien.parentElement));
      unmount();
    }
  });
});

describe("lien « Me prévenir » des cartes", () => {
  const carte = (venteAVenir: boolean): Donnees => ({
    id: EVENEMENT,
    slug: "test-evenement",
    titre: "TEST_Titre",
    debutLe: "2099-05-01T08:00:00+00:00",
    lieu: "TEST_Lieu",
    vignetteUrl: null,
    vignetteAlt: null,
    passe: false,
    venteAVenir,
  });

  it("vente à venir : un lien vers l'ancre #prevenir de la page de l'événement, avec le titre pour les lecteurs d'écran", () => {
    rendre(<CarteEvenement evenement={carte(true)} />);
    const lien = screen.getByRole("link", { name: /Me prévenir/ });
    expect(lien.getAttribute("href")).toBe("/festival/test-evenement#prevenir");
    expect(lien.textContent).toContain("TEST_Titre");
  });

  it("vente ouverte : aucun lien « Me prévenir »", () => {
    rendre(<CarteEvenement evenement={carte(false)} />);
    expect(screen.queryByRole("link", { name: /Me prévenir/ })).toBeNull();
  });
});

describe("BlocPrevenir (page de l'événement)", () => {
  it("ancre #prevenir, date d'ouverture, formulaire avec « Avec mon compte » seulement pour un Compte complet", async () => {
    const { BlocPrevenir } = await import("@/components/festival/BlocPrevenir");
    const { prerender } = await import("react-dom/static");
    const { NextIntlClientProvider } = await import("next-intl");
    async function html(connecte: string) {
      faux.etatCompte.mockResolvedValue(connecte);
      const element = await BlocPrevenir({ evenementId: EVENEMENT, venteOuvreLe: "2099-05-01T08:00:00+00:00", locale: "fr" });
      const { prelude } = await prerender(
        <NextIntlClientProvider locale="fr" messages={fr}>
          {element}
        </NextIntlClientProvider>,
      );
      const lecteur = prelude.getReader();
      let sortie = "";
      const decodeur = new TextDecoder();
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        sortie += decodeur.decode(value);
      }
      return sortie;
    }
    const anonyme = await html("anonyme");
    expect(anonyme).toContain('id="prevenir"');
    expect(anonyme).toContain(P.titre.replace("'", "&#x27;"));
    expect(anonyme).not.toContain(P.canaux.compte);
    expect(anonyme).toContain(P.canaux.email);
    expect(await html("complet")).toContain(P.canaux.compte);
    expect(await html("incomplet")).not.toContain(P.canaux.compte);
  });
});

describe("SectionAlertes (admin)", () => {
  it("nombres par canal et lien d'export CSV quand il y a des numéros WhatsApp", async () => {
    const element = await SectionAlertes({ evenementId: EVENEMENT, nombres: { email: 4, compte: 2, whatsapp: 3, desinscrits: 1 } });
    rendre(element);
    const A = fr.Admin.evenements.alertes;
    const liste = screen.getByText(A.email).closest("div") as HTMLElement;
    expect(within(liste).getByText("4")).toBeTruthy();
    const lien = screen.getByRole("link", { name: A.exporter });
    expect(lien.getAttribute("href")).toBe(`/api/admin/evenements/${EVENEMENT}/alertes-whatsapp`);
    expect(screen.queryByText(A.aucunNumero)).toBeNull();
  });

  it("aucun numéro : pas de lien d'export, message clair", async () => {
    const element = await SectionAlertes({ evenementId: EVENEMENT, nombres: { email: 0, compte: 0, whatsapp: 0, desinscrits: 0 } });
    rendre(element);
    expect(screen.queryByRole("link", { name: fr.Admin.evenements.alertes.exporter })).toBeNull();
    expect(screen.getByText(fr.Admin.evenements.alertes.aucunNumero)).toBeTruthy();
  });
});
