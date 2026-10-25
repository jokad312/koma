// Photos de produits : seul le bucket public de NOTRE projet Supabase est autorisé pour next/image (AD-18),
// adresse dérivée de NEXT_PUBLIC_SUPABASE_URL (jamais écrite en dur).
export type MotifImage = { protocol: "http" | "https"; hostname: string; port: string; pathname: string };

export function photosAutorisees(adresseSupabase: string | undefined): MotifImage[] {
  try {
    const url = new URL(adresseSupabase ?? "");
    const protocol = url.protocol === "http:" ? "http" : "https";
    return [{ protocol, hostname: url.hostname, port: url.port, pathname: "/storage/v1/object/public/produits-public/**" }];
  } catch {
    // Variable absente ou invalide : aucune image distante n'est autorisée (l'application refuse déjà de démarrer sans elle).
    return [];
  }
}
