import "server-only";
import { createClient } from "@supabase/supabase-js";
import { lireEnvServeur } from "@/lib/env";
import type { Database } from "./types";

// Clé secrète : serveur seulement, jamais envoyée au navigateur (AD-2).
export function creerClientService() {
  const env = lireEnvServeur();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
