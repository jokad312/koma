import type { LucideIcon } from "lucide-react";
import { Nombre } from "@/components/ui/Nombre";

// Carte de chiffre de l'admin (story 9.16 b, maquettes E1 à E4 et B2) : icône décorative, chiffre en grand, libellé en majuscules espacées.
// Le chiffre est déjà formaté par la page (montant, nombre) ; aucune lecture en base ici. Le lecteur d'écran lit le libellé puis le chiffre ;
// à l'écran, le chiffre est au-dessus (ordre visuel de la maquette).
// texte : le « chiffre » est une phrase courte (par exemple « Aucune donnée ») ; il est écrit plus petit pour garder la hauteur de la carte.
// nombre : le chiffre est un nombre ou un montant (par défaut quand ce n'est pas un texte) ; il est alors exclu de la traduction automatique
// du navigateur (A3-bis). Une phrase (« Aucune donnée ») reste traduisible.
export function CarteChiffre({ icone: Icone, chiffre, libelle, texte = false, nombre = !texte }: { icone: LucideIcon; chiffre: string; libelle: string; texte?: boolean; nombre?: boolean }) {
  return (
    <div className="flex min-h-[120px] flex-col justify-between gap-3 rounded-[20px] border border-admin-contour bg-admin-carte p-5 text-text-primary">
      <p className="t-label order-2">{libelle}</p>
      <p className="order-1 flex items-center gap-4">
        <Icone aria-hidden="true" className="size-10 shrink-0" strokeWidth={1.5} />
        <span className={`min-w-0 break-words ${texte ? "t-h3" : "t-h2"}`}>{nombre ? <Nombre>{chiffre}</Nombre> : chiffre}</span>
      </p>
    </div>
  );
}
