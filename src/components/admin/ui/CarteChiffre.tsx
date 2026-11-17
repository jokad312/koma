import type { LucideIcon } from "lucide-react";

// Carte de chiffre de l'admin (story 9.16 b, maquettes E1 à E4 et B2) : icône décorative, chiffre en grand, libellé en majuscules espacées.
// Le chiffre est déjà formaté par la page (montant, nombre) ; aucune lecture en base ici. Le lecteur d'écran lit le libellé puis le chiffre ;
// à l'écran, le chiffre est au-dessus (ordre visuel de la maquette).
// texte : le « chiffre » est une phrase courte (par exemple « Aucune donnée ») ; il est écrit plus petit pour garder la hauteur de la carte.
export function CarteChiffre({ icone: Icone, chiffre, libelle, texte = false }: { icone: LucideIcon; chiffre: string; libelle: string; texte?: boolean }) {
  return (
    <div className="flex min-h-[120px] flex-col justify-between gap-3 rounded-[20px] border border-admin-contour bg-admin-carte p-5 text-text-primary">
      <p className="t-label order-2">{libelle}</p>
      <p className="order-1 flex items-center gap-4">
        <Icone aria-hidden="true" className="size-10 shrink-0" strokeWidth={1.5} />
        <span className={`min-w-0 break-words ${texte ? "t-h3" : "t-h2"}`}>{chiffre}</span>
      </p>
    </div>
  );
}
