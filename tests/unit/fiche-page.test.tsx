import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

const faux = vi.hoisted(() => ({
  fiche: vi.fn(),
  forfait: vi.fn(),
  retrait: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));
vi.mock("@/modules/catalogue/queries", () => ({ lireFicheProduit: (...a: unknown[]) => faux.fiche(...a) }));
vi.mock("@/lib/reglages", () => ({
  lireNomSite: async () => "TEST_Boutique",
  lireForfaitLivraison: (...a: unknown[]) => faux.forfait(...a),
  lireRetraitGoma: (...a: unknown[]) => faux.retrait(...a),
}));
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
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});

import { metadataFiche, PageFiche } from "@/components/fiche/PageFiche";
import type { FicheProduit } from "@/modules/catalogue/types";

function fiche(surcharge: Partial<FicheProduit> = {}): FicheProduit {
  return {
    id: "TEST_p1",
    slug: "test-produit",
    famille: "cosplay",
    titre: "TEST_Titre",
    description: "TEST_Description du produit.",
    prixCents: 4990,
    photos: [
      { url: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/p1/a.jpg", alt: "TEST_Alt 1" },
      { url: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/p1/b.jpg", alt: "TEST_Alt 2" },
    ],
    tailles: [
      { taille: "M", etat: "en_stock", delaiJours: null },
      { taille: "L", etat: "sur_commande", delaiJours: 12 },
    ],
    ...surcharge,
  };
}

async function html(element: ReactElement, locale: "fr" | "en" = "fr"): Promise<string> {
  const { prelude } = await prerender(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      {element}
    </NextIntlClientProvider>,
  );
  const lecteur = prelude.getReader();
  const morceaux: string[] = [];
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(new TextDecoder().decode(value));
  }
  return morceaux.join("");
}

const rendre = async (famille: "cosplay" | "accessoire" = "cosplay", locale: "fr" | "en" = "fr") =>
  html(await PageFiche({ famille, locale, slug: "test-produit" }), locale);

beforeEach(() => {
  faux.fiche.mockReset().mockResolvedValue(fiche());
  faux.forfait.mockReset().mockImplementation(async (ville: string) => (ville === "goma" ? 500 : null));
  faux.retrait.mockReset().mockResolvedValue("TEST_Lieu de retrait");
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PageFiche", () => {
  it("fiche complète : titre, prix USD, description, fil d'Ariane, bandeau avant la zone d'achat, modes de remise", async () => {
    const page = await rendre();
    expect(page).toContain("TEST_Titre");
    expect((page.match(/<h1/g) ?? []).length).toBe(1);
    expect(page).toContain("49,90");
    expect(page).toContain("TEST_Description du produit.");
    expect(page).toContain('aria-label="Fil d&#x27;Ariane"');
    expect(page).toContain('href="/cosplays"');
    expect(page.indexOf("Remise uniquement à Goma et Bukavu")).toBeGreaterThan(-1);
    expect(page.indexOf("Remise uniquement à Goma et Bukavu")).toBeLessThan(page.indexOf("Taille"));
    expect(page).toContain("Retrait gratuit : TEST_Lieu de retrait");
    expect(page).toContain("Photo 1 sur 2");
    expect(page).not.toMatch(/Épuisé/i);
  });

  it("JSON-LD : Product + Offer (USD, URL de la fiche, disponibilité) et BreadcrumbList, jamais de note ni d'avis", async () => {
    const page = await rendre();
    const blocs = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"')));
    const produit = blocs.find((b) => b["@type"] === "Product");
    expect(produit).toMatchObject({
      name: "TEST_Titre",
      offers: { "@type": "Offer", price: "49.90", priceCurrency: "USD", url: "http://localhost:3000/fr/cosplays/test-produit", availability: "https://schema.org/InStock" },
    });
    expect(produit.image).toHaveLength(2);
    const fil = blocs.find((b) => b["@type"] === "BreadcrumbList");
    expect(fil.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Accueil", "Cosplays", "TEST_Titre"]);
    expect(JSON.stringify(blocs)).not.toMatch(/rating|review|aggregate/i);
  });

  it("disponibilité schema.org : MadeToOrder, puis OutOfStock", async () => {
    faux.fiche.mockResolvedValue(fiche({ tailles: [{ taille: "L", etat: "sur_commande", delaiJours: 12 }] }));
    expect(await rendre()).toContain("https://schema.org/MadeToOrder");
    faux.fiche.mockResolvedValue(fiche({ tailles: [{ taille: "L", etat: "complet", delaiJours: 12 }] }));
    const page = await rendre();
    expect(page).toContain("https://schema.org/OutOfStock");
    expect(page).toContain("Commandes complètes pour le moment");
  });

  it("accessoire en anglais : adresse propre /en/accessories dans le JSON-LD, textes anglais", async () => {
    faux.fiche.mockResolvedValue(fiche({ famille: "accessoire" }));
    const page = await rendre("accessoire", "en");
    expect(page).toContain("http://localhost:3000/en/accessories/test-produit");
    expect(page).toContain('href="/accessories"');
    expect(page).toContain("Handover only in Goma and Bukavu");
    expect(page).toContain("$49.90");
  });

  it("forfait de Bukavu et retrait non réglés : rien d'inventé", async () => {
    faux.retrait.mockResolvedValue(null);
    const page = await rendre();
    expect(page).not.toContain("Retrait gratuit");
    expect((page.match(/Livraison : /g) ?? []).length).toBe(1);
  });

  it("lecture d'un réglage de remise impossible : la fiche reste, sans forfait ni lieu", async () => {
    faux.forfait.mockRejectedValue(new Error("TEST"));
    faux.retrait.mockRejectedValue(new Error("TEST"));
    const page = await rendre();
    expect(page).toContain("TEST_Titre");
    expect(page).not.toContain("Livraison : ");
    expect(page).not.toContain("Retrait gratuit");
  });

  it("description avec le marqueur « [Texte à fournir] » : non affichée", async () => {
    faux.fiche.mockResolvedValue(fiche({ description: "Début [Texte à fournir]" }));
    const page = await rendre();
    expect(page).not.toContain("Texte à fournir");
  });

  it("produit introuvable (brouillon, dépublié, autre famille) : 404", async () => {
    faux.fiche.mockResolvedValue(null);
    await expect(rendre()).rejects.toThrow("TEST_NOT_FOUND");
    expect(faux.fiche).toHaveBeenCalledWith("cosplay", "test-produit", "fr");
  });

  it("base indisponible : message d'erreur sobre, jamais une fiche inventée", async () => {
    faux.fiche.mockRejectedValue(new Error("TEST"));
    const page = await rendre();
    expect(page).toContain('role="alert"');
    expect(page).toContain("Cette fiche est indisponible pour le moment");
    expect(page).not.toContain("<h1");
  });
});

describe("metadataFiche", () => {
  it("titre, description du produit, canonique et hreflang à l'adresse propre de chaque langue, Open Graph avec la première photo, twitter:card", async () => {
    faux.fiche.mockResolvedValue(fiche({ famille: "accessoire" }));
    const m = await metadataFiche({ famille: "accessoire", locale: "en", slug: "test-produit" });
    expect(m.title).toBe("TEST_Titre | TEST_Boutique");
    expect(m.description).toBe("TEST_Description du produit.");
    expect(m.alternates?.canonical).toBe("http://localhost:3000/en/accessories/test-produit");
    expect(m.alternates?.languages).toEqual({
      fr: "http://localhost:3000/fr/accessoires/test-produit",
      en: "http://localhost:3000/en/accessories/test-produit",
      "x-default": "http://localhost:3000/fr/accessoires/test-produit",
    });
    expect(m.openGraph?.images).toEqual([{ url: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/p1/a.jpg", alt: "TEST_Alt 1" }]);
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("description absente ou avec le marqueur : texte de repli du produit, jamais le marqueur", async () => {
    faux.fiche.mockResolvedValue(fiche({ description: "[Texte à fournir]" }));
    const m = await metadataFiche({ famille: "cosplay", locale: "fr", slug: "test-produit" });
    expect(m.description).toBe("TEST_Titre sur TEST_Boutique. Remise à Goma et Bukavu.");
    expect(String(m.description)).not.toContain("Texte à fournir");
  });

  it("produit introuvable : 404", async () => {
    faux.fiche.mockResolvedValue(null);
    await expect(metadataFiche({ famille: "cosplay", locale: "fr", slug: "inconnu" })).rejects.toThrow("TEST_NOT_FOUND");
  });

  it("lecture impossible : page non indexée", async () => {
    faux.fiche.mockRejectedValue(new Error("TEST"));
    const m = await metadataFiche({ famille: "cosplay", locale: "fr", slug: "test-produit" });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
