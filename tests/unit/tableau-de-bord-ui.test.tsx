// @vitest-environment jsdom
// Story 9.16 c) : tableau de bord selon la maquette. Graphique des 30 jours (une barre par jour, zéros réels, axe gradué, tableau des données),
// Performance du jour (nombre et montant, date selon la langue, plafond), « À faire » et « Indicateurs » avec « Voir plus », zones illisibles
// annoncées (jamais un faux zéro). Données de test nommées TEST_ : jamais utilisées hors des tests.
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { rendre, texteComplet } from "./aides-dom";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (arg: string) => createTranslator({ locale: "fr", messages: fr, namespace: arg as never }),
    getLocale: async () => "fr",
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { ApercuTaches, CartesTaches } from "@/components/admin/tableau/CartesTaches";
import { GraphiqueJours } from "@/components/admin/tableau/GraphiqueJours";
import { ApercuIndicateurs, Indicateurs } from "@/components/admin/tableau/Indicateurs";
import { PerformanceJour } from "@/components/admin/tableau/PerformanceJour";
import { formaterUsd, serieParJour } from "@/modules/tableau-de-bord/calculs";
import { joursFenetre } from "@/modules/tableau-de-bord/periode";
import type { CarteTache, DonneesTableau } from "@/modules/tableau-de-bord/queries";

const TEST_MAINTENANT = new Date("2026-11-17T10:00:00Z");
const TEST_JOURS = joursFenetre(30, TEST_MAINTENANT);
const TEST_PAIEMENTS = [
  { jour: "2026-11-16", prestataire: "pawapay", famille: "kit", commandes: 1, montant_cents: 1000 },
  { jour: "2026-11-17", prestataire: "maishapay", famille: "cosplay", commandes: 1, montant_cents: 5500 },
];
const TEST_CHIFFRES = { produitsPublies: 4, commandesPayees: 7, revenuCents: 12345, tentativesReussies: 3, tentativesTerminees: 4, evenementsAVenir: 2, pass7: 1, pass30: 5 };
const TEST_TACHES: CarteTache[] = (
  ["mesures", "annulations", "remboursements", "remplacements", "tropPercus", "stock", "photos", "retraits", "realisations", "messages", "anomalies"] as const
).map((cle, i) => ({ cle, nombre: i === 1 ? null : i, href: "/admin/taches" }));

function donnees(partiel: Partial<DonneesTableau> = {}): DonneesTableau {
  return {
    commandesPayees: [],
    paiements: TEST_PAIEMENTS,
    tropPercus: [],
    echecs7: [],
    echecs30: [],
    delai7: { lignesRecues: 0, lignesEnAttente: 0, delaiMoyenHeures: null },
    delai30: { lignesRecues: 0, lignesEnAttente: 0, delaiMoyenHeures: null },
    visites: [],
    entonnoir: [],
    origines: [],
    ventesCodes: [],
    deuxiemesAchats: { clientsPayants: 0, clientsDeuxAchats: 0 },
    desinscriptions: [],
    taches: TEST_TACHES,
    chiffres: TEST_CHIFFRES,
    ventesJour: [],
    ...partiel,
  };
}

describe("GraphiqueJours (Q10)", () => {
  it("30 barres rouges, une par jour ; les jours sans vente valent 0, la plus haute ne dépasse pas l'axe", () => {
    const { container } = rendre(<GraphiqueJours points={serieParJour(TEST_PAIEMENTS, TEST_JOURS)} />);
    const barres = [...container.querySelectorAll<HTMLElement>("[data-barre]")];
    expect(barres).toHaveLength(30);
    expect(barres.every((b) => b.className.includes("bg-admin-barre"))).toBe(true);
    expect(barres.filter((b) => b.style.height !== "0%").map((b) => b.dataset.barre)).toEqual(["2026-11-16", "2026-11-17"]);
    expect(Number.parseFloat(barres[29].style.height)).toBeLessThanOrEqual(100);
    expect(Number.parseFloat(barres[29].style.height)).toBeGreaterThan(Number.parseFloat(barres[28].style.height));
  });

  it("une date tous les 5 jours sous l'axe, la dernière étant aujourd'hui ; axe gradué à partir de 0", () => {
    const { container } = rendre(<GraphiqueJours points={serieParJour(TEST_PAIEMENTS, TEST_JOURS)} />);
    const dessin = container.querySelector('[aria-hidden="true"].grid') as HTMLElement;
    const dates = [...dessin.querySelectorAll("span.text-right")].map((s) => s.textContent);
    expect(dates).toHaveLength(6);
    expect(dates[5]).toBe("17/11");
    expect(dessin.textContent).toMatch(/^0\s\$US/u);
  });

  it("le dessin est caché aux lecteurs d'écran, décrit par un résumé ; le tableau donne les 30 jours", () => {
    const { container } = rendre(<GraphiqueJours points={serieParJour(TEST_PAIEMENTS, TEST_JOURS)} />);
    expect(container.querySelector("[data-barre]")?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText(/Graphique en barres des ventes payées par jour/)).toBeTruthy();
    const tableau = screen.getByRole("table", { name: "Ventes payées par jour, 30 derniers jours" });
    const lignes = within(tableau).getAllByRole("row");
    expect(lignes).toHaveLength(31);
    expect(lignes[30].textContent).toContain("17 novembre 2026");
    expect(lignes[30].textContent).toContain("55,00");
    expect(lignes[1].textContent).toContain("0,00");
  });

  it("30 jours sans vente : message d'état vide, l'axe et les 30 barres à zéro restent", () => {
    const { container } = rendre(<GraphiqueJours points={serieParJour([], TEST_JOURS)} />);
    expect(screen.getByText("Aucune vente payée sur les 30 derniers jours.")).toBeTruthy();
    expect(container.querySelectorAll("[data-barre]")).toHaveLength(30);
    expect([...container.querySelectorAll<HTMLElement>("[data-barre]")].every((b) => b.style.height === "0%")).toBe(true);
  });

  it("avec des ventes : pas de message d'état vide ; le résumé renvoie au libellé du tableau", () => {
    rendre(<GraphiqueJours points={serieParJour(TEST_PAIEMENTS, TEST_JOURS)} />);
    expect(screen.queryByText("Aucune vente payée sur les 30 derniers jours.")).toBeNull();
    expect(screen.getByText(/Les mêmes chiffres sont dans « Voir les données en tableau »/)).toBeTruthy();
  });

  it("lecture en échec : « Cette zone n'a pas pu être lue », aucune barre", () => {
    const { container } = rendre(<GraphiqueJours points={null} />);
    expect(screen.getByRole("alert").textContent).toContain("Cette zone n'a pas pu être lue");
    expect(container.querySelectorAll("[data-barre]")).toHaveLength(0);
  });

  it("en anglais : date du jour au format de la langue", () => {
    const { container } = rendre(<GraphiqueJours points={serieParJour(TEST_PAIEMENTS, TEST_JOURS)} />, "en");
    const dates = [...container.querySelectorAll('[aria-hidden="true"].grid span.text-right')].map((s) => s.textContent);
    expect(dates[5]).toBe("11/17");
    expect(en.Admin.tableau.ventes.legende).toBe("Revenue");
  });
});

describe("PerformanceJour (Q11)", () => {
  it("nombre et montant des ventes payées aujourd'hui, date JJ/MM/AAAA à Goma", () => {
    rendre(<PerformanceJour commandes={[{ numero: "KS-TEST-1", totalCents: 5500, prestataire: "maishapay", familles: ["cosplay"] }, { numero: "KS-TEST-2", totalCents: 1000, prestataire: "pawapay", familles: ["kit"] }]} maintenant={TEST_MAINTENANT} />);
    expect(screen.getByText("Ventes du 17/11/2026 :")).toBeTruthy();
    expect(document.querySelector("[data-ventes-nombre]")?.textContent).toBe("2");
    expect(document.querySelector("[data-ventes-montant]")?.textContent).toMatch(/65,00/);
  });

  it("à 23 h 30 UTC, c'est déjà le lendemain à Goma", () => {
    rendre(<PerformanceJour commandes={[]} maintenant={new Date("2026-11-17T23:30:00Z")} />);
    expect(screen.getByText("Ventes du 18/11/2026 :")).toBeTruthy();
    expect(document.querySelector("[data-ventes-nombre]")?.textContent).toBe("0");
  });

  it("au plafond de lecture : « au moins », jamais présenté comme exact", () => {
    const commandes = Array.from({ length: 200 }, (_, i) => ({ numero: `KS-TEST-${i}`, totalCents: 100, prestataire: "pawapay", familles: ["kit"] }));
    rendre(<PerformanceJour commandes={commandes} maintenant={TEST_MAINTENANT} />);
    expect(document.querySelector("[data-ventes-nombre]")?.textContent).toBe("au moins 200");
  });

  it("lecture en échec : la zone le dit, aucun zéro", () => {
    rendre(<PerformanceJour commandes={null} maintenant={TEST_MAINTENANT} />);
    expect(screen.getByRole("alert").textContent).toContain("Cette zone n'a pas pu être lue");
    expect(document.querySelector("[data-ventes-nombre]")).toBeNull();
  });
});

describe("À faire et Indicateurs de la maquette (Q12, Q13, décisions 2 et 3)", () => {
  it("À faire : Mesures à recevoir et Demandes d'annulation, puis « Voir plus » vers /admin/taches", async () => {
    rendre(await ApercuTaches({ cartes: TEST_TACHES }));
    const section = screen.getByRole("region", { name: "À faire" });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Mesures à recevoir", "Demandes d'annulation"]);
    // Compteur illisible : « Lecture impossible », jamais 0.
    expect(within(section).getByText("Lecture impossible")).toBeTruthy();
    const lien = within(section).getByRole("link", { name: "Voir plus (toutes les tâches)" });
    expect(lien.getAttribute("href")).toBe("/admin/taches");
  });

  it("Toutes les tâches : les 11 cartes", async () => {
    rendre(await CartesTaches({ cartes: TEST_TACHES }));
    const section = screen.getByRole("region", { name: "Toutes les tâches" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(11);
  });

  it("Indicateurs : Ventes payées (SM-1) sur 7 et 30 jours, Événements et Pass vendus, « Voir plus » vers la liste complète", async () => {
    rendre(await ApercuIndicateurs({ donnees: donnees(), maintenant: TEST_MAINTENANT }));
    const section = screen.getByRole("region", { name: "Indicateurs" });
    expect(within(section).getByRole("heading", { name: "Ventes payées (SM-1)" })).toBeTruthy();
    expect(section.textContent).toMatch(/7 jours65,00/);
    expect(within(section).getByText(texteComplet("Événements à venir : 2"))).toBeTruthy();
    expect(within(section).getByText(texteComplet("Pass vendus (7 jours) : 1"))).toBeTruthy();
    expect(within(section).getByText(texteComplet("Pass vendus (30 jours) : 5"))).toBeTruthy();
    expect(within(section).getByRole("link", { name: "Voir plus (tous les indicateurs)" }).getAttribute("href")).toBe("#indicateurs");
  });

  it("Indicateurs : zones illisibles annoncées, aucun zéro inventé", async () => {
    rendre(await ApercuIndicateurs({ donnees: donnees({ paiements: null, chiffres: null }), maintenant: TEST_MAINTENANT }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText(/^Pass vendus/)).toBeNull();
  });

  it("Indicateurs : sans vente sur la période, « Aucune donnée sur la période »", async () => {
    rendre(await ApercuIndicateurs({ donnees: donnees({ paiements: [] }), maintenant: TEST_MAINTENANT }));
    expect(screen.getAllByText("Aucune donnée sur la période")).toHaveLength(2);
  });

  it("Tous les indicateurs : ancre #indicateurs ; SM-4 calculé avec les mêmes chiffres (plus de « epic 7 pas encore construit »)", async () => {
    const { container } = rendre(await Indicateurs({ donnees: donnees(), maintenant: TEST_MAINTENANT }));
    // Cible de « Voir plus » : focusable par le lien d'ancre (tabIndex -1), hors de l'ordre de tabulation.
    expect(container.querySelector("section#indicateurs")?.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("heading", { level: 2, name: "Tous les indicateurs" })).toBeTruthy();
    const sm4 = screen.getByRole("heading", { name: /SM-4/ }).closest("li") as HTMLElement;
    expect(sm4.textContent).toContain("2 événements à venir, 1 Pass vendu");
    expect(sm4.textContent).toContain("2 événements à venir, 5 Pass vendus");
    expect(sm4.textContent).toContain("Les inscriptions aux alertes événement ne sont pas encore comptées.");
    expect((fr.Admin.tableau.indicateurs as Record<string, string>).raisonSm4).toBeUndefined();
  });

  // A3-bis : les valeurs sont des nœuds React (montants dans <Nombre>) ; la liste garde ses séparateurs et son ordre (formatToParts),
  // et le détail par famille de SM-1 est bien placé dans la balise <detail></detail> du message.
  it("SM-1 et SM-C2 : texte complet (montants, détail par famille, séparateurs, ordre), nombres seuls exclus de la traduction", async () => {
    const echecs = [
      { prestataire: "pawapay", moyen: "mobile_money", tentatives: 4, reussies: 3, echouees_client: 0, echouees_prestataire: 1, abandonnees: 0, en_cours: 0 },
      { prestataire: "maishapay", moyen: "carte", tentatives: 2, reussies: 2, echouees_client: 0, echouees_prestataire: 0, abandonnees: 0, en_cours: 0 },
    ];
    rendre(await Indicateurs({ donnees: donnees({ echecs7: echecs, echecs30: echecs }), maintenant: TEST_MAINTENANT }));
    const espaces = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
    const usd = (c: number) => espaces(formaterUsd(c, "fr"));
    const liste = (elements: string[]) => espaces(new Intl.ListFormat("fr", { style: "short", type: "unit" }).format(elements));
    const valeurs = (titre: RegExp) => Array.from((screen.getByRole("heading", { name: titre }).closest("li") as HTMLElement).querySelectorAll("dd"));

    const sm1 = valeurs(/^SM-1 ·/);
    const detail = liste([`Cosplay ${usd(5500)} (1 commande)`, `Kit ${usd(1000)} (1 commande)`]);
    expect(espaces(sm1[0].textContent)).toBe(`${usd(6500)} (${detail})`);
    expect(espaces(sm1[1].textContent)).toBe(`${usd(6500)} (${detail})`);
    expect(Array.from(sm1[0].querySelectorAll('[translate="no"]')).map((e) => espaces(e.textContent))).toEqual([usd(6500), usd(5500), "1", usd(1000), "1"]);

    const smc2 = valeurs(/^SM-C2 ·/);
    expect(espaces(smc2[0].textContent)).toBe(liste(["MaishaPay : 0 % (0 échec sur 2)", "PawaPay : 25 % (1 échec sur 4)"]));
  });
});
