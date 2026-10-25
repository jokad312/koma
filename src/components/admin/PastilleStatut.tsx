// Pastille de statut d'un produit : icône + mot, jamais la couleur seule.
export function PastilleStatut({ publie, libelle }: { publie: boolean; libelle: string }) {
  return (
    <span className="t-small inline-flex items-center gap-2 rounded-full border border-border-field px-3 py-1 text-text-primary">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        {publie ? <path d="M3 8.5 6.5 12 13 4.5" /> : <path d="M3 13l1-4 7-7 3 3-7 7-4 1z" />}
      </svg>
      {libelle}
    </span>
  );
}
