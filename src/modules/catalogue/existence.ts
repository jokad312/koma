import { createClient } from "@supabase/supabase-js";
import { ADRESSES } from "@/i18n/adresses";
import { lireEnvPublique } from "@/lib/env";
import type { FamillePhysique } from "./types";

export type AdresseFiche = { locale: "fr" | "en"; famille: FamillePhysique; slug: string };

const FAMILLE_PAR_INTERNE: Record<string, FamillePhysique> = { "/cosplays": "cosplay", "/accessoires": "accessoire" };
const FORME_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Reconnaît l'adresse propre d'une fiche (« /fr/cosplays/x », « /en/accessories/x ») ; toute autre forme donne null.
export function analyserAdresseFiche(chemin: string): { locale: "fr" | "en"; famille: FamillePhysique; segment: string } | null {
  const morceaux = chemin.split("/");
  if (morceaux.length !== 4 || morceaux[0] !== "") return null;
  const [, locale, dossier, segment] = morceaux;
  if (locale !== "fr" && locale !== "en") return null;
  const adresse = ADRESSES.find((a) => a[locale] === `/${dossier}`);
  const famille = adresse ? FAMILLE_PAR_INTERNE[adresse.interne] : undefined;
  if (!famille) return null;
  return { locale, famille, segment };
}

// Existence d'une fiche publiable pour le proxy : « oui », « non » (404 certaine) ou « incertain » (base muette : le chemin normal décide).
// Clé publique et RLS seulement, jamais de session ni de clé de service ; délai court ; aucune donnée journalisée.
export async function ficheExiste(famille: FamillePhysique, segment: string, delaiMs = 2000): Promise<"oui" | "non" | "incertain"> {
  let slug: string;
  try {
    slug = decodeURIComponent(segment);
  } catch {
    return "non";
  }
  if (slug.length > 80 || !FORME_SLUG.test(slug)) return "non";
  try {
    const env = lireEnvPublique();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (entree, init) => fetch(entree, { ...init, signal: AbortSignal.timeout(delaiMs) }) },
    });
    // Mêmes conditions que lireFicheProduit : famille de l'adresse, prix fixé, au moins une photo.
    const { data, error } = await client
      .from("produit")
      .select("id, produit_photo!inner(id)")
      .eq("slug", slug)
      .eq("famille", famille)
      .not("prix_cents", "is", null)
      .limit(1);
    if (error || !data) {
      console.error("[proxy] existence de la fiche : lecture en erreur");
      return "incertain";
    }
    return data.length > 0 ? "oui" : "non";
  } catch {
    console.error("[proxy] existence de la fiche : base indisponible");
    return "incertain";
  }
}
