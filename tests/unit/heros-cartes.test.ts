import { describe, expect, it } from "vitest";
import { choisirCartesHeros } from "@/modules/accueil/heros-cartes-choix";
import type { CarteProduit } from "@/modules/catalogue/types";

function carte(famille: CarteProduit["famille"], slug: string): CarteProduit {
  return { id: `id-${slug}`, slug, famille, titre: `Titre ${slug}`, photoAlt: "alt de test", photoUrl: `https://exemple.test/${slug}.jpg`, prixCents: 1000, disponibilite: "disponible", niveau: null };
}

describe("choisirCartesHeros", () => {
  it("cosplay : le plus récent différent de la vedette ; accessoire et kit : les plus récents", () => {
    const r = choisirCartesHeros({
      cosplays: [carte("cosplay", "vedette"), carte("cosplay", "autre"), carte("cosplay", "ancien")],
      accessoires: [carte("accessoire", "perruque"), carte("accessoire", "masque")],
      kits: [carte("kit", "armure"), carte("kit", "ancien-kit")],
      slugVedette: "vedette",
    });
    expect(r.cosplay?.slug).toBe("autre");
    expect(r.accessoire?.slug).toBe("perruque");
    expect(r.kit?.slug).toBe("armure");
  });

  it("seule la vedette est publiée : elle sert de carte cosplay", () => {
    const r = choisirCartesHeros({ cosplays: [carte("cosplay", "vedette")], accessoires: [], kits: [], slugVedette: "vedette" });
    expect(r.cosplay?.slug).toBe("vedette");
  });

  it("aucun produit publié : toutes les cartes sont masquées (null), rien d'inventé", () => {
    const r = choisirCartesHeros({ cosplays: [], accessoires: [], kits: [], slugVedette: null });
    expect(r).toEqual({ cosplay: null, accessoire: null, kit: null });
  });

  it("accessoire ou kit absent : seule cette carte est masquée", () => {
    const r = choisirCartesHeros({ cosplays: [carte("cosplay", "a")], accessoires: [], kits: [carte("kit", "k")], slugVedette: null });
    expect(r.cosplay?.slug).toBe("a");
    expect(r.accessoire).toBeNull();
    expect(r.kit?.slug).toBe("k");
  });
});
