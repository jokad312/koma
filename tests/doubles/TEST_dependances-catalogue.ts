import { vi } from "vitest";
import type { DependancesCatalogue, ProduitPourPublication } from "@/modules/catalogue/types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/).
export const TEST_ADMIN_ID = "TEST_admin-0001";

// Même forme que DroitRefuseError (src/lib/auth/droits.ts, server-only) : le service ne lit que le code.
class TEST_DroitRefuse extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Reglages = {
  droit?: "KS_NON_CONNECTE" | "KS_DROIT_REFUSE" | "KS_VERIFICATION_IMPOSSIBLE" | null;
  erreurUnivers?: string | null;
  erreurProduit?: string | null;
  idUnivers?: string | null;
  idProduit?: string | null;
  slugLibre?: string | "erreur";
  // Photos et publication.
  erreurSigner?: string | null;
  octetsAttente?: Uint8Array | null;
  erreurLectureAttente?: string | null;
  erreurEcriturePublique?: string | null;
  erreurSuppression?: string | null;
  erreurPhoto?: string | null;
  // L'appel LÈVE au lieu de répondre : résultat inconnu.
  leveEcriturePublique?: boolean;
  levePhoto?: boolean;
  erreurDeplacer?: string | null;
  erreurPublication?: string | null;
  erreurSupprimerPhoto?: string | null;
  erreurAlt?: string | null;
  invalidationEnEchec?: boolean;
  // Produit lu pour la complétude : par défaut complet. null : produit inconnu. Une fonction permet de changer entre deux lectures.
  produitComplet?: ProduitPourPublication | null | (() => ProduitPourPublication | null);
  lectureProduitEnEchec?: boolean;
  // Tranches de prix.
  erreurTranches?: string | null;
  invalidationReglagesEnEchec?: boolean;
};

export const TEST_PRODUIT_COMPLET: ProduitPourPublication = {
  prixCents: 4990,
  titreEn: "TEST_Title",
  descriptionFr: "TEST_description",
  descriptionEn: "TEST_description en",
  nbPhotos: 1,
  nbVariantes: 1,
  publieLe: null,
};

export function creerTestDependancesCatalogue(r: Reglages = {}) {
  const appels = {
    ordre: [] as string[],
    droits: [] as string[],
    univers: [] as unknown[],
    produits: [] as Array<Parameters<DependancesCatalogue["ecrireProduit"]>[0]>,
    slugs: [] as unknown[],
    signatures: [] as string[],
    ecritsPublics: [] as Array<{ objet: string; octets: Uint8Array; contentType: string }>,
    suppressions: [] as Array<{ bucket: string; objets: string[] }>,
    photos: [] as Array<Parameters<DependancesCatalogue["ecrirePhoto"]>[0]>,
    deplacements: [] as Array<Parameters<DependancesCatalogue["deplacerPhoto"]>[0]>,
    suppressionsPhoto: [] as Array<Parameters<DependancesCatalogue["supprimerPhoto"]>[0]>,
    alts: [] as Array<Parameters<DependancesCatalogue["modifierAltPhoto"]>[0]>,
    publications: [] as Array<Parameters<DependancesCatalogue["changerPublication"]>[0]>,
    invalidations: 0,
    tranches: [] as Array<Parameters<DependancesCatalogue["ecrireTranches"]>[0]>,
    invalidationsReglages: 0,
  };
  const deps: DependancesCatalogue = {
    exigerDroit: vi.fn(async (droit) => {
      appels.ordre.push("droit");
      appels.droits.push(droit);
      if (r.droit) throw new TEST_DroitRefuse(r.droit);
      return { auteur: { type: "compte" as const, id: TEST_ADMIN_ID, role: "admin" as const } };
    }),
    ecrireUnivers: vi.fn(async (args) => {
      appels.ordre.push("univers");
      appels.univers.push(args);
      return { erreur: r.erreurUnivers ?? null, id: r.erreurUnivers ? null : (r.idUnivers === undefined ? "TEST_univers-0001" : r.idUnivers) };
    }),
    ecrireProduit: vi.fn(async (args) => {
      appels.ordre.push("produit");
      appels.produits.push(args);
      return { erreur: r.erreurProduit ?? null, id: r.erreurProduit ? null : (r.idProduit === undefined ? (args.id ?? "TEST_produit-0001") : r.idProduit) };
    }),
    premierSlugLibre: vi.fn(async (base, exclureId) => {
      appels.slugs.push({ base, exclureId });
      if (r.slugLibre === "erreur") throw new Error("TEST_lecture");
      return r.slugLibre ?? `${base}-2`;
    }),
    signerEnvoiPhoto: vi.fn(async ({ objet }) => {
      appels.ordre.push("signer");
      appels.signatures.push(objet);
      return { erreur: r.erreurSigner ?? null, jeton: r.erreurSigner ? null : "TEST_jeton" };
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
    supprimerObjets: vi.fn(async (args) => {
      appels.ordre.push(`supprimer:${args.bucket}`);
      appels.suppressions.push(args);
      return { erreur: r.erreurSuppression ?? null };
    }),
    ecrirePhoto: vi.fn(async (args) => {
      appels.ordre.push("photo");
      appels.photos.push(args);
      if (r.levePhoto) throw new Error("TEST_coupure");
      return { erreur: r.erreurPhoto ?? null, id: r.erreurPhoto ? null : "TEST_photo-0001" };
    }),
    deplacerPhoto: vi.fn(async (args) => {
      appels.ordre.push("deplacer");
      appels.deplacements.push(args);
      return { erreur: r.erreurDeplacer ?? null };
    }),
    supprimerPhoto: vi.fn(async (args) => {
      appels.ordre.push("supprimerPhoto");
      appels.suppressionsPhoto.push(args);
      return { erreur: r.erreurSupprimerPhoto ?? null, fichier: r.erreurSupprimerPhoto ? null : "TEST_produit/TEST_fichier.jpg" };
    }),
    modifierAltPhoto: vi.fn(async (args) => {
      appels.ordre.push("alt");
      appels.alts.push(args);
      return { erreur: r.erreurAlt ?? null };
    }),
    changerPublication: vi.fn(async (args) => {
      appels.ordre.push("publication");
      appels.publications.push(args);
      return { erreur: r.erreurPublication ?? null };
    }),
    ecrireTranches: vi.fn(async (args) => {
      appels.ordre.push("tranches");
      appels.tranches.push(args);
      return { erreur: r.erreurTranches ?? null };
    }),
    invaliderReglages: vi.fn(async () => {
      appels.ordre.push("invalidationReglages");
      appels.invalidationsReglages += 1;
      if (r.invalidationReglagesEnEchec) throw new Error("TEST_cache");
    }),
    invaliderCatalogue: vi.fn(async () => {
      appels.ordre.push("invalidation");
      appels.invalidations += 1;
      if (r.invalidationEnEchec) throw new Error("TEST_cache");
    }),
    lireProduitComplet: vi.fn(async () => {
      if (r.lectureProduitEnEchec) throw new Error("TEST_lecture");
      const p = r.produitComplet === undefined ? TEST_PRODUIT_COMPLET : r.produitComplet;
      return typeof p === "function" ? p() : p;
    }),
  };
  return { deps, appels };
}
