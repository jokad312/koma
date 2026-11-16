// Avatar carré à l'initiale (story 9.16 b, maquettes B7 et CP6) : décoratif, le nom est toujours écrit à côté. Sans lettre ni chiffre dans le nom : rien
// (jamais une initiale inventée).
export function initiale(nom: string): string {
  return (nom.match(/[\p{L}\p{N}]/u)?.[0] ?? "").toLocaleUpperCase();
}

export function AvatarInitiale({ nom }: { nom: string }) {
  const lettre = initiale(nom);
  if (!lettre) return null;
  return (
    <span aria-hidden="true" className="t-h3 inline-flex size-[52px] shrink-0 items-center justify-center rounded-[10px] bg-admin-avatar text-admin-sur-avatar">
      {lettre}
    </span>
  );
}
