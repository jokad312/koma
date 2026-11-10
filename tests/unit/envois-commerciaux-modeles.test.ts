// Story 9.6 : gabarits des emails ciblés : textes validés par Jonathan, lien de désinscription dans chaque email, deux langues.
import { describe, expect, it } from "vitest";
import { rendreNouveauProduit, rendrePanierAbandonne, rendreRappelKit } from "@/modules/envois/modeles/commerciaux";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

const commun = { nomSite: "TEST_Boutique", url: "https://test.example.invalid/fr/panier", lienDesinscription: "https://test.example.invalid/fr/desinscription?c=TEST&s=TEST" };

describe("emails ciblés", () => {
  it("panier oublié : objet et texte validés, lien vers le panier, désinscription en pied", () => {
    const m = rendrePanierAbandonne("fr", commun);
    expect(m.sujet).toBe("Ton panier t'attend");
    expect(m.texte).toContain("Tu as laissé des articles dans ton panier sur TEST_Boutique. Ils t'y attendent : les prix et la disponibilité sont vérifiés au moment de commander.");
    expect(m.texte).toContain(commun.url);
    expect(m.texte.trim().endsWith(commun.lienDesinscription)).toBe(true);
    expect(m.html).toContain(`href="${commun.lienDesinscription.replace(/&/g, "&amp;")}"`);
  });

  it("rappel de Kit : « Commence le chapitre 1 » ou « Reprends au chapitre n »", () => {
    expect(rendreRappelKit("fr", { ...commun, kit: "TEST_Kit", chapitre: null }).texte).toContain("Commence le chapitre 1 de TEST_Kit.");
    const m = rendreRappelKit("fr", { ...commun, kit: "TEST_Kit", chapitre: 3 });
    expect(m.sujet).toBe("Ton kit TEST_Kit t'attend");
    expect(m.texte).toContain("Reprends au chapitre 3 de TEST_Kit.");
  });

  it("nouveau produit : objet « Nouveau dans {univers} : {produit} », en anglais aussi, avec désinscription", () => {
    const m = rendreNouveauProduit("fr", { ...commun, produit: "TEST_Cosplay", univers: "TEST_Univers" });
    expect(m.sujet).toBe("Nouveau dans TEST_Univers : TEST_Cosplay");
    expect(m.texte).toContain("TEST_Cosplay vient d'arriver dans l'univers TEST_Univers.");
    const e = rendreNouveauProduit("en", { ...commun, produit: "TEST_Cosplay", univers: "TEST_Universe" });
    expect(e.sujet).toBe("New in TEST_Universe: TEST_Cosplay");
    expect(e.texte).toContain(en.Emails.commercial.desinscriptionLien);
  });

  it("le titre d'un produit venu de la base est échappé dans le HTML", () => {
    const m = rendreNouveauProduit("fr", { ...commun, produit: "<b>TEST</b>", univers: "TEST_Univers" });
    expect(m.html).not.toContain("<b>TEST</b>");
  });

  it("textes FR et EN en parité", () => {
    for (const cle of ["commercial", "panier_abandonne", "rappel_kit", "nouveau_produit"] as const) {
      expect(Object.keys(en.Emails[cle]).sort()).toEqual(Object.keys(fr.Emails[cle]).sort());
    }
  });
});
