import { createClient } from "@supabase/supabase-js";
import { lireEnvPublique } from "@/lib/env";
import { contientMarqueur } from "@/lib/vitrine/marqueur";

export type AdresseArticle = { locale: "fr" | "en"; segment: string };

const FORME_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Reconnaît l'adresse propre d'un Article (« /fr/blog/x », « /en/blog/x », l'adresse ne change pas selon la langue) ;
// toute autre forme donne null. Le préfixe admin (« /fr/admin/blog/x ») a un morceau de plus et n'est pas reconnu.
export function analyserAdresseArticle(chemin: string): AdresseArticle | null {
  const morceaux = chemin.split("/");
  if (morceaux.length !== 4 || morceaux[0] !== "") return null;
  const [, locale, dossier, segment] = morceaux;
  if ((locale !== "fr" && locale !== "en") || dossier !== "blog") return null;
  return { locale, segment };
}

type LigneArticle = { id: string; titre_en: string | null; texte_en: string | null };
type ReponseArticle = { data: LigneArticle[] | null; error: { message: string } | null };
type ClientArticle = {
  from(table: "article"): {
    select(colonnes: string): {
      eq(colonne: string, valeur: string): {
        limit(nombre: number): PromiseLike<ReponseArticle>;
      };
    };
  };
};

function aVersionAnglaise(ligne: LigneArticle): boolean {
  const titre = ligne.titre_en?.trim() ?? "";
  const texte = ligne.texte_en?.trim() ?? "";
  return titre !== "" && texte !== "" && !contientMarqueur(titre) && !contientMarqueur(texte);
}

// Existence d'un Article publiable pour le proxy : « oui », « non » (404 certaine) ou « incertain » (base muette : le chemin normal décide).
// Clé publique et RLS seulement (les brouillons sont invisibles), jamais de session ni de clé de service ; délai court ; aucune donnée journalisée.
export async function articleExiste(locale: "fr" | "en", segment: string, delaiMs = 2000): Promise<"oui" | "non" | "incertain"> {
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
    }) as unknown as ClientArticle;
    const { data, error } = await client.from("article").select("id, titre_en, texte_en").eq("slug", slug).limit(1);
    if (error || !data) {
      console.error("[proxy] existence de l'article : lecture en erreur");
      return "incertain";
    }
    if (data.length === 0) return "non";
    // Sous /en, un Article sans version anglaise n'existe pas : même 404 que la page.
    return locale === "en" && !aVersionAnglaise(data[0]) ? "non" : "oui";
  } catch {
    console.error("[proxy] existence de l'article : base indisponible");
    return "incertain";
  }
}
