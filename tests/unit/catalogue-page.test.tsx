import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

const faux = vi.hoisted(() => ({
  lister: vi.fn(),
  univers: vi.fn(),
  tranches: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("@/modules/catalogue/queries", () => ({
  listerCatalogue: (...a: unknown[]) => faux.lister(...a),
  lireUniversPublics: (...a: unknown[]) => faux.univers(...a),
  lireTranchesPrix: (...a: unknown[]) => faux.tranches(...a),
}));
vi.mock("@/modules/catalogue/voir-plus", () => ({ chargerPlusProduits: vi.fn() }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => "TEST_Boutique" }));
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

import { metadataCatalogue, PageCatalogue } from "@/components/catalogue/PageCatalogue";
import type { CarteProduit } from "@/modules/catalogue/types";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function carte(n: number): CarteProduit {
  return {
    id: ID(n),
    slug: `test-produit-${n}`,
    famille: "cosplay",
    titre: `TEST_Titre ${n}`,
    photoAlt: `TEST_Alt ${n}`,
    photoUrl: `http://127.0.0.1:54321/storage/v1/object/public/produits-public/${n}/a.jpg`,
    prixCents: 4990,
    disponibilite: n % 2 === 0 ? "sur_commande" : "disponible",
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

const rendre = async (requete: Record<string, string>, famille: "cosplay" | "accessoire" = "cosplay", locale: "fr" | "en" = "fr") =>
  html(<PageCatalogue famille={famille} locale={locale} searchParams={Promise.resolve(requete)} />, locale);

beforeEach(() => {
  faux.lister.mockReset();
  faux.univers.mockReset().mockResolvedValue([]);
  faux.tranches.mockReset().mockResolvedValue([]);
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PageCatalogue", () => {
  it("12 produits : grille, nombre annoncé, « Voir plus » portant le curseur, fil d'Ariane et BreadcrumbList", async () => {
    faux.lister.mockResolvedValue({ produits: Array.from({ length: 12 }, (_, i) => carte(i + 1)), suite: "CUR1" });
    const page = await rendre({});
    expect(page).toContain("<h1");
    expect((page.match(/<h3/g) ?? []).length).toBe(12);
    expect(page).toContain("12 produits affichés, il y en a d&#x27;autres");
    expect(page).toContain('href="/cosplays?curseur=CUR1"');
    expect(page).toContain('href="/cosplays/test-produit-1"');
    expect(page).toContain("BreadcrumbList");
    expect(page).toContain('aria-label="Fil d&#x27;Ariane"');
    expect(page).toContain("49,90");
    expect(page).not.toMatch(/Épuisé/i);
  });

  it("aucun produit publié : une phrase courte, pas de filtre", async () => {
    faux.lister.mockResolvedValue({ produits: [], suite: null });
    const page = await rendre({});
    expect(page).toContain("Aucun produit n&#x27;est en vente pour le moment");
    expect(page).not.toContain("<details");
    expect(page).not.toContain("Effacer les filtres");
  });

  it("filtre trop strict : phrase courte, filtres et « Effacer les filtres »", async () => {
    faux.lister.mockResolvedValue({ produits: [], suite: null });
    const page = await rendre({ dispo: "en_stock" });
    expect(page).toContain("Aucun produit ne correspond à ces filtres");
    expect(page).toContain("Effacer les filtres");
    expect(page).toContain("<details");
  });

  it("base indisponible : message d'erreur sobre, jamais une liste vide inventée", async () => {
    faux.lister.mockRejectedValue(new Error("TEST"));
    const page = await rendre({});
    expect(page).toContain('role="alert"');
    expect(page).toContain("Le catalogue est indisponible pour le moment");
    expect(page).not.toContain("Aucun produit");
  });

  const CURSEUR = Buffer.from(JSON.stringify(["nouveautes", "2026-10-26 10:00:00+00", ID(9), 12]), "utf8").toString("base64url");

  it("page à curseur : liste cumulée (lecture en cumul depuis le début), lien suivant et liste complète", async () => {
    faux.lister.mockResolvedValue({ produits: Array.from({ length: 24 }, (_, i) => carte(i + 1)), suite: "CUR24" });
    const page = await rendre({ curseur: CURSEUR });
    expect(faux.lister).toHaveBeenCalledTimes(1);
    expect(faux.lister.mock.calls[0][1].curseur).toMatchObject({ id: ID(9), n: 12 });
    expect(faux.lister.mock.calls[0][3]).toEqual({ cumul: true });
    expect((page.match(/<h3/g) ?? []).length).toBe(24);
    expect(page).toContain("24 produits affichés, il y en a d&#x27;autres");
    expect(page).toContain('href="/cosplays?curseur=CUR24"');
  });

  it("curseur périmé (rien après lui) : retour à la première page", async () => {
    faux.lister.mockResolvedValueOnce({ produits: [], suite: null }).mockResolvedValueOnce({ produits: [carte(1)], suite: null });
    const page = await rendre({ curseur: CURSEUR });
    expect(faux.lister).toHaveBeenCalledTimes(2);
    expect(faux.lister.mock.calls[1][1].curseur).toBeNull();
    expect(page).toContain("TEST_Titre 1");
  });

  it("catalogue réellement vide avec un curseur périmé : phrase « vide », pas « aucun résultat pour ces filtres »", async () => {
    faux.lister.mockResolvedValue({ produits: [], suite: null });
    const page = await rendre({ curseur: CURSEUR });
    expect(page).toContain("Aucun produit n&#x27;est en vente pour le moment");
    expect(page).not.toContain("ne correspond");
    expect(page).not.toContain("<details");
  });

  it("h2 sr-only avant la grille", async () => {
    faux.lister.mockResolvedValue({ produits: [carte(1)], suite: null });
    const page = await rendre({});
    expect(page).toMatch(/<h2 id="catalogue-liste" class="sr-only">Produits<\/h2>/);
  });

  function jsonLdBreadcrumb(page: string) {
    const blocs = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    return blocs.find((b) => b["@type"] === "BreadcrumbList");
  }

  it("BreadcrumbList rendu : 2 éléments, positions 1 et 2, noms Accueil puis catalogue, adresse propre de la langue", async () => {
    faux.lister.mockResolvedValue({ produits: [carte(1)], suite: null });
    const fr1 = jsonLdBreadcrumb(await rendre({}, "accessoire", "fr"));
    expect(fr1.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Accueil", item: "http://localhost:3000/fr" },
      { "@type": "ListItem", position: 2, name: "Accessoires", item: "http://localhost:3000/fr/accessoires" },
    ]);
    const en1 = jsonLdBreadcrumb(await rendre({}, "accessoire", "en"));
    expect(en1.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "http://localhost:3000/en" },
      { "@type": "ListItem", position: 2, name: "Accessories", item: "http://localhost:3000/en/accessories" },
    ]);
  });

  it("paramètres mal formés : première page, aucune exception", async () => {
    faux.lister.mockResolvedValue({ produits: [carte(1)], suite: null });
    const page = await rendre({ tri: "hasard", dispo: "zzz", prix: "abc", univers: "x", curseur: "!!!" });
    expect(page).toContain("TEST_Titre 1");
    expect(faux.lister.mock.calls[0][1]).toEqual({ univers: null, prixBas: null, prixHaut: null, dispo: null, tri: "nouveautes", curseur: null });
  });

  it("filtre d'univers absent sans univers, filtre de prix absent sans tranche ; présents quand réglés", async () => {
    faux.lister.mockResolvedValue({ produits: [carte(1)], suite: null });
    let page = await rendre({});
    expect(page).not.toContain('id="filtre-univers"');
    expect(page).not.toContain('id="filtre-prix"');
    faux.univers.mockResolvedValue([{ id: ID(50), nom: "TEST_Univers" }]);
    faux.tranches.mockResolvedValue([{ ordre: 1, libelleFr: "TEST_Tranche", libelleEn: "TEST_Band", basCents: 0, hautCents: 2000 }]);
    page = await rendre({});
    expect(page).toContain('id="filtre-univers"');
    expect(page).toContain('id="filtre-prix"');
    expect(page).toContain("TEST_Tranche");
  });

  it("anglais : titres, adresse propre des accessoires et fiche produit", async () => {
    faux.lister.mockResolvedValue({ produits: [{ ...carte(1), famille: "accessoire" }], suite: "C" });
    const page = await rendre({}, "accessoire", "en");
    expect(page).toContain("Accessories");
    expect(page).toContain('href="/accessories/test-produit-1"');
    expect(page).toContain('href="/accessories?curseur=C"');
    expect(page).toContain("1 product shown, there are more");
    expect(page).toContain("$49.90");
  });

  it("le listage est toujours demandé à la base avec la famille et la langue de la page", async () => {
    faux.lister.mockResolvedValue({ produits: [carte(1)], suite: null });
    await rendre({}, "accessoire", "en");
    expect(faux.lister.mock.calls[0][0]).toBe("accessoire");
    expect(faux.lister.mock.calls[0][2]).toBe("en");
  });
});

describe("metadataCatalogue", () => {
  const meta = (requete: Record<string, string | undefined>, locale: "fr" | "en" = "fr", famille: "cosplay" | "accessoire" = "accessoire") =>
    metadataCatalogue({ famille, locale, searchParams: Promise.resolve(requete) });

  it("page de base : indexable, canonique propre à la langue, hreflang des deux adresses, Open Graph", async () => {
    const m = await meta({}, "en");
    expect(m.alternates?.canonical).toBe("http://localhost:3000/en/accessories");
    expect(m.alternates?.languages).toMatchObject({
      fr: "http://localhost:3000/fr/accessoires",
      en: "http://localhost:3000/en/accessories",
      "x-default": "http://localhost:3000/fr/accessoires",
    });
    expect(m.robots).toBeUndefined();
    expect(m.title).toBe("Accessories | TEST_Boutique");
    expect(m.openGraph?.url).toBe("http://localhost:3000/en/accessories");
  });

  it.each<Record<string, string>>([{ tri: "prix_asc" }, { dispo: "en_stock" }, { prix: "0-2000" }, { univers: ID(7) }])(
    "page filtrée ou triée %j : noindex, follow, canonique vers la page de base",
    async (requete) => {
      const m = await meta(requete);
      expect(m.robots).toEqual({ index: false, follow: true });
      expect(m.alternates?.canonical).toBe("http://localhost:3000/fr/accessoires");
    },
  );

  it("page à curseur sans filtre : indexable, canonique propre avec son curseur", async () => {
    faux.lister.mockResolvedValue({ produits: [carte(1)], suite: null });
    const curseur = Buffer.from(JSON.stringify(["nouveautes", "2026-10-26 10:00:00+00", ID(9), 12]), "utf8").toString("base64url");
    const m = await meta({ curseur }, "fr");
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe(`http://localhost:3000/fr/accessoires?curseur=${curseur}`);
    expect(m.alternates?.languages).toMatchObject({ en: `http://localhost:3000/en/accessories?curseur=${curseur}` });
  });

  it.each(["périmé", "lecture impossible"])("curseur %s : canonique vers la page de base, pas d'URL à curseur", async (cas) => {
    if (cas === "périmé") faux.lister.mockResolvedValue({ produits: [], suite: null });
    else faux.lister.mockRejectedValue(new Error("TEST"));
    const curseur = Buffer.from(JSON.stringify(["nouveautes", "2026-10-26 10:00:00+00", ID(9), 12]), "utf8").toString("base64url");
    const m = await meta({ curseur });
    expect(m.alternates?.canonical).toBe("http://localhost:3000/fr/accessoires");
    expect(m.alternates?.languages).toMatchObject({ en: "http://localhost:3000/en/accessories" });
  });

  it("curseur invalide : page de base indexable", async () => {
    const m = await meta({ curseur: "n-importe-quoi" });
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe("http://localhost:3000/fr/accessoires");
  });

  it("curseur avec filtre : noindex, canonique de base", async () => {
    const curseur = Buffer.from(JSON.stringify(["prix_asc", 1500, ID(9), 12]), "utf8").toString("base64url");
    const m = await meta({ tri: "prix_asc", curseur });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBe("http://localhost:3000/fr/accessoires");
  });
});
