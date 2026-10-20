import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { lireEnvPublique } from "@/lib/env";
import type { Database } from "./types";

// Client lié à la session du visiteur (cookies).
export async function creerClientSession() {
  const env = lireEnvPublique();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (aPoser) => {
        try {
          aPoser.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appel depuis un Server Component : le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}
