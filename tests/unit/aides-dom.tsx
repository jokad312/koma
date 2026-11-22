import { cleanup, configure, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

// Outils des tests de composants (environnement jsdom) : rendu avec les vrais messages, nettoyage entre les tests.
afterEach(() => cleanup());

// Les attentes asynchrones (findBy, waitFor) tolèrent une machine chargée quand toute la suite tourne en parallèle.
configure({ asyncUtilTimeout: 8000 });

export function rendre(ui: ReactElement, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// Simule la traduction automatique du navigateur (Google Traduction) : chaque nœud texte est remplacé par <font><font>texte</font></font>.
// Renvoie le nombre de textes remplacés.
export function traduireCommeLeNavigateur(racine: HTMLElement) {
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  const textes: Text[] = [];
  while (parcours.nextNode()) textes.push(parcours.currentNode as Text);
  for (const texte of textes) {
    const exterieur = document.createElement("font");
    const interieur = document.createElement("font");
    interieur.textContent = `[traduit] ${texte.data}`;
    exterieur.appendChild(interieur);
    texte.replaceWith(exterieur);
  }
  return textes.length;
}
