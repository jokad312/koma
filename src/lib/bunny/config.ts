import { z } from "zod";

// Bibliothèque Bunny Stream PUBLIQUE (héros, extraits) : la clé reste côté serveur (règle 4), jamais renvoyée au navigateur.
// Aucune valeur de repli (règle 15) : une variable absente lève une erreur qui nomme la variable, jamais sa valeur.
export class BunnyNonConfigureError extends Error {
  readonly code = "KS_BUNNY_NON_CONFIGURE";
  constructor(noms: string[]) {
    super(`KS_BUNNY_NON_CONFIGURE : variables absentes ou invalides : ${noms.join(", ")}.`);
  }
}

export type ConfigBunnyPublic = { bibliothequeId: string; cle: string; hoteCdn: string };

const HOTE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z]{2,}$/i;

// Le nom d'hôte du CDN se saisit avec ou sans « https:// » et sans barre finale : seul le nom d'hôte est gardé.
export function normaliserHote(brut: string): string | null {
  const hote = brut.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return HOTE.test(hote) ? hote.toLowerCase() : null;
}

const schema = z.object({
  BUNNY_PUBLIC_LIBRARY_ID: z.string().regex(/^[0-9]{1,12}$/),
  BUNNY_PUBLIC_API_KEY: z.string().min(8),
});

export function lireConfigBunnyPublic(source: Record<string, string | undefined> = process.env): ConfigBunnyPublic {
  const resultat = schema.safeParse(source);
  const hote = normaliserHote(source.NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME ?? "");
  const noms = resultat.success ? [] : [...new Set(resultat.error.issues.map((i) => String(i.path[0])))];
  if (!hote) noms.push("NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME");
  if (!resultat.success || !hote) throw new BunnyNonConfigureError(noms);
  return { bibliothequeId: resultat.data.BUNNY_PUBLIC_LIBRARY_ID, cle: resultat.data.BUNNY_PUBLIC_API_KEY, hoteCdn: hote };
}

// Nom d'hôte du CDN public seul (affichage du héros) : null si absent, sans erreur (le héros retombe alors sur la photo).
export function lireHoteCdnPublic(source: Record<string, string | undefined> = process.env): string | null {
  return normaliserHote(source.NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME ?? "");
}
