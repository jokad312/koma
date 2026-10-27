import { lireEnvPublique } from "@/lib/env";

// Buckets de photos de produits (AD-18) : l'original arrive dans le bucket privé, la copie nettoyée vit dans le bucket public.
export const BUCKET_ATTENTE = "galerie-attente";
export const BUCKET_PUBLIC = "produits-public";
// Fichiers des Kits (PDF, SVG, STL, transcriptions) : bucket privé, jamais d'adresse publique ; lien signé de courte durée (story 3.6).
export const BUCKET_KITS = "kits-private";

// Adresse publique d'un fichier de produits-public, dérivée de NEXT_PUBLIC_SUPABASE_URL (jamais écrite en dur).
export function urlPhotoPublique(fichier: string, base: string = lireEnvPublique().NEXT_PUBLIC_SUPABASE_URL): string {
  const racine = base.replace(/\/+$/, "");
  return `${racine}/storage/v1/object/public/${BUCKET_PUBLIC}/${fichier.split("/").map(encodeURIComponent).join("/")}`;
}
