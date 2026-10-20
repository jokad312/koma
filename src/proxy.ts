import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lireEnvPublique } from "@/lib/env";

// Rafraîchit la session Supabase. Ne redirige jamais une page publique vers la connexion.
export async function proxy(request: NextRequest) {
  let reponse = NextResponse.next({ request });
  const env = lireEnvPublique();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aPoser) => {
        aPoser.forEach(({ name, value }) => request.cookies.set(name, value));
        reponse = NextResponse.next({ request });
        aPoser.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getClaims();
  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
