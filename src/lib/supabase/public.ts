import { createClient } from "@supabase/supabase-js";
import { lireEnvPublique } from "@/lib/env";
import type { Database } from "./types";

// Lectures publiques sans session (données mises en cache).
export function creerClientPublic() {
  const env = lireEnvPublique();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
