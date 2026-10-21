import { notFound } from "next/navigation";

// Toute URL inconnue sous /fr ou /en rend la 404 traduite de [locale]/not-found.tsx.
export default function PageInconnue() {
  notFound();
}
