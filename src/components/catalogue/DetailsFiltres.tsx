"use client";

import { useEffect, useRef, type ReactNode } from "react";

// <details> natif : replié sur mobile sous « Filtrer (n) ». Sur ordinateur (lg et plus), il s'ouvre au chargement ;
// sans JavaScript il reste replié et les filtres restent atteignables au clavier.
export function DetailsFiltres({ resume, children }: { resume: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(min-width: 64rem)").matches && details.current) details.current.open = true;
  }, []);

  return (
    <details ref={details} className="rounded-lg border border-border bg-surface">
      <summary className="t-button flex min-h-touch cursor-pointer items-center px-4 text-text-primary">{resume}</summary>
      <div className="flex flex-col gap-5 border-t border-border p-4">{children}</div>
    </details>
  );
}
