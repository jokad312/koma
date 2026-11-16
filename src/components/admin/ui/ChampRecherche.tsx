import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

// Champ de recherche de l'admin (story 9.16 b, maquettes B4, C1, CP3) : pastille avec une loupe décorative. Le libellé est toujours présent pour les
// lecteurs d'écran (le texte indicatif ne le remplace pas). Champ ordinaire : la page le place dans son formulaire (GET) ou le relie à son propre état.
export function ChampRecherche({ libelle, ...champ }: { libelle: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label className="relative flex w-full max-w-[360px] items-center text-text-primary">
      <span className="sr-only">{libelle}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute left-4 size-5 text-text-secondary" />
      <input
        type="search"
        {...champ}
        className="t-body min-h-12 w-full rounded-full border border-border-field bg-admin-entete pl-12 pr-4 text-text-primary placeholder:text-text-secondary"
      />
    </label>
  );
}
