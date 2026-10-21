"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { appliquerTheme, ATTRIBUT_THEME, themeActuel } from "@/lib/theme/theme";

function suivre(rappel: () => void) {
  const observateur = new MutationObserver(rappel);
  observateur.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUT_THEME] });
  return () => observateur.disconnect();
}

const estSombre = () => themeActuel() === "dark";
// Côté serveur le thème est inconnu : crème, comme sans JavaScript.
const estSombreServeur = () => false;

export function BasculeTheme() {
  const t = useTranslations("Theme");
  const sombre = useSyncExternalStore(suivre, estSombre, estSombreServeur);

  return (
    <button
      type="button"
      aria-pressed={sombre}
      onClick={() => appliquerTheme(sombre ? "light" : "dark")}
      className={`t-small inline-flex min-h-touch items-center gap-2 rounded-full border border-border-field px-4 ${
        sombre ? "bg-text-primary text-background" : "bg-surface text-text-primary"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        {sombre ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />}
      </svg>
      <span>{t("sombre")}</span>
    </button>
  );
}
