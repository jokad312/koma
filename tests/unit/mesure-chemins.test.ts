import { describe, expect, it } from "vitest";
import { estActionMesure } from "@/modules/mesure/actions";
import {
  appareilDepuisLargeur,
  cheminDepuisReferer,
  domaineReferent,
  normaliserChemin,
  normaliserOrigine,
  pageMesuree,
  sansLangue,
} from "@/modules/mesure/chemins";

// Story 9.7 : règles pures du chemin, de l'origine et du référent (aucune donnée personnelle, aucune chaîne de requête).

describe("normaliserChemin", () => {
  it("garde un chemin seul et retire la requête et l'ancre", () => {
    expect(normaliserChemin("/cosplays/nezuko")).toBe("/cosplays/nezuko");
    expect(normaliserChemin("/cosplays/nezuko?c=secret")).toBe("/cosplays/nezuko");
    expect(normaliserChemin("/fr?curseur=abc#haut")).toBe("/fr");
    expect(normaliserChemin("/")).toBe("/");
  });

  it("refuse ce qui n'est pas un chemin interne", () => {
    expect(normaliserChemin(null)).toBeNull();
    expect(normaliserChemin("")).toBeNull();
    expect(normaliserChemin("cosplays")).toBeNull();
    expect(normaliserChemin("//exemple.test/x")).toBeNull();
    expect(normaliserChemin("/a b")).toBeNull();
    expect(normaliserChemin("/a\u0000b")).toBeNull();
    expect(normaliserChemin(`/${"a".repeat(200)}`)).toBeNull();
  });
});

describe("sansLangue", () => {
  it("retire le préfixe de langue, sans toucher un segment qui commence pareil", () => {
    expect(sansLangue("/fr")).toBe("/");
    expect(sansLangue("/fr/")).toBe("/");
    expect(sansLangue("/en/cosplays")).toBe("/cosplays");
    expect(sansLangue("/fr/blog/mon-article")).toBe("/blog/mon-article");
    expect(sansLangue("/cosplays")).toBe("/cosplays");
    expect(sansLangue("/frais")).toBe("/frais");
    expect(sansLangue("/enfer")).toBe("/enfer");
  });
});

describe("pageMesuree", () => {
  it("mesure les pages publiques, sans préfixe de langue", () => {
    expect(pageMesuree("vue_fiche", "/fr/cosplays/nezuko")).toBe("/cosplays/nezuko");
    expect(pageMesuree("clic_heros", "/")).toBe("/");
    expect(pageMesuree("ajout_panier", "/en/kits/onigiri")).toBe("/kits/onigiri");
  });

  it("refuse chaque page exclue", () => {
    for (const chemin of ["/fr/admin", "/fr/admin/commandes", "/fr/connexion", "/fr/commande/KS-2026-000001", "/en/checkout", "/fr/desinscription", "/fr/compte", "/fr/compte/photos"]) {
      expect(pageMesuree("vue_fiche", chemin)).toBeNull();
      expect(pageMesuree("clic_heros", chemin)).toBeNull();
    }
  });

  it("ne confond pas un préfixe exclu avec un segment qui commence pareil", () => {
    expect(pageMesuree("vue_fiche", "/fr/administration")).toBe("/administration");
    expect(pageMesuree("vue_fiche", "/fr/comptes")).toBe("/comptes");
    expect(pageMesuree("vue_fiche", "/fr/commandes")).toBe("/commandes");
  });

  it("enregistre « /compte » pour les actions de la liste fermée, jamais le sous-chemin", () => {
    expect(pageMesuree("photo_envoyee", "/fr/compte/photos")).toBe("/compte");
    expect(pageMesuree("realisation_envoyee", "/en/compte/realisation")).toBe("/compte");
    expect(pageMesuree("video_kit_demarree", "/fr/compte/bibliotheque/onigiri")).toBe("/compte");
    expect(pageMesuree("video_kit_terminee", "/fr/compte/bibliotheque/onigiri")).toBe("/compte");
    expect(pageMesuree("kit_gratuit_recupere", "/fr/compte/bibliotheque")).toBe("/compte");
    // Le Kit gratuit peut aussi être obtenu depuis une fiche publique.
    expect(pageMesuree("kit_gratuit_recupere", "/fr/kits/onigiri")).toBe("/kits/onigiri");
  });

  it("refuse une action privée venue d'une page publique", () => {
    expect(pageMesuree("photo_envoyee", "/fr/kits/onigiri")).toBeNull();
    expect(pageMesuree("video_kit_demarree", "/fr/cosplays/nezuko")).toBeNull();
  });
});

describe("cheminDepuisReferer", () => {
  it("lit le chemin d'un Referer de la même origine, sans la requête", () => {
    expect(cheminDepuisReferer("https://boutique.test/fr/cosplays/nezuko?c=secret", "boutique.test")).toBe("/fr/cosplays/nezuko");
    expect(cheminDepuisReferer("http://localhost:3000/fr", "localhost:3000")).toBe("/fr");
  });

  it("refuse un Referer absent, illisible ou d'une autre origine", () => {
    expect(cheminDepuisReferer(null, "boutique.test")).toBeNull();
    expect(cheminDepuisReferer("https://boutique.test/fr", null)).toBeNull();
    expect(cheminDepuisReferer("pas une adresse", "boutique.test")).toBeNull();
    expect(cheminDepuisReferer("https://exemple.test/admin", "boutique.test")).toBeNull();
    expect(cheminDepuisReferer("javascript:alert(1)", "boutique.test")).toBeNull();
    expect(cheminDepuisReferer("https://boutique.test.evil.test/fr", "boutique.test")).toBeNull();
  });
});

describe("origine et référent", () => {
  it("normalise l'origine en minuscules et refuse tout le reste", () => {
    expect(normaliserOrigine("WhatsApp")).toBe("whatsapp");
    expect(normaliserOrigine(" tiktok ")).toBe("tiktok");
    expect(normaliserOrigine("promo-2026")).toBe("promo-2026");
    expect(normaliserOrigine("a b")).toBeNull();
    expect(normaliserOrigine("a".repeat(41))).toBeNull();
    expect(normaliserOrigine("")).toBeNull();
    expect(normaliserOrigine(null)).toBeNull();
  });

  it("réduit le référent au domaine, sans www, sans chemin, sans le domaine du site", () => {
    expect(domaineReferent("https://www.tiktok.com/@koma/video/12?x=1")).toBe("tiktok.com");
    expect(domaineReferent("https://web.facebook.com/groupe")).toBe("web.facebook.com");
    expect(domaineReferent("https://boutique.test/fr/cosplays", "boutique.test")).toBeNull();
    expect(domaineReferent("https://www.boutique.test/fr", "boutique.test")).toBeNull();
    expect(domaineReferent("pas une adresse")).toBeNull();
    expect(domaineReferent("ftp://exemple.test/x")).toBeNull();
    expect(domaineReferent(null)).toBeNull();
  });

  it("déduit l'appareil de la largeur seulement", () => {
    expect(appareilDepuisLargeur(375)).toBe("mobile");
    expect(appareilDepuisLargeur(800)).toBe("tablette");
    expect(appareilDepuisLargeur(1280)).toBe("ordinateur");
    expect(appareilDepuisLargeur(0)).toBe("inconnu");
    expect(appareilDepuisLargeur(Number.NaN)).toBe("inconnu");
    expect(appareilDepuisLargeur(null)).toBe("inconnu");
  });
});

describe("liste fermée", () => {
  it("n'accepte que les actions connues", () => {
    expect(estActionMesure("vue_fiche")).toBe(true);
    expect(estActionMesure("achat")).toBe(false);
    expect(estActionMesure("")).toBe(false);
  });

describe("correctifs de la revue croisée", () => {
  it("décode et met en minuscules avant l'exclusion : /fr/%63ompte, /FR/compte et /Fr/Admin restent exclus", () => {
    expect(pageMesuree("vue_fiche", "/fr/%63ompte/commandes")).toBeNull();
    expect(pageMesuree("vue_fiche", "/FR/compte")).toBeNull();
    expect(pageMesuree("vue_fiche", "/Fr/Admin/produits")).toBeNull();
    expect(pageMesuree("vue_fiche", "/FR/Cosplays/Nezuko")).toBe("/cosplays/nezuko");
  });

  it("parcours d'achat, API et authentification jamais mesurés", () => {
    for (const p of ["/fr/panier", "/en/paiement/retour", "/api/mesure", "/auth/callback"]) expect(pageMesuree("vue_fiche", p)).toBeNull();
  });

  it("refuse %2F, un encodage illisible et tout texte hors des caractères d'adresse du site", () => {
    expect(normaliserChemin("/fr/compte%2Fx")).toBeNull();
    expect(normaliserChemin("/fr/%E0%A4%A")).toBeNull();
    expect(normaliserChemin("/fr/blog/bonjour jean@exemple.test")).toBeNull();
    expect(normaliserChemin("/fr/blog/été")).toBeNull();
    expect(normaliserChemin("/fr/blog/x".padEnd(201, "x"))).toBeNull();
  });
});
});
