import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/kits/test", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/bibliotheque/actions", () => ({ lireEtatKit: vi.fn(async () => "anonyme") }));
vi.mock("@/modules/commande/actions", () => ({ obtenirKitGratuit: vi.fn() }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ) }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

type Reponse = { data: unknown; error: unknown };
const faux = vi.hoisted(() => ({
  parTable: {} as Record<string, Reponse>,
  tables: [] as string[],
  selections: [] as string[],
}));

vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({
    from: (table: string) => {
      faux.tables.push(table);
      const r = () => Promise.resolve(faux.parTable[table] ?? { data: null, error: null });
      const b: Record<string, unknown> = {
        select: (c: string) => {
          faux.selections.push(`${table}:${c}`);
          return b;
        },
        eq: () => b,
        order: () => r(),
        maybeSingle: () => r(),
        then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => r().then(ok, ko),
      };
      return b;
    },
  }),
}));

import { getTranslations } from "next-intl/server";
import { FicheKit } from "@/components/fiche/FicheKit";
import { formaterUsd } from "@/lib/argent";
import { lireFicheKit } from "@/modules/catalogue/queries";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = { fr: (await import("../../messages/fr.json")).default, en: (await import("../../messages/en.json")).default };
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) => createTranslator({ locale, messages: messages[locale], namespace: namespace as never }),
  };
});
void getTranslations;

const KIT = "00000000-0000-4000-8000-0000000000a1";
const EXTRAIT = "00000000-0000-4000-8000-0000000000e9";
// Valeurs privées connues, présentes dans le faux client : elles ne doivent jamais atteindre le HTML.
const PRIVE = "11111111-2222-4333-8444-555555555555";
const CHEMIN_PRIVE = `kits-private/${KIT}/66666666-7777-4888-8999-000000000000.pdf`;

function base() {
  faux.parTable = {
    produit: {
      data: {
        id: KIT,
        slug: "test-kit",
        titre_fr: "TEST_Kit",
        titre_en: "TEST_Kit en",
        description_fr: "TEST_Description",
        description_en: "TEST_Description en",
        materiel_fr: "TEST_Mousse",
        materiel_en: "TEST_Foam",
        prix_cents: 990,
        niveau: "intermediaire",
      },
      error: null,
    },
    produit_photo: { data: [{ fichier: `${KIT}/a.jpg`, alt_fr: "TEST_Alt", alt_en: "TEST_Alt en", position: 1 }], error: null },
    fichier_kit: { data: [{ nom_fr: "TEST_Patron", nom_en: "TEST_Pattern", format: "pdf_a4", taille_octets: 2048, ordre: 1 }], error: null },
    chapitre_kit: { data: [{ titre_fr: "TEST_Intro", titre_en: "TEST_Intro en", debut_secondes: 75, ordre: 1 }], error: null },
    sous_titre_kit: { data: [{ langue: "fr" }], error: null },
    video_kit: {
      data: { duree_secondes: 600, extrait_bunny_id: EXTRAIT, extrait_sans_parole: false, extrait_sous_titres: ["fr"], extrait_le: "2026-10-31 10:00:00+00" },
      error: null,
    },
    video_kit_prive: { data: { produit_id: KIT, bunny_video_id_prive: PRIVE }, error: null },
    fichier_kit_prive: { data: [{ fichier_id: "TEST_f", chemin_stockage: CHEMIN_PRIVE }], error: null },
  };
}

beforeEach(() => {
  faux.tables = [];
  faux.selections = [];
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  base();
});

describe("lireFicheKit", () => {
  it("lit seulement les tables publiables (jamais une table _prive), dans la langue demandée", async () => {
    const fiche = await lireFicheKit("test-kit", "en");
    expect(faux.tables.some((t) => t.includes("prive"))).toBe(false);
    expect(faux.selections.join(" ")).not.toMatch(/prive|chemin/);
    expect(fiche).toMatchObject({
      titre: "TEST_Kit en",
      materiel: "TEST_Foam",
      niveau: "intermediaire",
      fichiers: [{ nom: "TEST_Pattern", format: "pdf_a4", tailleOctets: 2048 }],
      chapitres: [{ ordre: 1, titre: "TEST_Intro en", debutSecondes: 75 }],
      sousTitres: ["fr"],
      extrait: { id: EXTRAIT, sousTitres: ["fr"], sansParole: false },
    });
  });

  it("Kit inconnu, sans prix ou sans photo : null ; erreur de lecture relancée", async () => {
    faux.parTable.produit = { data: null, error: null };
    expect(await lireFicheKit("absent", "fr")).toBeNull();
    base();
    faux.parTable.produit_photo = { data: [], error: null };
    expect(await lireFicheKit("test-kit", "fr")).toBeNull();
    base();
    faux.parTable.chapitre_kit = { data: null, error: { message: "TEST" } };
    await expect(lireFicheKit("test-kit", "fr")).rejects.toThrow();
  });
});

async function rendre(locale: "fr" | "en", hote: string | null = "vz-test.b-cdn.net") {
  const fiche = await lireFicheKit("test-kit", locale);
  if (!fiche) throw new Error("TEST_fiche absente");
  const element = await FicheKit({ fiche, locale, hoteCdn: hote });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} timeZone="UTC" messages={locale === "fr" ? fr : en}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("FicheKit", () => {
  it("affiche prix, niveau, matériel, fichiers, chapitres, licence et l'extrait sous-titré, sans lecture automatique", async () => {
    const html = await rendre("fr");
    expect(html).toContain(formaterUsd(990, "fr"));
    expect(html).toContain("Niveau : Intermédiaire");
    expect(html).toContain("TEST_Mousse");
    expect(html).toContain("TEST_Patron · PDF A4 · 2 Ko");
    expect(html).toContain("TEST_Intro");
    expect(html).toContain("1:15");
    // La licence est découpée en paragraphes : chacun est rendu tel quel.
    for (const paragraphe of fr.Kit.licence.texte.split(/\n\s*\n/)) expect(html).toContain(paragraphe.split("\n")[0].replace(/'/g, "&#x27;"));
    expect(html).toContain(`poster="https://vz-test.b-cdn.net/${EXTRAIT}/thumbnail.jpg"`);
    expect(html).toContain(`src="https://vz-test.b-cdn.net/${EXTRAIT}/captions/fr.vtt"`);
    expect(html).toMatch(/<video[^>]*controls/);
    expect(html).not.toMatch(/autoplay/i);
  });

  it("JSON-LD : Product + Offer (InStock, USD, sans note ni avis), VideoObject, BreadcrumbList", async () => {
    const html = await rendre("fr");
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"priceCurrency":"USD"');
    expect(html).toContain('"availability":"https://schema.org/InStock"');
    expect(html).toContain('"@type":"VideoObject"');
    expect(html).toContain('"uploadDate":"2026-10-31T10:00:00.000Z"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).not.toMatch(/aggregateRating|"review"/);
  });

  it("le HTML ne contient ni kits-private ni identifiant de la bibliothèque privée", async () => {
    const html = await rendre("en");
    expect(html).not.toContain(PRIVE);
    expect(html).not.toContain(CHEMIN_PRIVE);
    expect(html).not.toContain("kits-private");
    expect(html).not.toMatch(/BUNNY_PRIVE|video_kit_prive/);
  });

  it("sous /en sans sous-titres anglais de la vidéo complète : mention affichée ; avec : absente", async () => {
    expect(await rendre("en")).toContain("English subtitles are not available for this kit.");
    faux.parTable.sous_titre_kit = { data: [{ langue: "fr" }, { langue: "en" }], error: null };
    expect(await rendre("en")).not.toContain(en.Kit.sousTitres.sansAnglais);
    expect(await rendre("fr")).not.toContain(en.Kit.sousTitres.sansAnglais);
  });

  it("Kit sans extrait : ni lecteur ni VideoObject", async () => {
    faux.parTable.video_kit = { data: { duree_secondes: 600, extrait_bunny_id: null, extrait_sans_parole: false, extrait_sous_titres: [], extrait_le: null }, error: null };
    const html = await rendre("fr");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("VideoObject");
  });

  it("extrait parlé sans sous-titres français : caché (ni lecteur ni VideoObject) ; sans parole : montré", async () => {
    faux.parTable.video_kit = { data: { duree_secondes: 600, extrait_bunny_id: EXTRAIT, extrait_sans_parole: false, extrait_sous_titres: ["en"], extrait_le: "2026-10-31 10:00:00+00" }, error: null };
    expect((await lireFicheKit("test-kit", "fr"))?.extrait).toBeNull();
    let html = await rendre("fr");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("VideoObject");
    faux.parTable.video_kit = { data: { duree_secondes: 600, extrait_bunny_id: EXTRAIT, extrait_sans_parole: true, extrait_sous_titres: [], extrait_le: "2026-10-31 10:00:00+00" }, error: null };
    html = await rendre("fr");
    expect(html).toContain("<video");
    expect(html).toContain("VideoObject");
  });

  it("sous /en, extrait parlé sans sous-titres anglais : mention ; avec, ou sans parole : aucune", async () => {
    expect(await rendre("en")).toContain(en.Kit.extrait.sansAnglais);
    expect(await rendre("fr")).not.toContain(en.Kit.extrait.sansAnglais);
    faux.parTable.video_kit = { data: { duree_secondes: 600, extrait_bunny_id: EXTRAIT, extrait_sans_parole: false, extrait_sous_titres: ["fr", "en"], extrait_le: "2026-10-31 10:00:00+00" }, error: null };
    expect(await rendre("en")).not.toContain(en.Kit.extrait.sansAnglais);
    faux.parTable.video_kit = { data: { duree_secondes: 600, extrait_bunny_id: EXTRAIT, extrait_sans_parole: true, extrait_sous_titres: [], extrait_le: "2026-10-31 10:00:00+00" }, error: null };
    expect(await rendre("en")).not.toContain(en.Kit.extrait.sansAnglais);
  });
});
