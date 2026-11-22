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
// Comme le navigateur, il saute les textes dont un ancêtre porte translate="no" (A3-bis). Renvoie le nombre de textes remplacés.
export function traduireCommeLeNavigateur(racine: HTMLElement) {
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('[translate="no"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
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

// Un nombre marqué translate="no" (A3-bis) est dans son propre <span> : la phrase qui le contient est coupée en plusieurs nœuds texte,
// que getByText ne relie pas. Ce matcher compare le texte complet de l'élément (espaces normalisés) et garde l'élément le plus profond.
const normaliser = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim();

export function texteComplet(attendu: string | RegExp) {
  const motif = typeof attendu === "string" ? normaliser(attendu) : new RegExp(attendu.source, attendu.flags.replace("g", ""));
  const correspond = (texte: string | null) => (typeof motif === "string" ? normaliser(texte) === motif : motif.test(normaliser(texte)));
  return (_contenu: string, element: Element | null) =>
    element !== null && correspond(element.textContent) && !Array.from(element.children).some((enfant) => correspond(enfant.textContent));
}

// Message brut des fichiers de traduction sans ses balises (<nb>…</nb>), pour construire le texte attendu.
export function sansBalises(message: string) {
  return message.replace(/<\/?[a-z]+>/gi, "");
}

// Texte complet qui se termine par `attendu` (par exemple après le préfixe « Attention : » lu par le lecteur d'écran de MessageEtat).
export function finDeTexte(attendu: string) {
  return texteComplet(new RegExp(`${normaliser(attendu).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}
