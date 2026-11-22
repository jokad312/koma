// @vitest-environment jsdom
import { NextIntlClientProvider } from "next-intl";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre, traduireCommeLeNavigateur } from "./aides-dom";

// A3-bis (2026-11-22) : sur une page traduite par le navigateur, seuls les nombres qui changent (prix, totaux, quantités, remises, numéros,
// codes) sont exclus de la traduction (translate="no"). Le reste du texte reste traduisible ; un nombre dans une phrase est seul enveloppé.

const faux = vi.hoisted(() => ({ lirePanier: vi.fn(), recapPass: vi.fn(), creerPass: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => "/fr/panier" }));
vi.mock("@/modules/panier/actions", () => ({ modifierLigneParFormulaire: vi.fn(), retirerLigneParFormulaire: vi.fn() }));
vi.mock("@/modules/panier/queries", () => ({ lirePanier: (...a: unknown[]) => faux.lirePanier(...a) }));
vi.mock("@/modules/evenements/achat-actions", () => ({
  lireRecapitulatifPassAction: (...a: unknown[]) => faux.recapPass(...a),
  creerCommandePassAction: (...a: unknown[]) => faux.creerPass(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return {
    getTranslations: async (arg: string | { namespace: string }) =>
      createTranslator({ locale: "fr", messages, namespace: (typeof arg === "string" ? arg : arg.namespace) as never }),
    getLocale: async () => "fr",
  };
});

import { RecapCommande } from "@/components/commande/RecapCommande";
import { PagePanier } from "@/components/panier/PagePanier";
import { Nombre } from "@/components/ui/Nombre";
import { FormulaireAchatPass } from "@/components/festival/FormulaireAchatPass";
import { formaterUsd } from "@/lib/argent";
import type { Recapitulatif } from "@/modules/commande/types";
import type { LignePanier, PanierLu } from "@/modules/panier/types";

const espaces = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim();
const usd = (cents: number) => espaces(formaterUsd(cents, "fr"));
// Textes exclus de la traduction, dans l'ordre du document.
const nonTraduits = (racine: HTMLElement) => Array.from(racine.querySelectorAll('[translate="no"]')).map((e) => espaces(e.textContent));

// Chaque texte visible hors des nombres reste traduisible : aucun ancêtre translate="no".
function textesHorsNombres(racine: HTMLElement) {
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  const textes: string[] = [];
  while (parcours.nextNode()) {
    const noeud = parcours.currentNode as Text;
    if (noeud.data.trim() !== "" && !noeud.parentElement?.closest('[translate="no"]')) textes.push(noeud.data);
  }
  return textes;
}

describe("<Nombre>", () => {
  it("un <span translate=\"no\"> qui garde le texte tel quel", () => {
    const { container } = rendre(<Nombre>12,00 $US</Nombre>);
    const span = container.querySelector("span");
    expect(span?.getAttribute("translate")).toBe("no");
    // Classe lue par les traducteurs qui ignorent l'attribut translate.
    expect(span?.className).toBe("notranslate");
    expect(span?.textContent).toBe("12,00 $US");
    expect(container.innerHTML).toBe('<span translate="no" class="notranslate">12,00 $US</span>');
  });

  it("la traduction simulée du navigateur saute son contenu", () => {
    const { container } = rendre(
      <p>
        {"Prix : "}
        <Nombre>12,00 $US</Nombre>
      </p>,
    );
    expect(traduireCommeLeNavigateur(container)).toBe(1);
    expect(container.querySelector("font")?.textContent).toBe("[traduit] Prix : ");
    expect(container.querySelector('[translate="no"]')?.textContent).toBe("12,00 $US");
  });
});

const ligne = (s: Partial<LignePanier> = {}): LignePanier => ({
  id: "00000000-0000-4000-8000-0000000000c1",
  produitId: "00000000-0000-4000-8000-0000000000aa",
  famille: "cosplay",
  slug: "test-cosplay",
  titre: "TEST_Cosplay",
  taille: "M",
  nombre: 2,
  prixCents: 1200,
  etat: "sur_commande",
  delaiJours: 14,
  ...s,
});
const panier = (lignes: LignePanier[]): PanierLu => ({
  lignes,
  nombreArticles: lignes.reduce((s, l) => s + l.nombre, 0),
  sousTotalCents: lignes.reduce((s, l) => s + l.prixCents * l.nombre, 0),
  bloque: false,
  avisKitPossede: false,
});

describe("PagePanier traduite par le navigateur", () => {
  it("le libellé est traduit, le prix unitaire, le total de ligne et le sous-total restent intacts ; le délai reste traduisible", async () => {
    faux.lirePanier.mockResolvedValue(panier([ligne()]));
    const { container } = rendre(await PagePanier({ locale: "fr" }));
    // Seuls les nombres de la liste sont marqués : prix unitaire, total de ligne, sous-total. Le délai de fabrication n'en fait pas partie.
    expect(nonTraduits(container)).toEqual([usd(1200), usd(2400), usd(2400)]);

    traduireCommeLeNavigateur(container);
    const prix = Array.from(container.querySelectorAll("p")).find((p) => p.textContent?.includes("l'unité"));
    // « 12,00 $US l'unité » : le libellé passe par le traducteur, le montant non.
    expect(prix?.querySelector("font")?.textContent).toBe("[traduit]  l'unité");
    expect(espaces(prix?.querySelector('[translate="no"]')?.textContent ?? null)).toBe(usd(1200));
    const total = Array.from(container.querySelectorAll("p")).find((p) => p.textContent?.includes("Total de la ligne"));
    expect(total?.querySelector("font")?.textContent).toBe("[traduit] Total de la ligne : ");
    expect(espaces(total?.querySelector('[translate="no"]')?.textContent ?? null)).toBe(usd(2400));
    const delai = Array.from(container.querySelectorAll("p")).find((p) => p.textContent?.includes("Délai de fabrication"));
    expect(delai?.querySelector('[translate="no"]')).toBeNull();
    expect(delai?.textContent).toBe("[traduit] Délai de fabrication : 14 jours");
    // Titre, état, libellés et boutons : traduits (aucun ancêtre translate="no").
    expect(textesHorsNombres(container).every((t) => t.startsWith("[traduit] "))).toBe(true);
  });
});

const recap = (s: Partial<Recapitulatif> = {}): Recapitulatif => ({
  lignes: [
    {
      ligneId: "00000000-0000-4000-8000-0000000000c1",
      produitId: "00000000-0000-4000-8000-0000000000aa",
      famille: "cosplay",
      slug: "test-cosplay",
      titre: "TEST_Cosplay",
      taille: "M",
      nombre: 1,
      prixCents: 1200,
      etat: "disponible",
      origine: "stock",
      delaiFabricationJours: null,
      reductionCents: 0,
    },
  ],
  physique: true,
  kit: false,
  surMesure: false,
  sousTotalCents: 1200,
  forfaitCents: 500,
  reductionCents: 120,
  code: { valide: true, code: "TEST10", reductionPct: 10 },
  totalCents: 1580,
  indisponible: false,
  remiseManquante: false,
  empreinte: "0123456789abcdef0123456789abcdef",
  ...s,
});

function Recap({ valeur }: { valeur: Recapitulatif }) {
  return (
    <NextIntlClientProvider locale="fr" messages={fr}>
      <RecapCommande recap={valeur} zone="goma" mode="livraison" locale="fr" />
    </NextIntlClientProvider>
  );
}

describe("RecapCommande traduit par le navigateur", () => {
  it("libellés traduits ; quantité, prix, sous-total, code, réduction, forfait et total intacts", () => {
    const { container } = rendre(<Recap valeur={recap()} />);
    expect(nonTraduits(container)).toEqual(["1", usd(1200), usd(1200), "TEST10", usd(120), usd(500), usd(1580)]);
    traduireCommeLeNavigateur(container);
    const reduction = Array.from(container.querySelectorAll("dt")).find((dt) => dt.textContent?.includes("TEST10"));
    // « Réduction (TEST10) » : le libellé est traduit, le code reste tel quel.
    expect(Array.from(reduction?.querySelectorAll("font font") ?? []).map((f) => f.textContent)).toEqual(["[traduit] Réduction (", "[traduit] )"]);
    expect(reduction?.querySelector('[translate="no"]')?.textContent).toBe("TEST10");
    expect(textesHorsNombres(container).every((t) => t.startsWith("[traduit] "))).toBe(true);
  });

  it("après la traduction, une quantité et un total qui changent s'affichent à jour (pas l'ancien nombre)", () => {
    const { container, rerender } = rendre(<Recap valeur={recap()} />);
    traduireCommeLeNavigateur(container);
    const ligne2 = { ...recap().lignes[0], nombre: 2 };
    rerender(<Recap valeur={recap({ lignes: [ligne2], sousTotalCents: 2400, reductionCents: 240, totalCents: 2660 })} />);
    expect(nonTraduits(container)).toEqual(["2", usd(1200), usd(2400), "TEST10", usd(240), usd(500), usd(2660)]);
    expect(espaces(container.textContent)).toContain(usd(2660));
    expect(espaces(container.textContent)).not.toContain(usd(1580));
  });
});

const A = fr.Festival.achat;
const TYPE = { id: "00000000-0000-4000-8000-0000000000d1", nom: "TEST_Simple", prixCents: 1500, inclus: null, complet: false };

describe("FormulaireAchatPass traduit par le navigateur", () => {
  it("clic + après la traduction : le compteur affiché suit ; le Récapitulatif montre le total du serveur, intact", async () => {
    faux.recapPass.mockResolvedValue({
      ok: true,
      recap: {
        lignes: [{ typePassId: TYPE.id, nom: TYPE.nom, nombre: 2, prixCents: 1500, reductionCents: 0, titulaires: ["TEST_Alice", "TEST_Bob"] }],
        personnes: 2,
        sousTotalCents: 3000,
        reductionCents: 0,
        code: null,
        totalCents: 3000,
      },
    });
    const { container } = rendre(<FormulaireAchatPass evenementId="00000000-0000-4000-8000-0000000000c1" slug="test-evenement" nomCompte="TEST_Alice" types={[TYPE]} />);
    traduireCommeLeNavigateur(container);
    const sortie = within(screen.getByRole("group", { name: A.quantite.replace("{nom}", TYPE.nom) })).getByRole("status");
    expect(sortie.textContent).toBe("0");
    // Les boutons sont trouvés par leur aria-label (attribut, non touché par la traduction simulée).
    const plus = screen.getByRole("button", { name: A.ajouter.replace("{nom}", TYPE.nom) });
    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(sortie.textContent).toBe("2");
    expect(sortie.querySelector('[translate="no"]')?.textContent).toBe("2");

    await userEvent.type(screen.getAllByRole("textbox")[0], "TEST_Bob");
    await userEvent.click(Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(A.voirRecap)) as HTMLButtonElement);
    const recap = await screen.findByRole("heading", { name: A.recap.titre });
    traduireCommeLeNavigateur(container);
    const section = recap.closest("section") as HTMLElement;
    const total = Array.from(section.querySelectorAll("dd")).at(-1);
    expect(espaces(total?.textContent ?? null)).toBe(usd(3000));
    expect(total?.querySelector('[translate="no"]')).not.toBeNull();
    expect(nonTraduits(section)).toEqual(["2", usd(1500), usd(3000), usd(3000)]);
  });
});
