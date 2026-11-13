import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export const CLASSES_CARTE = "relative flex flex-col gap-2 rounded-lg border border-border bg-surface p-4";
export const CLASSES_LIEN = "t-body inline-flex min-h-touch items-center text-text-primary underline underline-offset-4";
export const CLASSES_GRILLE = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

// Un bloc de l'espace personnel (story 9.12) : titre H2 relié à la région, contenu, lien « tout voir » facultatif.
export function BlocEspace({ id, titre, children, suite }: { id: string; titre: string; children: ReactNode; suite?: { href: string; libelle: string } | null }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="t-h2">
        {titre}
      </h2>
      {children}
      {suite ? (
        <Link href={suite.href} className={`${CLASSES_LIEN} self-start`}>
          {suite.libelle}
        </Link>
      ) : null}
    </section>
  );
}

// Bloc vide : un message simple et un lien utile.
export function VideEspace({ message, lien }: { message: string; lien: { href: string; libelle: string } }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="t-body text-text-primary">{message}</p>
      <Link href={lien.href} className={CLASSES_LIEN}>
        {lien.libelle}
      </Link>
    </div>
  );
}
