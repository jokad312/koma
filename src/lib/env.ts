import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Option Sakura Town (Q-F1) : éteinte par défaut, tant que le fichier sous licence et l'accord écrit manquent.
  // Une valeur vide (copie de .env.example) vaut « éteinte ».
  NEXT_PUBLIC_TITRES_SAKURA: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  ),
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
    NEXT_PUBLIC_TITRES_SAKURA: process.env.NEXT_PUBLIC_TITRES_SAKURA,
  };
}
