import { describe, expect, it, vi } from "vitest";
import { enregistrerEvenement, LIMITE_IP_PAR_HEURE, LIMITE_SESSION_PAR_HEURE } from "@/modules/mesure/service";
import type { DependancesMesure, EntreeMesure } from "@/modules/mesure/types";

// Story 9.7 : service d'écriture. Le chemin vient du Referer ; sans Referer vérifiable, rien n'est écrit.

const SESSION = "00000000-0000-4000-8000-000000000001";

function dependances(remplacements: Partial<DependancesMesure> = {}) {
  const ecrits: EntreeMesure[] = [];
  const essais: string[] = [];
  const base: DependancesMesure = {
    referer: async () => "https://boutique.test/fr/cosplays/nezuko",
    hote: async () => "boutique.test",
    empreinteClient: async () => "TEST_empreinte",
    consommerEssai: async ({ cle }) => {
      essais.push(cle);
      return true;
    },
    enregistrer: async (entree) => {
      ecrits.push(entree);
      return { erreur: null };
    },
    ...remplacements,
  };
  return { deps: base, ecrits, essais };
}

const corps = (remplacements: Record<string, unknown> = {}) => ({
  action: "vue_fiche",
  langue: "fr",
  appareil: "ordinateur",
  session: SESSION,
  origine: null,
  provenance: null,
  ...remplacements,
});

describe("enregistrerEvenement", () => {
  it("écrit un événement valide, avec le chemin tiré du Referer et aucune donnée de plus", async () => {
    const { deps, ecrits } = dependances();
    expect(await enregistrerEvenement(deps, corps())).toBe("ok");
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]).toEqual({
      action: "vue_fiche",
      page: "/cosplays/nezuko",
      origine: null,
      referent: null,
      langue: "fr",
      appareil: "ordinateur",
      session: SESSION,
      dureeMs: null,
    });
    expect(Object.keys(ecrits[0]).sort()).toEqual(["action", "appareil", "dureeMs", "langue", "origine", "page", "referent", "session"]);
  });

  it("refuse un champ inconnu, un action inconnue, une session non uuid et une durée mal placée", async () => {
    const { deps, ecrits } = dependances();
    expect(await enregistrerEvenement(deps, corps({ page: "/cosplays/nezuko" }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ email: "a@b.test" }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ action: "achat" }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ session: "pas-un-uuid" }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ duree: 1200 }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ action: "chargement_heros", duree: 70000 }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ origine: "Promo 2026" }))).toBe("invalide");
    expect(await enregistrerEvenement(deps, corps({ provenance: "https://tiktok.com" }))).toBe("invalide");
    expect(ecrits).toHaveLength(0);
  });

  it("n'écrit rien sans Referer vérifiable", async () => {
    for (const remplacements of [
      { referer: async () => null },
      { hote: async () => null },
      { referer: async () => "https://exemple.test/fr/cosplays" },
      { referer: async () => "pas une adresse" },
    ]) {
      const { deps, ecrits, essais } = dependances(remplacements);
      expect(await enregistrerEvenement(deps, corps())).toBe("sans_referer");
      expect(ecrits).toHaveLength(0);
      expect(essais).toHaveLength(0);
    }
  });

  it("refuse les pages exclues, même quand le client prétend le contraire", async () => {
    for (const page of ["/fr/admin", "/fr/admin/commandes", "/fr/connexion", "/fr/commande/KS-2026-000001", "/en/checkout", "/fr/desinscription"]) {
      const { deps, ecrits, essais } = dependances({ referer: async () => `https://boutique.test${page}` });
      expect(await enregistrerEvenement(deps, corps())).toBe("refuse");
      expect(ecrits).toHaveLength(0);
      expect(essais).toHaveLength(0);
    }
  });

  it("force « /compte » pour les actions de l'espace privé et refuse les autres actions depuis /compte", async () => {
    const { deps, ecrits } = dependances({ referer: async () => "https://boutique.test/fr/compte/photos" });
    expect(await enregistrerEvenement(deps, corps({ action: "photo_envoyee" }))).toBe("ok");
    expect(ecrits[0].page).toBe("/compte");
    expect(await enregistrerEvenement(deps, corps({ action: "vue_fiche" }))).toBe("refuse");
    expect(ecrits).toHaveLength(1);

    const publicPage = dependances({ referer: async () => "https://boutique.test/fr/kits/onigiri" });
    expect(await enregistrerEvenement(publicPage.deps, corps({ action: "photo_envoyee" }))).toBe("refuse");
    expect(publicPage.ecrits).toHaveLength(0);
  });

  it("transmet l'origine, le référent et la durée du héros", async () => {
    const { deps, ecrits } = dependances({ referer: async () => "https://boutique.test/fr" });
    expect(await enregistrerEvenement(deps, corps({ action: "chargement_heros", duree: 1200, origine: "whatsapp", provenance: "tiktok.com" }))).toBe("ok");
    expect(ecrits[0]).toMatchObject({ page: "/", dureeMs: 1200, origine: "whatsapp", referent: "tiktok.com" });
  });

  it("limite par session puis par empreinte d'IP, et n'écrit rien quand la limite est atteinte", async () => {
    const appelsSession: string[] = [];
    const refusSession = dependances({
      consommerEssai: async ({ cle }) => {
        appelsSession.push(cle);
        return false;
      },
    });
    expect(await enregistrerEvenement(refusSession.deps, corps())).toBe("refuse");
    expect(appelsSession).toEqual([`mesure:session:${SESSION}`]);
    expect(refusSession.ecrits).toHaveLength(0);

    const appels: string[] = [];
    const refusIp = dependances({
      consommerEssai: async ({ cle, maximum }) => {
        appels.push(`${cle}:${maximum}`);
        return !cle.startsWith("mesure:ip:");
      },
    });
    expect(await enregistrerEvenement(refusIp.deps, corps())).toBe("refuse");
    expect(appels).toEqual([`mesure:session:${SESSION}:${LIMITE_SESSION_PAR_HEURE}`, `mesure:ip:TEST_empreinte:${LIMITE_IP_PAR_HEURE}`]);
    expect(refusIp.ecrits).toHaveLength(0);
  });

  it("se passe de la limite d'IP quand aucune empreinte n'est disponible", async () => {
    const { deps, ecrits, essais } = dependances({ empreinteClient: async () => null });
    expect(await enregistrerEvenement(deps, corps())).toBe("ok");
    expect(essais).toEqual([`mesure:session:${SESSION}`]);
    expect(ecrits).toHaveLength(1);
  });

  it("rend « erreur » sans lever quand l'écriture ou la limitation échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ecriture = dependances({ enregistrer: async () => ({ erreur: "KS_MESURE_INVALIDE" }) });
    expect(await enregistrerEvenement(ecriture.deps, corps())).toBe("erreur");
    const panne = dependances({
      consommerEssai: async () => {
        throw new Error("base indisponible");
      },
    });
    expect(await enregistrerEvenement(panne.deps, corps())).toBe("erreur");
  });
});
