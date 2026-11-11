// Story 7.3 : « Me prévenir ». Service avec dépendances fausses nommées TEST_ : validation, consentement obligatoire, limites d'essais,
// réponse identique, erreurs de la base, planification et export CSV protégé.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { construireAuteur } from "@/lib/auth/auteur";
import { exporterNumerosWhatsapp, inscrireAlerte, planifierAlertes } from "@/modules/alertes/service";
import { VERSION_CONSENTEMENT_ALERTE } from "@/modules/alertes/types";
import type { DependancesAlertes, DependancesExportAlertes } from "@/modules/alertes/types";

const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const COMPTE = "00000000-0000-4000-8000-0000000000c1";

function faux(s: Partial<DependancesAlertes> = {}): DependancesAlertes {
  return {
    compte: vi.fn(async () => ({ compteId: COMPTE, auteur: construireAuteur(COMPTE) })),
    empreinteClient: vi.fn(async () => "TEST_empreinte_ip"),
    empreinteValeur: vi.fn((v: string) => `TEST_hash_${v.length}`),
    consommerEssai: vi.fn(async () => ({ erreur: null, autorise: true })),
    inscrire: vi.fn(async () => ({ erreur: null })),
    planifier: vi.fn(async () => ({ erreur: null, nombre: 3 })),
    ...s,
  };
}
const entree = (s: Record<string, unknown> = {}) => ({ evenementId: EVENEMENT, langue: "fr", canal: "email", email: "TEST@Example.invalid", consentement: true, ...s });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("inscription « Me prévenir »", () => {
  it("email : adresse normalisée en minuscules, version du texte de consentement, auteur visiteur", async () => {
    const d = faux();
    expect(await inscrireAlerte(d, entree())).toEqual({ ok: true });
    expect(d.inscrire).toHaveBeenCalledWith({
      auteur: { type: "visiteur" },
      evenementId: EVENEMENT,
      canal: "email",
      valeur: "test@example.invalid",
      langue: "fr",
      version: VERSION_CONSENTEMENT_ALERTE.email,
    });
  });

  it("WhatsApp : numéro international sans espaces, version du texte WhatsApp", async () => {
    const d = faux();
    expect(await inscrireAlerte(d, entree({ canal: "whatsapp", whatsapp: "+243 810 000 000" }))).toEqual({ ok: true });
    expect(d.inscrire).toHaveBeenCalledWith(expect.objectContaining({ canal: "whatsapp", valeur: "+243810000000", version: VERSION_CONSENTEMENT_ALERTE.whatsapp }));
    expect(VERSION_CONSENTEMENT_ALERTE.whatsapp).not.toBe(VERSION_CONSENTEMENT_ALERTE.email);
  });

  it("Compte : l'auteur est le Compte vérifié par le serveur, aucune valeur saisie", async () => {
    const d = faux();
    expect(await inscrireAlerte(d, entree({ canal: "compte", email: "ignore@example.invalid" }))).toEqual({ ok: true });
    expect(d.inscrire).toHaveBeenCalledWith(expect.objectContaining({ canal: "compte", valeur: null, auteur: construireAuteur(COMPTE) }));
  });

  it("Compte : visiteur non connecté refusé, base jamais appelée", async () => {
    const d = faux({ compte: vi.fn(async () => null) });
    expect(await inscrireAlerte(d, entree({ canal: "compte" }))).toMatchObject({ ok: false, erreur: "non_connecte" });
    expect(d.inscrire).not.toHaveBeenCalled();
  });

  it("Compte incomplet (âge non déclaré) : message dédié", async () => {
    const d = faux({
      compte: vi.fn(async () => {
        throw new Error("KS_COMPTE_INCOMPLET");
      }),
    });
    expect(await inscrireAlerte(d, entree({ canal: "compte" }))).toMatchObject({ ok: false, erreur: "compte_incomplet" });
  });

  it("la case de consentement est obligatoire : absente, fausse ou texte « true » refusés", async () => {
    for (const consentement of [undefined, false, "true", "on", 1]) {
      const d = faux();
      expect(await inscrireAlerte(d, entree({ consentement }))).toEqual({ ok: false, erreur: "champs", champs: { consentement: "consentement_requis" } });
      expect(d.inscrire).not.toHaveBeenCalled();
    }
  });

  it("champs invalides : erreurs reliées à chaque champ, rien n'est écrit ni compté", async () => {
    const d = faux();
    expect(await inscrireAlerte(d, entree({ email: "pas-un-email" }))).toMatchObject({ erreur: "champs", champs: { email: "email_invalide" } });
    expect(await inscrireAlerte(d, entree({ canal: "whatsapp", whatsapp: "0810000000" }))).toMatchObject({ champs: { whatsapp: "whatsapp_invalide" } });
    expect(await inscrireAlerte(d, entree({ canal: "whatsapp", whatsapp: "+12345" }))).toMatchObject({ champs: { whatsapp: "whatsapp_invalide" } });
    expect(await inscrireAlerte(d, entree({ canal: "sms" }))).toMatchObject({ champs: { canal: "canal_requis" } });
    expect(await inscrireAlerte(d, entree({ canal: "" }))).toMatchObject({ champs: { canal: "canal_requis" } });
    expect(d.consommerEssai).not.toHaveBeenCalled();
    expect(d.inscrire).not.toHaveBeenCalled();
  });

  it("identifiant d'événement ou langue invalides : échec générique, rien d'écrit", async () => {
    const d = faux();
    expect(await inscrireAlerte(d, entree({ evenementId: "pas-un-uuid" }))).toMatchObject({ ok: false, erreur: "generique" });
    expect(await inscrireAlerte(d, entree({ langue: "de" }))).toMatchObject({ ok: false, erreur: "generique" });
    expect(d.inscrire).not.toHaveBeenCalled();
  });

  it("limite d'essais (AD-22) : inscrit d'abord, puis IP ; au-delà, « trop_d_essais » sans écriture", async () => {
    const cles: string[] = [];
    const d = faux({
      consommerEssai: vi.fn(async ({ cle }) => (cles.push(cle), { erreur: null, autorise: !cle.startsWith("alerte:inscrit:") })),
    });
    expect(await inscrireAlerte(d, entree())).toMatchObject({ ok: false, erreur: "trop_d_essais" });
    expect(cles).toHaveLength(1);
    expect(d.inscrire).not.toHaveBeenCalled();
    const d2 = faux({ consommerEssai: vi.fn(async ({ cle }) => ({ erreur: null, autorise: cle.startsWith("alerte:inscrit:") })) });
    expect(await inscrireAlerte(d2, entree())).toMatchObject({ ok: false, erreur: "trop_d_essais" });
    expect(d2.inscrire).not.toHaveBeenCalled();
  });

  it("la clé de limite ne contient jamais l'adresse brute", async () => {
    const d = faux();
    await inscrireAlerte(d, entree());
    for (const [{ cle }] of (d.consommerEssai as ReturnType<typeof vi.fn>).mock.calls) expect(cle).not.toContain("example.invalid");
  });

  it("limite impossible à vérifier : échec générique, jamais une inscription sans limite", async () => {
    const d = faux({ consommerEssai: vi.fn(async () => ({ erreur: "TEST_panne", autorise: false })) });
    expect(await inscrireAlerte(d, entree())).toMatchObject({ ok: false, erreur: "generique" });
    expect(d.inscrire).not.toHaveBeenCalled();
  });

  it("réponse identique que l'inscrit existe déjà ou non", async () => {
    const d = faux();
    const a = await inscrireAlerte(d, entree());
    const b = await inscrireAlerte(d, entree());
    expect(a).toEqual(b);
  });

  it("refus de la base : vente ouverte, événement indisponible, Compte incomplet, adresse refusée", async () => {
    const cas: Array<[string, unknown]> = [
      ["KS_VENTE_OUVERTE", { erreur: "vente_ouverte" }],
      ["KS_ALERTE_INDISPONIBLE", { erreur: "indisponible" }],
      ["KS_COMPTE_INCOMPLET", { erreur: "compte_incomplet" }],
      ["KS_EMAIL_INVALIDE", { erreur: "champs", champs: { email: "email_invalide" } }],
      ["23505", { erreur: "generique" }],
    ];
    for (const [code, attendu] of cas) {
      const d = faux({ inscrire: vi.fn(async () => ({ erreur: code })) });
      expect(await inscrireAlerte(d, entree())).toMatchObject({ ok: false, ...(attendu as object) });
    }
  });

  it("jamais de succès si la base échoue ou lève une exception, et aucune valeur saisie dans les journaux", async () => {
    const d = faux({
      inscrire: vi.fn(async () => {
        throw new Error("TEST_detail test@example.invalid");
      }),
    });
    expect(await inscrireAlerte(d, entree())).toMatchObject({ ok: false, erreur: "generique" });
    const journal = JSON.stringify((console.error as ReturnType<typeof vi.fn>).mock.calls);
    expect(journal).not.toContain("example.invalid");
  });
});

describe("planification des alertes (tâche planifiée)", () => {
  it("renvoie le nombre d'emails posés par la base", async () => {
    expect(await planifierAlertes(faux())).toEqual({ ok: true, nombre: 3 });
  });
  it("erreur ou exception de la base : échec, jamais un faux succès", async () => {
    expect(await planifierAlertes(faux({ planifier: vi.fn(async () => ({ erreur: "TEST", nombre: 0 })) }))).toEqual({ ok: false });
    expect(
      await planifierAlertes(
        faux({
          planifier: vi.fn(async () => {
            throw new Error("TEST");
          }),
        }),
      ),
    ).toEqual({ ok: false });
  });
});

describe("export CSV des numéros WhatsApp", () => {
  const auteur = { type: "compte" as const, id: COMPTE, role: "admin" as const };
  const fauxExport = (s: Partial<DependancesExportAlertes> = {}): DependancesExportAlertes => ({
    exigerDroit: vi.fn(async () => ({ auteur })),
    exporterNumeros: vi.fn(async () => ({ erreur: null, numeros: ["+243810000000", "+33612345678"] })),
    ...s,
  });

  it("exige le droit evenements.gerer puis renvoie un CSV d'une colonne", async () => {
    const d = fauxExport();
    const r = await exporterNumerosWhatsapp(d, EVENEMENT);
    expect(d.exigerDroit).toHaveBeenCalledWith("evenements.gerer");
    expect(d.exporterNumeros).toHaveBeenCalledWith({ auteur, evenementId: EVENEMENT });
    expect(r).toEqual({ ok: true, nombre: 2, csv: "numero_whatsapp\r\n+243810000000\r\n+33612345678\r\n" });
  });

  it("sans droit ou non connecté : refusé avant toute lecture des numéros", async () => {
    for (const [code, attendu] of [["KS_DROIT_REFUSE", "non_autorise"], ["KS_NON_CONNECTE", "non_connecte"]] as const) {
      const d = fauxExport({
        exigerDroit: vi.fn(async () => {
          throw new Error(code);
        }),
      });
      expect(await exporterNumerosWhatsapp(d, EVENEMENT)).toEqual({ ok: false, erreur: attendu });
      expect(d.exporterNumeros).not.toHaveBeenCalled();
    }
  });

  it("le refus de la base (droit revérifié) et l'événement inconnu sont rendus tels quels", async () => {
    expect(await exporterNumerosWhatsapp(fauxExport({ exporterNumeros: vi.fn(async () => ({ erreur: "KS_DROIT_REFUSE", numeros: [] })) }), EVENEMENT)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await exporterNumerosWhatsapp(fauxExport({ exporterNumeros: vi.fn(async () => ({ erreur: "KS_EVENEMENT_INTROUVABLE", numeros: [] })) }), EVENEMENT)).toEqual({ ok: false, erreur: "introuvable" });
  });

  it("identifiant mal formé : refusé sans appel", async () => {
    const d = fauxExport();
    expect(await exporterNumerosWhatsapp(d, "../../etc")).toEqual({ ok: false, erreur: "evenement_invalide" });
    expect(d.exigerDroit).not.toHaveBeenCalled();
  });

  it("une valeur qui ne ressemble pas à un numéro (formule, virgule) n'entre jamais dans le fichier", async () => {
    const d = fauxExport({ exporterNumeros: vi.fn(async () => ({ erreur: null, numeros: ["=CMD()", "+243810000000", "a,b"] })) });
    const r = await exporterNumerosWhatsapp(d, EVENEMENT);
    expect(r).toMatchObject({ ok: true, nombre: 1 });
    expect(r.ok && r.csv).toBe("numero_whatsapp\r\n+243810000000\r\n");
  });
});
