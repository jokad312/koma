import { useId, type ComponentPropsWithoutRef, type MouseEventHandler, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { CLASSES_DESACTIVE, CLASSES_PRINCIPAL, CLASSES_SECONDAIRE } from "./classes";

type Variante = "principal" | "secondaire";

// raison : un nœud, pour qu'un nombre qui change (compte à rebours) puisse porter translate="no" (A3-bis).
type Etat = { desactive?: false; raison?: ReactNode } | { desactive: true; raison: ReactNode };

export type PropsBouton = Omit<ComponentPropsWithoutRef<"button">, "disabled" | "children"> &
  Etat & {
    children: ReactNode;
    variante?: Variante;
    // Paiement ou Commande en cours : même forme, indicateur discret, clic bloqué ; le libellé est changé par l'appelant.
    enCours?: boolean;
    // Lien présenté comme un bouton (adresse sans préfixe de langue).
    href?: string;
  };

export function Bouton({
  variante = "principal",
  desactive = false,
  raison,
  enCours = false,
  href,
  className,
  children,
  onClick,
  type,
  ...reste
}: PropsBouton) {
  const idRaison = useId();
  const base = desactive ? CLASSES_DESACTIVE : variante === "principal" ? CLASSES_PRINCIPAL : CLASSES_SECONDAIRE;
  const classes = className ? `${base} ${className}` : base;
  // Indicateur toujours présent dans le DOM, masqué (display: none) hors « en cours » : jamais inséré ni retiré à côté du libellé.
  // Sinon, quand la traduction automatique du navigateur (ou une extension) a remplacé le texte du libellé par ses propres nœuds
  // (<font>…), React ne retrouve plus le nœud de référence et plante (« Failed to execute 'insertBefore' on 'Node' »).
  const indicateur = (
    <span
      aria-hidden="true"
      data-indicateur-en-cours=""
      className={enCours ? "size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" : "hidden"}
    />
  );

  const bloque = desactive || enCours;

  if (href && !bloque) {
    const aria = Object.fromEntries(Object.entries(reste).filter(([cle]) => cle.startsWith("aria-")));
    return (
      <Link href={href} className={classes} onClick={onClick as unknown as MouseEventHandler<HTMLAnchorElement>} {...aria}>
        <span className="contents">{children}</span>
      </Link>
    );
  }

  return (
    <>
      <button
        {...reste}
        // Désactivé ou en cours : jamais « submit », et le clic n'est pas transmis (pas de double soumission).
        type={bloque ? "button" : (type ?? "button")}
        onClick={bloque ? undefined : onClick}
        aria-disabled={bloque || undefined}
        aria-describedby={desactive && raison ? idRaison : reste["aria-describedby"]}
        aria-busy={enCours || undefined}
        className={classes}
      >
        {indicateur}
        {/* Libellé dans son propre élément (display: contents : mise en page flex inchangée), pour la même raison. La clé change avec
            « en cours » : React remplace l'élément entier au lieu de modifier un nœud texte que la traduction aurait détaché (libellé figé). */}
        <span key={enCours ? "en-cours" : "repos"} className="contents">
          {children}
        </span>
      </button>
      {/* Toujours rendu (masqué sans raison) : jamais inséré ni retiré à côté d'un texte de l'appelant, pour la même raison. */}
      <span id={idRaison} className={desactive && raison ? "t-small mt-2 block text-text-secondary" : "hidden"}>
        {desactive && raison ? raison : null}
      </span>
    </>
  );
}
