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
