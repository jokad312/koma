import type { ReactNode } from "react";

// Pastille d'information de l'admin (story 9.16 b, maquettes C9 à C12 et C16) : « PRIX : … », « UNIVERS : … », statut… Texte seul, sans action.
export function Pastille({ children }: { children: ReactNode }) {
  return <span className="t-label inline-flex min-h-9 items-center rounded-full bg-admin-info px-4 py-1 text-text-primary">{children}</span>;
}
