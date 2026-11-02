import { vi } from "vitest";
import type { ArticleImage, DependancesBlog } from "@/modules/blog/types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/).
export const TEST_AUTEUR_BLOG = "00000000-0000-4000-8000-0000000000a1";

class TEST_DroitRefuse extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Reglages = {
  droit?: "KS_NON_CONNECTE" | "KS_DROIT_REFUSE" | "KS_VERIFICATION_IMPOSSIBLE" | null;
  erreurArticle?: string | null;
  idArticle?: string | null;
  erreurPublication?: string | null;
  erreurSigner?: string | null;
  octetsAttente?: Uint8Array | null;
  erreurLectureAttente?: string | null;
  erreurEcriturePublique?: string | null;
  erreurSuppression?: string | null;
  leveEcriturePublique?: boolean;
  imagesExistantes?: ArticleImage[];
  invalidationEnEchec?: boolean;
};

export function creerTestDependancesBlog(r: Reglages = {}) {
  const appels = {
    ordre: [] as string[],
    droits: [] as string[],
    articles: [] as Array<Parameters<DependancesBlog["enregistrerArticle"]>[0]>,
    publications: [] as Array<Parameters<DependancesBlog["changerPublication"]>[0]>,
    signatures: [] as string[],
    ecritsPublics: [] as Array<{ objet: string; octets: Uint8Array; contentType: string }>,
    suppressions: [] as Array<{ bucket: string; objet: string }>,
    invalidations: 0,
  };
  const deps: DependancesBlog = {
    exigerDroit: vi.fn(async (droit) => {
      appels.ordre.push("droit");
      appels.droits.push(droit);
      if (r.droit) throw new TEST_DroitRefuse(r.droit);
      return { auteur: { type: "compte" as const, id: TEST_AUTEUR_BLOG, role: "admin" as const } };
    }),
    lireImagesArticle: vi.fn(async () => {
      appels.ordre.push("lireImages");
      return r.imagesExistantes ?? [];
    }),
    enregistrerArticle: vi.fn(async (args) => {
      appels.ordre.push("article");
      appels.articles.push(args);
      return { erreur: r.erreurArticle ?? null, id: r.erreurArticle ? null : (r.idArticle === undefined ? (args.id ?? "TEST_article-0001") : r.idArticle) };
    }),
    changerPublication: vi.fn(async (args) => {
      appels.ordre.push("publication");
      appels.publications.push(args);
      return { erreur: r.erreurPublication ?? null };
    }),
    signerEnvoiImage: vi.fn(async ({ objet }) => {
      appels.ordre.push("signer");
      appels.signatures.push(objet);
      return { erreur: r.erreurSigner ?? null, jeton: r.erreurSigner ? null : "TEST_jeton-article" };
    }),
    lireObjetAttente: vi.fn(async () => {
      appels.ordre.push("lireAttente");
      if (r.erreurLectureAttente) return { erreur: r.erreurLectureAttente, octets: null };
      return { erreur: null, octets: r.octetsAttente ?? null };
    }),
    ecrireObjetPublic: vi.fn(async (args) => {
      appels.ordre.push("ecrirePublic");
      appels.ecritsPublics.push(args);
      if (r.leveEcriturePublique) throw new Error("TEST_coupure");
      return { erreur: r.erreurEcriturePublique ?? null };
    }),
    supprimerObjet: vi.fn(async (args) => {
      appels.ordre.push(`supprimer:${args.bucket}`);
      appels.suppressions.push(args);
      return { erreur: r.erreurSuppression ?? null };
    }),
    invaliderArticles: vi.fn(async () => {
      appels.ordre.push("invalidation");
      appels.invalidations += 1;
      if (r.invalidationEnEchec) throw new Error("TEST_cache");
    }),
  };
  return { deps, appels };
}
