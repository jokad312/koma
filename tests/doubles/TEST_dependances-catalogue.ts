import { vi } from "vitest";
import type { DependancesCatalogue } from "@/modules/catalogue/types";

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
};

export function creerTestDependancesCatalogue(r: Reglages = {}) {
  const appels = {
    ordre: [] as string[],
    droits: [] as string[],
    univers: [] as unknown[],
    produits: [] as Array<Parameters<DependancesCatalogue["ecrireProduit"]>[0]>,
    slugs: [] as unknown[],
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
  };
  return { deps, appels };
}
