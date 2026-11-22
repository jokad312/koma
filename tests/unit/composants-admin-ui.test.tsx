// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Package } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre, texteComplet } from "./aides-dom";

const routeur = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => routeur,
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { AvatarInitiale, initiale } from "@/components/admin/ui/AvatarInitiale";
import { CarteChiffre } from "@/components/admin/ui/CarteChiffre";
import { ChampRecherche } from "@/components/admin/ui/ChampRecherche";
import { CLASSES_TABLEAU_ADMIN, EnTeteTableau } from "@/components/admin/ui/EnTeteTableau";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import { Pagination } from "@/components/admin/ui/Pagination";
import { Panneau } from "@/components/admin/ui/Panneau";
import { Pastille } from "@/components/admin/ui/Pastille";
import { PastilleFiltre } from "@/components/admin/ui/PastilleFiltre";
import { Dialogue } from "@/components/ui/Dialogue";

beforeEach(() => routeur.push.mockReset());

describe("composants communs de l'admin (9.16 b)", () => {
  it("CarteChiffre : libellé puis chiffre dans le DOM, icône décorative, couleur « carte »", () => {
    const { container } = rendre(<CarteChiffre icone={Package} chiffre="12" libelle="Produits publiés" />);
    const carte = container.firstElementChild as HTMLElement;
    expect(carte.className).toContain("bg-admin-carte");
    expect(carte.textContent).toBe("Produits publiés12");
    expect(carte.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("Panneau : section avec titre du niveau demandé et action à droite", () => {
    rendre(
      <Panneau titre="Performance des ventes" niveau={3} action={<span>30 derniers jours</span>}>
        contenu
      </Panneau>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Performance des ventes" })).toBeTruthy();
    expect(screen.getByText("30 derniers jours")).toBeTruthy();
    expect(screen.getByText("contenu").className).toContain("bg-admin-panneau");
  });

  it("ChampRecherche : champ de recherche nommé par son libellé (pas seulement le texte indicatif), loupe décorative", () => {
    rendre(<ChampRecherche libelle="Rechercher une commande" name="q" placeholder="Numéro ou client" defaultValue="KS-1" />);
    const champ = screen.getByRole("searchbox", { name: "Rechercher une commande" }) as HTMLInputElement;
    expect(champ.name).toBe("q");
    expect(champ.value).toBe("KS-1");
    expect(champ.className).toContain("bg-admin-entete");
    expect(champ.closest("label")?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("Pastille : texte seul sur fond « info »", () => {
    rendre(<Pastille>Prix : 20 $</Pastille>);
    expect(screen.getByText("Prix : 20 $").className).toContain("bg-admin-info");
  });

  it("PastilleFiltre (bouton) : état annoncé par aria-pressed et marqué par la forme (contour de 2 px), pas seulement la couleur", async () => {
    const choisir = vi.fn();
    const user = userEvent.setup();
    rendre(
      <>
        <PastilleFiltre actif onClick={() => {}}>
          Toutes
        </PastilleFiltre>
        <PastilleFiltre actif={false} onClick={choisir}>
          Payées
        </PastilleFiltre>
      </>,
    );
    const actif = screen.getByRole("button", { name: "Toutes" });
    const inactif = screen.getByRole("button", { name: "Payées" });
    expect(actif.getAttribute("aria-pressed")).toBe("true");
    expect(inactif.getAttribute("aria-pressed")).toBe("false");
    expect(actif.className).toContain("border-2");
    expect(actif.className).toContain("bg-admin-filtre");
    expect(inactif.className).not.toContain("border-2");
    expect(inactif.className).toContain("bg-transparent");
    for (const b of [actif, inactif]) expect(b.className).toContain("min-h-touch");
    await user.click(inactif);
    expect(choisir).toHaveBeenCalledTimes(1);
  });

  it("PastilleFiltre (lien) : filtre porté par l'adresse, état annoncé par aria-current", () => {
    rendre(
      <>
        <PastilleFiltre actif href="/admin/commandes?statut=payee">
          Payées
        </PastilleFiltre>
        <PastilleFiltre actif={false} href="/admin/commandes">
          Toutes
        </PastilleFiltre>
      </>,
    );
    expect(screen.getByRole("link", { name: "Payées" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "Toutes" }).getAttribute("aria-current")).toBeNull();
  });

  it("EnTeteTableau : en-têtes de colonne d'un vrai tableau, barre arrondie aux deux bouts (fond sur chaque cellule, bordures séparées)", () => {
    expect(CLASSES_TABLEAU_ADMIN).toContain("border-separate");
    rendre(
      <table className={CLASSES_TABLEAU_ADMIN}>
        <EnTeteTableau
          colonnes={[
            { cle: "numero", libelle: "N° commande" },
            { cle: "client", libelle: "Client" },
            { cle: "montant", libelle: "Montant" },
          ]}
        />
        <tbody />
      </table>,
    );
    const entetes = screen.getAllByRole("columnheader");
    expect(entetes.map((e) => e.textContent)).toEqual(["N° commande", "Client", "Montant"]);
    for (const e of entetes) expect(e.getAttribute("scope")).toBe("col");
    expect(entetes[0].className).toContain("rounded-l-[16px]");
    expect(entetes[2].className).toContain("rounded-r-[16px]");
    for (const e of entetes) expect(e.className).toContain("bg-admin-entete");
  });

  it("AvatarInitiale : première lettre en majuscule, décoratif ; sans lettre : rien (pas d'initiale inventée)", () => {
    expect(initiale("élodie M.")).toBe("É");
    expect(initiale("  42 shop")).toBe("4");
    expect(initiale("***")).toBe("");
    const { container } = rendre(<AvatarInitiale nom="koma" />);
    const avatar = container.firstElementChild as HTMLElement;
    expect(avatar.textContent).toBe("K");
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.className).toContain("bg-admin-avatar");
    const vide = rendre(<AvatarInitiale nom="---" />);
    expect(vide.container.firstElementChild).toBeNull();
  });

  describe("Pagination", () => {
    const adresse = (n: number) => `/admin/commandes?page=${n}`;

    it("page du milieu : ‹ et › sont des liens vers la page voisine, « Page X / Y »", () => {
      rendre(<Pagination page={2} total={5} adresse={adresse} />);
      const nav = screen.getByRole("navigation", { name: "Pagination" });
      expect(within(nav).getByRole("link", { name: "Page précédente" }).getAttribute("href")).toBe("/admin/commandes?page=1");
      expect(within(nav).getByRole("link", { name: "Page suivante" }).getAttribute("href")).toBe("/admin/commandes?page=3");
      expect(within(nav).getByText(texteComplet("Page 2 / 5"))).toBeTruthy();
    });

    it("première et dernière page : la flèche du bord est inactive (sans adresse, annoncée désactivée)", () => {
      rendre(<Pagination page={1} total={3} adresse={adresse} />);
      const precedente = screen.getByRole("link", { name: "Page précédente" });
      expect(precedente.getAttribute("aria-disabled")).toBe("true");
      expect(precedente.hasAttribute("href")).toBe(false);
      rendre(<Pagination page={3} total={3} adresse={adresse} />);
      const suivantes = screen.getAllByRole("link", { name: "Page suivante" });
      expect(suivantes[1].getAttribute("aria-disabled")).toBe("true");
    });

    it("valeurs non numériques ou décimales lues dans l'adresse : ramenées à des entiers", () => {
      rendre(<Pagination page={Number.NaN} total={3.7} adresse={adresse} />);
      expect(screen.getByText(texteComplet("Page 1 / 3"))).toBeTruthy();
      const { container } = rendre(<Pagination page={2} total={Number.NaN} adresse={adresse} />);
      expect(container.firstElementChild).toBeNull();
    });

    it("page hors limites ramenée dans [1, total] ; une seule page : rien", () => {
      rendre(<Pagination page={9} total={4} adresse={adresse} />);
      expect(screen.getByText(texteComplet("Page 4 / 4"))).toBeTruthy();
      const { container } = rendre(<Pagination page={1} total={1} adresse={adresse} />);
      expect(container.firstElementChild).toBeNull();
    });

    it("en anglais", () => {
      rendre(<Pagination page={1} total={2} adresse={adresse} />, "en");
      expect(screen.getByRole("link", { name: "Next page" })).toBeTruthy();
    });
  });

  describe("FenetreFormulaire (Q23)", () => {
    function fenetre() {
      return rendre(
        <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits" idFormulaire="TEST_formulaire">
          <form id="TEST_formulaire">
            <label>
              Nom
              <input name="nom" />
            </label>
          </form>
        </FenetreFormulaire>,
      );
    }

    it("titre de niveau 1, « Enregistrer » soumet le formulaire désigné, la croix ramène à la liste", () => {
      fenetre();
      expect(screen.getByRole("heading", { level: 1, name: "Nouveau produit" })).toBeTruthy();
      const enregistrer = screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
      expect(enregistrer.type).toBe("submit");
      expect(enregistrer.getAttribute("form")).toBe("TEST_formulaire");
      expect(screen.getByRole("link", { name: "Fermer et revenir à la liste" }).getAttribute("href")).toBe("/admin/produits");
    });

    it("sans modification : la croix est un lien direct vers la liste, aucune confirmation", async () => {
      const user = userEvent.setup();
      fenetre();
      const croix = screen.getByRole("link", { name: "Fermer et revenir à la liste" });
      croix.addEventListener("click", (e) => e.preventDefault()); // jsdom ne navigue pas : on vérifie seulement qu'aucune fenêtre ne s'ouvre.
      await user.click(croix);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("champ modifié : Échap demande « Quitter sans enregistrer ? » ; « Continuer la saisie » garde la page, « Quitter » ramène à la liste", async () => {
      const user = userEvent.setup();
      fenetre();
      await user.type(screen.getByRole("textbox", { name: "Nom" }), "TEST_ polo");
      await user.keyboard("{Escape}");
      expect(routeur.push).not.toHaveBeenCalled();
      const confirmation = screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" });
      await user.click(within(confirmation).getByRole("button", { name: "Continuer la saisie" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(routeur.push).not.toHaveBeenCalled();
      expect((screen.getByRole("textbox", { name: "Nom" }) as HTMLInputElement).value).toBe("TEST_ polo");
      await user.keyboard("{Escape}");
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitter" }));
      expect(routeur.push).toHaveBeenCalledWith("/admin/produits");
    });

    it("champ modifié : la croix demande aussi la confirmation ; Échap dans la confirmation la ferme sans quitter", async () => {
      const user = userEvent.setup();
      fenetre();
      await user.type(screen.getByRole("textbox", { name: "Nom" }), "x");
      await user.click(screen.getByRole("link", { name: "Fermer et revenir à la liste" }));
      expect(screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" })).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(routeur.push).not.toHaveBeenCalled();
    });

    it("une vraie fenêtre ouverte au-dessus (Dialogue, écouteur ajouté après celui du formulaire) : Échap la ferme sans quitter le formulaire", async () => {
      const user = userEvent.setup();
      function AvecAide() {
        const [ouvert, setOuvert] = useState(false);
        return (
          <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits" idFormulaire="TEST_formulaire">
            <button type="button" onClick={() => setOuvert(true)}>
              {"Ouvrir l'aide"}
            </button>
            <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="TEST_ aide" entete="fenetre">
              texte
            </Dialogue>
          </FenetreFormulaire>
        );
      }
      rendre(<AvecAide />);
      await user.click(screen.getByRole("button", { name: "Ouvrir l'aide" }));
      expect(screen.getByRole("dialog", { name: "TEST_ aide" })).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(routeur.push).not.toHaveBeenCalled();
    });

    it("Échap dans une liste déroulante native ou pendant l'enregistrement : on reste sur la page", async () => {
      const user = userEvent.setup();
      const { rerender } = rendre(
        <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits" idFormulaire="f">
          <select aria-label="Famille">
            <option>Cosplay</option>
          </select>
        </FenetreFormulaire>,
      );
      screen.getByRole("combobox", { name: "Famille" }).focus();
      await user.keyboard("{Escape}");
      expect(routeur.push).not.toHaveBeenCalled();
      rerender(
        <NextIntlClientProvider locale="fr" messages={fr}>
          <FenetreFormulaire titre="Nouveau produit" retour="/admin/produits" idFormulaire="f" enregistrementEnCours>
            x
          </FenetreFormulaire>
        </NextIntlClientProvider>,
      );
      (document.activeElement as HTMLElement | null)?.blur();
      await user.keyboard("{Escape}");
      expect(routeur.push).not.toHaveBeenCalled();
    });

    it("Échap ramène à la liste ; une touche Échap déjà traitée (fenêtre au-dessus) est ignorée", async () => {
      const user = userEvent.setup();
      fenetre();
      await user.keyboard("{Escape}");
      expect(routeur.push).toHaveBeenCalledWith("/admin/produits");
      routeur.push.mockReset();
      const evenement = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      evenement.preventDefault();
      document.dispatchEvent(evenement);
      expect(routeur.push).not.toHaveBeenCalled();
    });

    it("en anglais", () => {
      rendre(
        <FenetreFormulaire titre="New product" retour="/admin/produits" idFormulaire="f">
          x
        </FenetreFormulaire>,
        "en",
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Close and go back to the list" })).toBeTruthy();
    });
  });
});
