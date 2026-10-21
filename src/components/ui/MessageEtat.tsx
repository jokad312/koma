import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export type TypeEtat = "succes" | "attention" | "erreur" | "information";

const COULEURS: Record<TypeEtat, string> = {
  succes: "text-success",
  attention: "text-warning",
  erreur: "text-danger",
  information: "text-text-primary",
};

// Une forme d'icône par type : l'état n'est jamais porté par la couleur seule.
const ICONES: Record<TypeEtat, ReactNode> = {
  succes: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  attention: <path d="M12 4l9 16H3L12 4zm0 6v5m0 3v.01" />,
  erreur: <path d="M6 6l12 12M18 6L6 18" />,
  information: <path d="M12 11v6m0-10v.01M12 3a9 9 0 100 18 9 9 0 000-18z" />,
};

type Props = { type: TypeEtat; children: ReactNode };

// Reflète un état réel lu côté serveur : jamais simulé (règle 13). Les erreurs sont annoncées en alerte, le reste en statut.
export function MessageEtat({ type, children }: Props) {
  const t = useTranslations("Composants.etat");
  return (
    <div
      role={type === "erreur" ? "alert" : "status"}
      className="t-small flex items-start gap-3 rounded-md border border-border bg-surface p-4 text-text-primary"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`mt-0.5 size-5 shrink-0 fill-none stroke-current stroke-2 ${COULEURS[type]}`}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONES[type]}
      </svg>
      <p>
        <span className="sr-only">{t(type)}</span>
        {children}
      </p>
    </div>
  );
}
