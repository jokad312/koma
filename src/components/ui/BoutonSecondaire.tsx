import { Bouton, type PropsBouton } from "./Bouton";

type Props = PropsBouton extends infer P ? (P extends unknown ? Omit<P, "variante"> : never) : never;

// Pilule surface opaque, contour border-field, texte text-primary. Jamais pour payer.
export function BoutonSecondaire(props: Props) {
  return <Bouton {...(props as PropsBouton)} variante="secondaire" />;
}
