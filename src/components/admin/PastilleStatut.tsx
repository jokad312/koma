// Pastille de statut d'un produit : icône + mot, jamais la couleur seule.
// archive (story 9.16 g) : icône de boîte d'archive à la place du crayon du brouillon.
export function PastilleStatut({ publie, libelle, archive = false }: { publie: boolean; libelle: string; archive?: boolean }) {
  return (
    <span className="t-small inline-flex items-center gap-2 rounded-full border border-border-field px-3 py-1 text-text-primary">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        {archive ? <path d="M2 3h12v3H2zM3 6v7h10V6M6.5 9h3" /> : publie ? <path d="M3 8.5 6.5 12 13 4.5" /> : <path d="M3 13l1-4 7-7 3 3-7 7-4 1z" />}
      </svg>
      {libelle}
    </span>
  );
}
