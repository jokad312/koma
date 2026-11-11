import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const faux = vi.hoisted(() => ({ prochain: vi.fn(), etat: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});
vi.mock("@/modules/evenements/queries-publiques", () => ({ lireProchainEvenement: (...a: unknown[]) => faux.prochain(...a) }));
vi.mock("@/modules/evenements/achat-queries", () => ({ lireEtatVente: (...a: unknown[]) => faux.etat(...a) }));
vi.mock("@/modules/mesure/client", () => ({ mesurer: vi.fn() }));
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

import { BlocRendezVous } from "@/components/accueil/BlocRendezVous";
import { AchatEvenement } from "@/components/festival/AchatEvenement";
import { EvenementComplet } from "@/components/festival/EvenementComplet";
import type { CarteEvenement, EvenementPublic } from "@/modules/evenements/types";

function carte(n: number, surcharge: Partial<CarteEvenement> = {}): CarteEvenement {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-evenement-${n}`,
    titre: `TEST_Titre ${n}`,
    debutLe: "2099-05-01T08:00:00+00:00",
    lieu: "TEST_Lieu",
    vignetteUrl: "https://exemple.test/photo.jpg",
    vignetteAlt: "TEST_alt de la photo",
    passe: false,
    venteAVenir: false,
    ...surcharge,
  };
}

function evenement(surcharge: Partial<EvenementPublic> = {}): EvenementPublic {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-evenement-1",
    titre: "TEST_Titre",
    programme: "TEST_Programme **gras** <script>alert(1)</script>",
    lieu: "TEST_Lieu",
    debutLe: "2099-05-01T08:00:00+00:00",
    finLe: "2099-05-01T16:30:00+00:00",
    passe: false,
    venteAVenir: false,
    venteOuvreLe: null,
    images: [{ url: "https://exemple.test/photo.jpg", alt: "TEST_alt de la photo" }],
    types: [
      { id: "t1", nom: "TEST_Pass simple", prixCents: 1500, inclus: "TEST_entrée\nTEST_badge", estStand: false },
      { id: "t2", nom: "TEST_Stand", prixCents: 5000, inclus: null, estStand: true },
    ],
    ...surcharge,
  };
}

async function html(element: ReactElement | null, locale: "fr" | "en" = "fr"): Promise<string> {
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

function jsonLd(page: string) {
  return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, "<")) as Record<string, unknown>);
}

beforeEach(() => {
  faux.prochain.mockReset();
  faux.etat.mockReset();
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("bloc 5 « Rendez-vous otaku » de l'accueil", () => {
  it("montre le prochain Événement : H2, carte avec photo, date, titre, lieu et lien", async () => {
    faux.prochain.mockResolvedValue(carte(1));
    const page = await html(await BlocRendezVous({ locale: "fr" }));
    expect(faux.prochain).toHaveBeenCalledWith("fr");
    expect(page).toContain(">Rendez-vous otaku<");
    expect(page).toContain('href="/festival/test-evenement-1"');
    expect(page).toContain("TEST_Titre 1");
    expect(page).toContain("TEST_Lieu");
    expect(page).toContain('alt="TEST_alt de la photo"');
    expect(page).toContain("mai 2099");
  });

  it("aucun Événement à venir : le bloc n'existe pas", async () => {
    faux.prochain.mockResolvedValue(null);
    expect(await BlocRendezVous({ locale: "fr" })).toBeNull();
  });

  it("erreur de lecture : le bloc est masqué, jamais une carte inventée", async () => {
    faux.prochain.mockRejectedValue(new Error("TEST_erreur"));
    expect(await BlocRendezVous({ locale: "fr" })).toBeNull();
  });
});

describe("bouton d'achat de la page d'un Événement (story 7.4)", () => {
  const ouverte = { etat: "ouverte", types: [{ id: "t1", complet: false }, { id: "t2", complet: false }] };

  it("vente ouverte : « Acheter des pass » mène à la page d'achat, sans compteur de places", async () => {
    faux.etat.mockResolvedValue(ouverte);
    const page = await html(await AchatEvenement({ evenement: evenement(), locale: "fr" }));
    expect(faux.etat).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    expect(page).toContain('href="/festival/test-evenement-1/acheter"');
    expect(page).toContain("Acheter des pass");
    // Un Type « Stand » ne s'achète pas : il se candidate (story 7.11).
    expect(page).toContain('href="/festival/test-evenement-1/candidater"');
    expect(page).toContain("Candidater pour un stand");
    expect(page).not.toMatch(/Complet|Vente fermée|places/i);
  });

  it("anglais : « Buy passes »", async () => {
    faux.etat.mockResolvedValue(ouverte);
    expect(await html(await AchatEvenement({ evenement: evenement(), locale: "en" }), "en")).toContain("Buy passes");
  });

  it("un Type au quota atteint est signalé « complet », le bouton reste ; un Stand complet est signalé et ne se candidate plus", async () => {
    faux.etat.mockResolvedValue({ etat: "ouverte", types: [{ id: "t1", complet: true }, { id: "t2", complet: true }] });
    const page = await html(await AchatEvenement({ evenement: evenement(), locale: "fr" }));
    expect(page).toContain("TEST_Pass simple : complet");
    expect(page).toContain("TEST_Stand : complet");
    expect(page).toContain("Acheter des pass");
    expect(page).not.toContain("/candidater");
  });

  it("Capacité atteinte : « Complet » à la place du bouton", async () => {
    faux.etat.mockResolvedValue({ etat: "complet", types: [{ id: "t1", complet: true }] });
    const page = await html(await AchatEvenement({ evenement: evenement(), locale: "fr" }));
    expect(page).toContain("Complet");
    expect(page).not.toContain("/acheter");
    expect(page).not.toContain("Acheter des pass");
  });

  it("vente fermée : « Vente fermée » à la place du bouton", async () => {
    faux.etat.mockResolvedValue({ etat: "fermee", types: [] });
    const page = await html(await AchatEvenement({ evenement: evenement(), locale: "fr" }));
    expect(page).toContain("Vente fermée");
    expect(page).not.toContain("/acheter");
  });

  it("vente pas encore ouverte, rien à acheter, Événement passé, lecture impossible : ni bouton ni mention inventée", async () => {
    faux.etat.mockResolvedValue({ etat: "a_venir", types: [] });
    expect(await AchatEvenement({ evenement: evenement(), locale: "fr" })).toBeNull();
    // Rien d'achetable et aucun Stand : aucun bouton. Avec un Stand, seule la candidature reste proposée.
    faux.etat.mockResolvedValue({ etat: "aucun", types: [] });
    expect(await AchatEvenement({ evenement: evenement({ types: [] }), locale: "fr" })).toBeNull();
    const seulStand = await html(await AchatEvenement({ evenement: evenement(), locale: "fr" }));
    expect(seulStand).toContain("Candidater pour un stand");
    expect(seulStand).not.toContain("/acheter");
    faux.etat.mockClear();
    faux.etat.mockResolvedValue(ouverte);
    expect(await AchatEvenement({ evenement: evenement({ passe: true }), locale: "fr" })).toBeNull();
    expect(faux.etat).not.toHaveBeenCalled();
    faux.etat.mockRejectedValue(new Error("TEST_panne"));
    expect(await AchatEvenement({ evenement: evenement(), locale: "fr" })).toBeNull();
    faux.etat.mockResolvedValue(null);
    expect(await AchatEvenement({ evenement: evenement(), locale: "fr" })).toBeNull();
  });

  it("dans la page : le bouton est sous Suspense et la page entière rend le bouton quand la vente est ouverte", async () => {
    faux.etat.mockResolvedValue(ouverte);
    const page = await html(await EvenementComplet({ evenement: evenement(), locale: "fr" }));
    expect(page).toContain("Acheter des pass");
  });
});

describe("page d'un Événement", () => {
  it("date, lieu, programme nettoyé, photos avec alt, cartes de Types de pass en USD, Partager ; aucun compteur de places", async () => {
    const page = await html(await EvenementComplet({ evenement: evenement(), locale: "fr" }), "fr");
    expect(page).toContain("<h1");
    expect(page).toContain("TEST_Lieu");
    expect(page).toContain("<strong>gras</strong>");
    expect(page).not.toContain("<script>alert");
    expect(page).toContain('alt="TEST_alt de la photo"');
    expect(page).toContain("TEST_Pass simple");
    expect(page).toContain("TEST_Stand");
    expect(page).toMatch(/15,00[\s ]\$US/);
    expect(page).toContain("<li>TEST_entrée</li>");
    expect(page).toContain("Partager");
    expect(page).not.toMatch(/Candidater|Complet|Vente fermée|Me prévenir|places/i);
  });

  it("un Événement passé est marqué comme passé, un Événement à venir ne l'est pas", async () => {
    const avenir = await html(await EvenementComplet({ evenement: evenement(), locale: "fr" }));
    const passe = await html(await EvenementComplet({ evenement: evenement({ passe: true }), locale: "fr" }));
    // Le texte du marqueur est le même pour plusieurs libellés : on repère donc l'étiquette par sa balise.
    const etiquette = '<p class="t-label text-text-secondary">';
    expect(passe.split(etiquette).length - 1).toBe(1);
    expect(avenir.split(etiquette).length - 1).toBe(0);
  });

  it("JSON-LD Event : dates avec décalage +02:00, lieu, image, une offre USD par Type de pass ; BreadcrumbList ; jamais de marqueur", async () => {
    const page = await html(await EvenementComplet({ evenement: evenement(), locale: "en" }), "en");
    const [fil, evt] = jsonLd(page);
    expect(fil["@type"]).toBe("BreadcrumbList");
    expect(evt).toMatchObject({
      "@type": "Event",
      name: "TEST_Titre",
      startDate: "2099-05-01T10:00:00+02:00",
      endDate: "2099-05-01T18:30:00+02:00",
      location: { "@type": "Place", name: "TEST_Lieu" },
      image: ["https://exemple.test/photo.jpg"],
    });
    expect(evt.offers).toEqual([
      { "@type": "Offer", name: "TEST_Pass simple", url: "http://localhost:3000/en/festival/test-evenement-1", price: "15.00", priceCurrency: "USD" },
      { "@type": "Offer", name: "TEST_Stand", url: "http://localhost:3000/en/festival/test-evenement-1", price: "50.00", priceCurrency: "USD" },
    ]);
    expect(JSON.stringify([fil, evt])).not.toContain("[Texte à fournir]");
  });

  it("un lieu ou un nom de Type contenant le marqueur est écarté des données structurées, jamais inventé", async () => {
    const page = await html(
      await EvenementComplet({
        evenement: evenement({ lieu: "[Texte à fournir]", types: [{ id: "t", nom: "[Texte à fournir]", prixCents: 100, inclus: null, estStand: false }], images: [] }),
        locale: "fr",
      }),
    );
    const evt = jsonLd(page)[1];
    expect(evt.location).toBeUndefined();
    expect(evt.offers).toBeUndefined();
    expect(evt.image).toBeUndefined();
    expect(JSON.stringify(evt)).not.toContain("[Texte à fournir]");
  });

  it("sans Type de pass ni programme ni photo : ces sections n'existent pas", async () => {
    const page = await html(await EvenementComplet({ evenement: evenement({ types: [], programme: null, images: [], finLe: null }), locale: "fr" }));
    expect(page).not.toContain("festival-pass");
    expect(page).not.toContain("festival-programme");
    expect(page).not.toContain("<img");
  });
});
