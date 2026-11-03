// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { EnvoiMesures } from "@/components/commande/EnvoiMesures";
import { rendreCommandePayee } from "@/modules/envois/modeles/commande-payee";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";
import fr from "../../messages/fr.json";

afterEach(cleanup);
const NUMERO = "KS-2026-000042";

function rendre(numeroWhatsapp: string | null, mesuresRecuesLe: string | null = null) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <EnvoiMesures numero={NUMERO} numeroWhatsapp={numeroWhatsapp} mesuresRecuesLe={mesuresRecuesLe} locale="fr" />
    </NextIntlClientProvider>,
  );
}

describe("lienWhatsapp avec message (story 6.4)", () => {
  it("le message prérempli est encodé dans l'adresse", () => {
    expect(lienWhatsapp("+243000000000", "Bonjour & merci")).toBe("https://wa.me/243000000000?text=Bonjour%20%26%20merci");
  });
  it("sans message : adresse inchangée ; numéro mal formé : aucun lien", () => {
    expect(lienWhatsapp("+243000000000")).toBe("https://wa.me/243000000000");
    expect(lienWhatsapp("0000", "x")).toBeNull();
  });
});

describe("EnvoiMesures (story 6.4)", () => {
  it("numéro réglé : bouton vers WhatsApp avec le numéro de commande dans le message, délai visible à côté", () => {
    rendre("+243000000000");
    const lien = screen.getByRole("link", { name: /Envoyer mes mesures sur WhatsApp/ });
    const href = lien.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/243000000000?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain(NUMERO);
    expect(screen.getByText("Le délai de fabrication court à partir de la réception de tes mesures.")).toBeTruthy();
  });
  it("numéro absent : aucun lien, message qui invite à contacter (jamais de numéro de repli)", () => {
    rendre(null);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/Écris-nous depuis la page Contact/)).toBeTruthy();
  });
  it("mesures reçues : la date de réception remplace le bouton (story 6.5)", () => {
    rendre("+243000000000", "2026-11-05T10:00:00Z");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/Tes mesures ont été reçues le/)).toBeTruthy();
  });
});

describe("email de confirmation avec une ligne Sur-mesure (story 6.4)", () => {
  const base = { nomSite: "TEST_site", numero: NUMERO, lignes: [{ titre: "TEST", nombre: 1, prixCents: 5000 }], livraisonCents: 0, totalCents: 5000, url: "https://TEST.invalid/fr/commande/x" };
  it("lien WhatsApp et délai écrits ; sans numéro, invitation à contacter ; sans Sur-mesure, rien", () => {
    expect(rendreCommandePayee("fr", { ...base, mesures: { lien: "https://wa.me/243000000000?text=x" } }).texte).toContain("https://wa.me/243000000000?text=x");
    expect(rendreCommandePayee("fr", { ...base, mesures: { lien: null } }).texte).toContain("page Contact");
    expect(rendreCommandePayee("fr", base).texte).not.toMatch(/mesures/i);
  });
});
