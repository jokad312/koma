// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ chemin: "/fr/accessoires", requete: "" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => faux.chemin,
  useSearchParams: () => new URLSearchParams(faux.requete),
}));

import { SelecteurLangue } from "@/components/layout/SelecteurLangue";

beforeEach(() => {
  faux.chemin = "/fr/accessoires";
  faux.requete = "";
});

describe("SelecteurLangue : chemin et requête conservés, adresse propre de l'autre langue", () => {
  it("/fr/accessoires?tri=prix_asc bascule vers /en/accessories?tri=prix_asc", () => {
    faux.requete = "tri=prix_asc";
    rendre(<SelecteurLangue />);
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en/accessories?tri=prix_asc");
  });

  it("filtres et curseur sont conservés tels quels", () => {
    faux.requete = "univers=abc&prix=1500-3000&dispo=en_stock&tri=prix_desc&curseur=CUR";
    rendre(<SelecteurLangue />);
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe(
      "/en/accessories?univers=abc&prix=1500-3000&dispo=en_stock&tri=prix_desc&curseur=CUR",
    );
  });

  it("depuis l'anglais : retour vers l'adresse française, requête conservée", () => {
    faux.chemin = "/en/accessories";
    faux.requete = "dispo=sur_commande";
    rendre(<SelecteurLangue />, "en");
    expect(screen.getByRole("link", { name: "Français" }).getAttribute("href")).toBe("/fr/accessoires?dispo=sur_commande");
  });

  it("une page sans adresse propre garde le même chemin ; sans requête, pas de « ? »", () => {
    faux.chemin = "/fr/cosplays";
    rendre(<SelecteurLangue />);
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en/cosplays");
  });
});
