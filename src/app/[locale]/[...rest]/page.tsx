import { notFound } from "next/navigation";

// Rendue à la demande, comme les autres routes qui appellent notFound() : sans cela, Next.js signale en développement
// « Could not validate `instant` » à chaque 404, et son badge d'erreur recouvrait le bas du menu mobile (connexion.spec.ts en CI).
export const instant = false;

// Toute URL inconnue sous /fr ou /en rend la 404 traduite de [locale]/not-found.tsx.
export default function PageInconnue() {
  notFound();
}
