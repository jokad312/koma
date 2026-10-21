import { useId, type ComponentPropsWithoutRef, type MouseEventHandler, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { CLASSES_DESACTIVE, CLASSES_PRINCIPAL, CLASSES_SECONDAIRE } from "./classes";

type Variante = "principal" | "secondaire";

type Etat = { desactive?: false; raison?: string } | { desactive: true; raison: string };

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
  const indicateur = enCours ? (
    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  ) : null;

  const bloque = desactive || enCours;

  if (href && !bloque) {
    const aria = Object.fromEntries(Object.entries(reste).filter(([cle]) => cle.startsWith("aria-")));
    return (
      <Link href={href} className={classes} onClick={onClick as unknown as MouseEventHandler<HTMLAnchorElement>} {...aria}>
        {children}
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
        {children}
      </button>
      {desactive && raison ? (
        <span id={idRaison} className="t-small mt-2 block text-text-secondary">
          {raison}
        </span>
      ) : null}
    </>
  );
}
