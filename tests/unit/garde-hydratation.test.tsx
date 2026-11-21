// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GardeHydratation } from "@/components/admin/GardeHydratation";

const page = (
  <GardeHydratation>
    <form>
      <input name="titre" aria-label="Titre" />
      <button type="submit">Enregistrer</button>
      <a href="#contenu">Aller au contenu</a>
    </form>
  </GardeHydratation>
);

describe("garde d'hydratation de l'admin (point 5)", () => {
  it("rendu serveur : fieldset désactivé (champs et boutons inactifs sans JavaScript) ; après l'hydratation : actifs", async () => {
    const html = renderToString(page);
    expect(html).toMatch(/<fieldset[^>]*disabled/);
    const racine = document.createElement("div");
    racine.innerHTML = html;
    document.body.appendChild(racine);
    const champ = racine.querySelector("input") as HTMLInputElement;
    expect(champ.matches(":disabled")).toBe(true);
    expect((racine.querySelector("button") as HTMLButtonElement).matches(":disabled")).toBe(true);
    await act(async () => {
      hydrateRoot(racine, page);
    });
    expect(racine.querySelector("fieldset")?.hasAttribute("disabled")).toBe(false);
    expect(champ.matches(":disabled")).toBe(false);
    expect(racine.querySelector("[data-admin-pret]")).toBeTruthy();
  });
});
