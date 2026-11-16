// En-tête de tableau de l'admin (story 9.16 b, maquettes B6, CP5) : barre arrondie de la couleur « en-tête », libellés en majuscules espacées.
// À placer dans un <table> : rend le <thead> ; chaque colonne est un <th scope="col">.
export type ColonneTableau = { cle: string; libelle: string; className?: string };

export function EnTeteTableau({ colonnes }: { colonnes: readonly ColonneTableau[] }) {
  return (
    <thead>
      <tr className="bg-admin-entete">
        {colonnes.map(({ cle, libelle, className = "" }, i) => (
          <th
            key={cle}
            scope="col"
            className={`t-label px-4 py-3 text-left text-text-primary ${i === 0 ? "rounded-l-[16px]" : ""} ${i === colonnes.length - 1 ? "rounded-r-[16px]" : ""} ${className}`}
          >
            {libelle}
          </th>
        ))}
      </tr>
    </thead>
  );
}
