import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { rendreCommandePayee } from "@/modules/envois/modeles/commande-payee";
import { rendreKitOuvert } from "@/modules/envois/modeles/kit-ouvert";

const commande = {
  nomSite: "TEST_Boutique",
  numero: "KS-2026-000042",
  lignes: [
    { titre: "Costume TEST", nombre: 2, prixCents: 4990 },
    { titre: "Perruque <b>TEST</b>", nombre: 1, prixCents: 1500 },
  ],
  livraisonCents: 500,
  totalCents: 11980,
  url: "https://test.example.invalid/fr/commande/KS-2026-000042",
};

describe("modèles d'email", () => {
  it("commande payée en français : sujet, montants en USD, lien en texte", () => {
    const m = rendreCommandePayee("fr", commande);
    expect(m.sujet).toBe("Paiement reçu pour la commande KS-2026-000042");
    expect(m.texte).toContain("2 × Costume TEST");
    expect(m.texte).toMatch(/99,80/);
    expect(m.texte).toMatch(/119,80/);
    expect(m.texte).toMatch(/Livraison : .*5,00/);
    expect(m.texte).toContain(commande.url);
    expect(m.html).toContain('lang="fr"');
    expect(m.html).toContain("#E3261C");
  });

  it("commande payée en anglais", () => {
    const m = rendreCommandePayee("en", { ...commande, url: commande.url.replace("/fr/", "/en/") });
    expect(m.sujet).toBe("Payment received for order KS-2026-000042");
    expect(m.texte).toContain("$119.80");
    expect(m.html).toContain('lang="en"');
  });

  it("Code promo (story 9.2) : la réduction est écrite entre les articles et le total, dans les deux langues ; rien sans réduction", () => {
    const fr = rendreCommandePayee("fr", { ...commande, reductionCents: 1198, totalCents: 10782 });
    expect(fr.texte).toMatch(/Réduction du code promo : −11,98/);
    expect(fr.texte).toMatch(/107,82/);
    const en = rendreCommandePayee("en", { ...commande, reductionCents: 1198, totalCents: 10782 });
    expect(en.texte).toContain("Promo code discount: −$11.98");
    expect(rendreCommandePayee("fr", commande).texte).not.toContain("Réduction");
  });

  it("pas de ligne de livraison quand elle est gratuite", () => {
    const m = rendreCommandePayee("fr", { ...commande, livraisonCents: 0 });
    expect(m.texte).not.toContain("Livraison");
  });

  it("le HTML échappe les titres venus de la base", () => {
    const m = rendreCommandePayee("fr", commande);
    expect(m.html).not.toContain("<b>TEST</b>");
    expect(m.html).toContain("&lt;b&gt;TEST&lt;/b&gt;");
  });

  it("kit ouvert dans les deux langues, avec le lien du kit", () => {
    const d = { nomSite: "TEST_Boutique", numero: "KS-2026-000043", titreKit: "Kit TEST", url: "https://test.example.invalid/fr/kits/kit-test" };
    const f = rendreKitOuvert("fr", d);
    expect(f.sujet).toBe("Ton kit est ouvert : Kit TEST");
    expect(f.texte).toContain(d.url);
    const e = rendreKitOuvert("en", d);
    expect(e.sujet).toBe("Your kit is open: Kit TEST");
  });

  it("aucun emoji dans les textes", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    expect(emoji.test(JSON.stringify(fr.Emails))).toBe(false);
    expect(emoji.test(JSON.stringify(en.Emails))).toBe(false);
  });

  it("français et anglais ont les mêmes clés d'email", () => {
    const cles = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? cles(v).map((c) => `${k}.${c}`) : [k]));
    expect(cles(fr.Emails)).toEqual(cles(en.Emails));
  });
});
