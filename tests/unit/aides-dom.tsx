import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

// Outils des tests de composants (environnement jsdom) : rendu avec les vrais messages, nettoyage entre les tests.
afterEach(() => cleanup());

export function rendre(ui: ReactElement, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}
