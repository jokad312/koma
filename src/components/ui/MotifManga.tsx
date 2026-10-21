type Props = { variante?: "trame" | "traits" | "cases" };

// Décor de fond de section, opacité plafonnée à 6 % (CSS). À placer dans un parent `relative`.
// Jamais sur une photo produit, derrière un petit texte, un formulaire ou un texte de paiement ; jamais dans l'admin.
export function MotifManga({ variante = "trame" }: Props) {
  return <div aria-hidden="true" className={`motif-manga motif-${variante}`} />;
}
