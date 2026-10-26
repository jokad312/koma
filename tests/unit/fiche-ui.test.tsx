// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { BandeauZone } from "@/components/fiche/BandeauZone";
import { BoutonPartager } from "@/components/fiche/BoutonPartager";
import { GaleriePhotos } from "@/components/fiche/GaleriePhotos";
import { ModesRemise } from "@/components/fiche/ModesRemise";
import { ZoneAchat } from "@/components/fiche/ZoneAchat";
import { ID_RACINE_PAGE } from "@/components/layout/constantes";
import type { PhotoFiche, TailleFiche } from "@/modules/catalogue/types";

beforeEach(() => {
  vi.restoreAllMocks();
  // jsdom ne mesure rien et n'implémente pas scrollTo.
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

const photos = (n: number): PhotoFiche[] => Array.from({ length: n }, (_, i) => ({ url: `http://127.0.0.1:54321/p/${i + 1}.jpg`, alt: `TEST_Alt ${i + 1}` }));
const t = (taille: TailleFiche["taille"], etat: TailleFiche["etat"], delaiJours: number | null = null): TailleFiche => ({ taille, etat, delaiJours });

describe("GaleriePhotos", () => {
  it("annonce « Photo 1 sur 3 » en statut, textes alternatifs, vignettes et boutons précédent / suivant", async () => {
    rendre(
      <div id={ID_RACINE_PAGE}>
        <GaleriePhotos photos={photos(3)} />
      </div>,
    );
    expect(screen.getByRole("status").textContent).toBe("Photo 1 sur 3");
    expect(screen.getByAltText("TEST_Alt 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Photo précédente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Photo suivante" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voir la photo 3" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Photo suivante" }));
    expect(screen.getByRole("status").textContent).toBe("Photo 2 sur 3");
    await userEvent.click(screen.getByRole("button", { name: "Voir la photo 3" }));
    expect(screen.getByRole("status").textContent).toBe("Photo 3 sur 3");
    expect(screen.getByRole("button", { name: "Voir la photo 3" }).getAttribute("aria-current")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Photo suivante" }));
    expect(screen.getByRole("status").textContent).toBe("Photo 1 sur 3");
  });

  it("une seule photo : ni boutons de défilement ni vignettes", () => {
    rendre(<GaleriePhotos photos={photos(1)} />);
    expect(screen.queryByRole("button", { name: "Photo précédente" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Photo suivante" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Voir la photo/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Agrandir" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Photo 1 sur 1");
  });

  it("Agrandir ouvre la boîte de dialogue avec + et − ; Échap la ferme et rend le focus", async () => {
    rendre(
      <div id={ID_RACINE_PAGE}>
        <GaleriePhotos photos={photos(2)} />
      </div>,
    );
    const agrandir = screen.getByRole("button", { name: "Agrandir" });
    await userEvent.click(agrandir);
    const dialogue = screen.getByRole("dialog", { name: "Photo agrandie" });
    const avant = within(dialogue).getByRole("button", { name: "Zoom avant" });
    const arriere = within(dialogue).getByRole("button", { name: "Zoom arrière" });
    expect(arriere.hasAttribute("disabled")).toBe(true);
    await userEvent.click(avant);
    expect(arriere.hasAttribute("disabled")).toBe(false);
    const zone = within(dialogue).getByRole("group", { name: "Photo agrandie, à faire défiler" });
    expect((zone.firstElementChild as HTMLElement).style.width).toBe("150%");
    await userEvent.click(arriere);
    expect((zone.firstElementChild as HTMLElement).style.width).toBe("100%");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(agrandir);
  });
});

describe("GaleriePhotos : défilement", () => {
  function piste(conteneur: HTMLElement) {
    const ul = conteneur.querySelector("ul") as HTMLUListElement;
    Object.defineProperty(ul, "clientWidth", { value: 300, configurable: true });
    return ul;
  }

  it("un balayage tactile met à jour l'index (Photo 2 sur 3)", () => {
    const { container } = rendre(<GaleriePhotos photos={photos(3)} />);
    const ul = piste(container);
    ul.scrollLeft = 300;
    fireEvent.scroll(ul);
    expect(screen.getByRole("status").textContent).toBe("Photo 2 sur 3");
  });

  it("« suivante » défile vers index × largeur ; le défilement lissé ne fait pas clignoter l'index jusqu'à scrollend", async () => {
    const { container } = rendre(<GaleriePhotos photos={photos(3)} />);
    const ul = piste(container);
    const scrollTo = vi.fn();
    ul.scrollTo = scrollTo as unknown as typeof ul.scrollTo;
    await userEvent.click(screen.getByRole("button", { name: "Photo suivante" }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 300 }));
    expect(screen.getByRole("status").textContent).toBe("Photo 2 sur 3");
    // Images intermédiaires du défilement lissé : ignorées.
    ul.scrollLeft = 40;
    fireEvent.scroll(ul);
    expect(screen.getByRole("status").textContent).toBe("Photo 2 sur 3");
    fireEvent(ul, new Event("scrollend"));
    ul.scrollLeft = 300;
    fireEvent.scroll(ul);
    expect(screen.getByRole("status").textContent).toBe("Photo 2 sur 3");
    ul.scrollLeft = 600;
    fireEvent.scroll(ul);
    expect(screen.getByRole("status").textContent).toBe("Photo 3 sur 3");
  });
});

describe("ZoneAchat : tailles", () => {
  const props = { locale: "fr" as const, forfaitGoma: null, forfaitBukavu: null, retraitGoma: null };

  it("radios natifs en groupe nommé ; choisir une taille met à jour son état et son délai sur place, sans quantité", async () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "en_stock", 14), t("L", "sur_commande", 12)]} />);
    const groupe = screen.getByRole("group", { name: "Taille" });
    const radios = within(groupe).getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["M", "L"]);
    expect(new Set(radios.map((r) => (r as HTMLInputElement).name)).size).toBe(1);
    expect(screen.getByText("Choisis une taille pour voir sa disponibilité.")).toBeTruthy();

    await userEvent.click(screen.getByRole("radio", { name: "M" }));
    expect(screen.getByText("En stock")).toBeTruthy();
    expect(screen.queryByText(/Délai de fabrication/)).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: "L" }));
    expect(screen.getByText("Fabrication sur commande")).toBeTruthy();
    expect(screen.getByText("Délai de fabrication : 12 jours")).toBeTruthy();
    // Le délai total est dit en deux membres, sans addition.
    expect(screen.getAllByText("Délai : fabrication 12 jours, puis remise en moins d'un jour").length).toBe(1);
    expect(screen.getAllByText("Délai : fabrication 12 jours, puis remise en un jour au plus").length).toBe(1);
    expect(document.body.textContent).not.toMatch(/Épuisé/i);
  });

  it("toutes les tailles sur commande, aucune choisie : texte « choisis une taille pour voir le délai » au lieu du délai de remise seul", async () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "sur_commande", 12), t("L", "sur_commande", 20)]} />);
    expect(screen.getAllByText("Fabrication sur commande : choisis une taille pour voir le délai")).toHaveLength(2);
    expect(screen.queryByText(/Délai : remise/)).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "L" }));
    expect(screen.queryByText(/choisis une taille pour voir le délai/)).toBeNull();
    expect(screen.getAllByText("Délai : fabrication 20 jours, puis remise en moins d'un jour")).toHaveLength(1);
  });

  it("une taille en stock existe : le délai de remise seul reste affiché avant le choix", () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "en_stock"), t("L", "sur_commande", 20)]} />);
    expect(screen.queryByText(/choisis une taille pour voir le délai/)).toBeNull();
    expect(screen.getByText("Délai : remise en moins d'un jour")).toBeTruthy();
  });

  it("navigation aux flèches entre les tailles", async () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "en_stock"), t("L", "en_stock")]} />);
    await userEvent.click(screen.getByRole("radio", { name: "M" }));
    await userEvent.keyboard("{ArrowRight}");
    expect((screen.getByRole("radio", { name: "L" }) as HTMLInputElement).checked).toBe(true);
  });

  it("Sur mesure : libellé et état « Sur mesure », sans schéma de mesures", async () => {
    rendre(<ZoneAchat {...props} tailles={[t("sur_mesure", "sur_commande", 30)]} />);
    await userEvent.click(screen.getByRole("radio", { name: "Sur mesure" }));
    expect(screen.getAllByText("Sur mesure").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Délai de fabrication : 30 jours")).toBeTruthy();
  });

  it("capacité atteinte : « Commandes complètes pour le moment », seules les tailles en stock restent, jamais « Épuisé »", () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "en_stock"), t("L", "complet"), t("XL", "complet")]} />);
    expect(screen.getByText("Commandes complètes pour le moment")).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["M"]);
    expect(document.body.textContent).not.toMatch(/Épuisé/i);
  });

  it("capacité atteinte et aucune taille en stock : le sélecteur disparaît", () => {
    rendre(<ZoneAchat {...props} tailles={[t("L", "complet"), t("sur_mesure", "complet")]} />);
    expect(screen.getByText("Commandes complètes pour le moment")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Taille" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("aucune taille achetable sans capacité atteinte : indisponible pour le moment", () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "indisponible")]} />);
    expect(screen.getByText("Indisponible pour le moment")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("aucun bouton d'ajout au panier", () => {
    rendre(<ZoneAchat {...props} tailles={[t("M", "en_stock")]} />);
    expect(screen.queryByRole("button", { name: /panier|cart/i })).toBeNull();
  });
});

describe("ModesRemise", () => {
  it("forfaits et lieu réglés : retrait gratuit, livraison au forfait, délais de remise", () => {
    rendre(<ModesRemise locale="fr" forfaitGoma={500} forfaitBukavu={1200} retraitGoma="TEST_Lieu de retrait" fabrication={null} />);
    expect(screen.getByText("Retrait gratuit : TEST_Lieu de retrait")).toBeTruthy();
    expect(screen.getAllByText(/Livraison : /).map((e) => e.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("5,00"), expect.stringContaining("12,00")]));
    expect(screen.getByText("Délai : remise en moins d'un jour")).toBeTruthy();
    expect(screen.getByText("Délai : remise en un jour au plus")).toBeTruthy();
  });

  it("forfaits et lieu non réglés : aucun montant, aucun retrait gratuit", () => {
    rendre(<ModesRemise locale="fr" forfaitGoma={null} forfaitBukavu={null} retraitGoma={null} fabrication={null} />);
    expect(screen.queryByText(/Retrait gratuit/)).toBeNull();
    expect(screen.queryByText(/Livraison : /)).toBeNull();
    expect(screen.getByRole("heading", { name: "Bukavu" })).toBeTruthy();
    expect(screen.getByText("Délai : remise en un jour au plus")).toBeTruthy();
  });

  it("forfait de Goma seul : la ligne Bukavu n'affiche pas de montant", () => {
    rendre(<ModesRemise locale="en" forfaitGoma={0} forfaitBukavu={null} retraitGoma={null} fabrication={null} />, "en");
    expect(screen.getAllByText(/Delivery: /)).toHaveLength(1);
  });

  it("fabrication sans délai fixé : jamais de délai inventé", () => {
    rendre(<ModesRemise locale="fr" forfaitGoma={null} forfaitBukavu={null} retraitGoma={null} fabrication={{ jours: null }} />);
    expect(screen.getByText("Délai : fabrication sur commande, puis remise en moins d'un jour")).toBeTruthy();
  });
});

describe("BandeauZone", () => {
  it("annonce la zone de remise, sans argot ni emoji", () => {
    rendre(<BandeauZone />);
    expect(screen.getByText("Remise uniquement à Goma et Bukavu")).toBeTruthy();
  });
});

describe("BoutonPartager", () => {
  it("sans navigator.share : copie le lien et annonce « Lien copié » en statut", async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true });
    rendre(<BoutonPartager titre="TEST_Titre" url="http://localhost:3000/fr/cosplays/test" />);
    await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    expect(ecrire).toHaveBeenCalledWith("http://localhost:3000/fr/cosplays/test");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Lien copié"));
  });

  it("avec navigator.share : ouvre le partage natif, sans copier", async () => {
    const partager = vi.fn().mockResolvedValue(undefined);
    const ecrire = vi.fn();
    Object.defineProperty(navigator, "share", { value: partager, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true });
    rendre(<BoutonPartager titre="TEST_Titre" url="http://localhost:3000/fr/cosplays/test" />);
    await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    expect(partager).toHaveBeenCalledWith({ title: "TEST_Titre", url: "http://localhost:3000/fr/cosplays/test" });
    expect(ecrire).not.toHaveBeenCalled();
  });

  it("navigator.share échoue (hors annulation) : repli sur la copie du lien", async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: vi.fn().mockRejectedValue(new Error("TEST")), configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true });
    rendre(<BoutonPartager titre="TEST_Titre" url="http://localhost:3000/x" />);
    await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    expect(ecrire).toHaveBeenCalledWith("http://localhost:3000/x");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Lien copié"));
  });

  it("une seconde copie est ré-annoncée : le message est vidé puis remis", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    rendre(<BoutonPartager titre="TEST_Titre" url="http://localhost:3000/x" />);
    const zone = screen.getByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    await waitFor(() => expect(zone.textContent).toBe("Lien copié"));
    const vus: string[] = [];
    const observateur = new MutationObserver(() => vus.push(zone.textContent ?? ""));
    observateur.observe(zone, { childList: true, characterData: true, subtree: true });
    await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    observateur.disconnect();
    expect(vus).toContain("");
    expect(zone.textContent).toBe("Lien copié");
  });

  it("partage annulé : aucun message ; échec de copie : message sobre", async () => {
    Object.defineProperty(navigator, "share", { value: vi.fn().mockRejectedValue(new DOMException("annulé", "AbortError")), configurable: true });
    rendre(<BoutonPartager titre="TEST_Titre" url="http://localhost:3000/x" />);
    await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    expect(screen.getByRole("status").textContent).toBe("");

    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("TEST")) }, configurable: true });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Partager" }));
    });
    expect(screen.getByRole("status").textContent).toBe("Impossible de partager le lien pour le moment.");
  });
});
