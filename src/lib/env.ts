import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type EnvPublique = z.infer<typeof publicSchema>;
export type EnvServeur = z.infer<typeof serverSchema>;

// Le message nomme les variables fautives, jamais leur valeur (règle 4).
function lireOuArreter<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const resultat = schema.safeParse(source);
  if (resultat.success) return resultat.data;
  const noms = [...new Set(resultat.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`Variables d'environnement absentes ou invalides : ${noms.join(", ")}. Voir .env.example.`);
}

export function lireEnvPublique(source: Record<string, string | undefined> = lirePublicSource()): EnvPublique {
  return lireOuArreter(publicSchema, source);
}

export function lireEnvServeur(source: Record<string, string | undefined> = process.env): EnvServeur {
  return lireOuArreter(serverSchema, source);
}

// Références statiques : Next ne remplace les NEXT_PUBLIC_* que sous cette forme.
function lirePublicSource() {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
