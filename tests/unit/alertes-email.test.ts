// Story 7.3 : gabarit de l'email alerte_evenement (FR/EN), rendu réel par le worker (creerDependancesEnvois().rendre) avec un faux client,
// lien de désinscription signé pour l'inscrit par email, et désinscription par ce lien.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  alerte: null as unknown,
  evenement: null as unknown,
  reglage: { valeur: "TEST_Boutique" } as unknown,
  erreurRpc: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async () => (etat.erreurRpc ? { data: null, error: { message: "TEST" } } : { data: etat.alerte, error: null }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST-compte@example.invalid" } }, error: null }) } },
    from: (table: string) => {
      const chaine = { select: () => chaine, eq: () => chaine, maybeSingle: async () => ({ data: table === "reglage" ? etat.reglage : etat.evenement, error: null }) };
      return chaine;
    },
  }),
}));

import { rendreAlerteEvenement } from "@/modules/envois/modeles/alerte-evenement";
import { creerDependancesEnvois } from "@/modules/envois/dependances";
import type { EnvoiReserve } from "@/modules/envois/types";
import { signerDesinscriptionAlerte, verifierDesinscription, verifierDesinscriptionAlerte, signerDesinscription } from "@/modules/preferences/lien-desinscription";
import { desinscrireParLien } from "@/modules/preferences/service";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const ALERTE = "00000000-0000-4000-8000-0000000000a1";
const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const COMPTE = "00000000-0000-4000-8000-0000000000c1";
const commun = { nomSite: "TEST_Boutique", evenement: "TEST_Festival", url: "https://test.example.invalid/fr/festival/test", lienDesinscription: "https://test.example.invalid/fr/desinscription?a=TEST&s=TEST" };

describe("gabarit alerte_evenement", () => {
  it("français : objet, texte, lien en texte, désinscription en dernier, sans emoji", () => {
    const m = rendreAlerteEvenement("fr", commun);
    expect(m.sujet).toBe("La vente des Pass est ouverte : TEST_Festival");
    expect(m.texte).toContain("La vente des Pass pour TEST_Festival vient d'ouvrir sur TEST_Boutique.");
    expect(m.texte).toContain(commun.url);
    expect(m.texte.trim().endsWith(commun.lienDesinscription)).toBe(true);
    expect(m.html).toContain(`href="${commun.lienDesinscription.replace(/&/g, "&amp;")}"`);
    expect(/\p{Extended_Pictographic}/u.test(m.texte + m.html)).toBe(false);
  });

  it("anglais, et le titre de l'événement est échappé dans le HTML", () => {
    const m = rendreAlerteEvenement("en", { ...commun, evenement: "<b>TEST</b>" });
    expect(m.sujet).toBe("Passes are on sale: <b>TEST</b>");
    expect(m.html).not.toContain("<b>TEST</b>");
    expect(m.texte).toContain(en.Emails.commercial.desinscriptionLien);
  });

  it("textes FR et EN en parité", () => {
    expect(Object.keys(en.Emails.alerte_evenement).sort()).toEqual(Object.keys(fr.Emails.alerte_evenement).sort());
    expect(Object.keys(en.Festival.prevenir).sort()).toEqual(Object.keys(fr.Festival.prevenir).sort());
    expect(Object.keys(en.Admin.evenements.alertes).sort()).toEqual(Object.keys(fr.Admin.evenements.alertes).sort());
  });

  it("textes fournis par Jonathan, mot pour mot", () => {
    expect(fr.Festival.prevenir.bouton).toBe("Me prévenir");
    expect(en.Festival.prevenir.bouton).toBe("Notify me");
    expect(fr.Festival.prevenir.consentement.email).toBe("Je veux recevoir un email quand la vente des Pass de cet événement ouvre. Je peux me désinscrire à tout moment.");
    expect(en.Festival.prevenir.consentement.email).toBe("Email me when passes for this event go on sale. I can unsubscribe at any time.");
    expect(fr.Festival.prevenir.succes).toBe("C'est noté : tu seras prévenu à l'ouverture de la vente.");
    expect(en.Festival.prevenir.succes).toBe("Got it: we'll let you know when sales open.");
  });
});

describe("rendu réel par le worker", () => {
  const envoi = (s: Partial<EnvoiReserve> = {}): EnvoiReserve => ({
    id: "TEST_e",
    modele: "alerte_evenement",
    compteId: null,
    langue: "fr",
    donnees: { alerte_id: ALERTE, evenement_id: EVENEMENT },
    tentatives: 0,
    ...s,
  });
  const rendre = (e: EnvoiReserve) => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" }).rendre(e);
  const futur = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
    process.env.DESINSCRIPTION_SECRET = "TEST_secret_de_desinscription_assez_long_0123456789";
    etat.erreurRpc = false;
    etat.reglage = { valeur: "TEST_Boutique" };
    etat.alerte = { canal: "email", email: "test-inscrit@example.invalid", compte_id: null, evenement_id: EVENEMENT, desinscrit: false };
    etat.evenement = { slug: "test-festival", titre_fr: "TEST_Festival", titre_en: "TEST_Festival EN", publie_le: futur(-48), vente_ouvre_le: futur(-1), vente_ferme_le: null, debut_le: futur(240) };
  });

  it("inscrit par email sans Compte : destinataire = son adresse, lien de l'événement, désinscription signée (a, s) et RFC 8058", async () => {
    const r = await rendre(envoi());
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.destinataire).toBe("test-inscrit@example.invalid");
    expect(r.message.texte).toContain("https://test.example.invalid/fr/festival/test-festival");
    expect(r.message.texte).toMatch(/https:\/\/test\.example\.invalid\/fr\/desinscription\?a=[0-9a-f-]{36}&s=[A-Za-z0-9_-]+/);
    expect(r.message.entetes?.["List-Unsubscribe"]).toMatch(/^<https:\/\/test\.example\.invalid\/api\/desinscription\?a=[0-9a-f-]{36}&s=[A-Za-z0-9_-]+>$/);
    expect(r.message.entetes?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("anglais : titre anglais de l'événement et adresse /en", async () => {
    const r = await rendre(envoi({ langue: "en" }));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.sujet).toBe("Passes are on sale: TEST_Festival EN");
    expect(r.message.texte).toContain("https://test.example.invalid/en/festival/test-festival");
  });

  it("inscrit par Compte : adresse du Compte, désinscription par le lien du Compte (c, s)", async () => {
    etat.alerte = { canal: "compte", email: null, compte_id: COMPTE, evenement_id: EVENEMENT, desinscrit: false };
    const r = await rendre(envoi({ compteId: COMPTE }));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.destinataire).toBe("TEST-compte@example.invalid");
    expect(r.message.texte).toContain("/fr/desinscription?c=");
  });

  it("jamais envoyé : désinscrit, WhatsApp, autre événement, inscription inconnue, Compte qui ne correspond pas", async () => {
    etat.alerte = { canal: "email", email: "x@example.invalid", compte_id: null, evenement_id: EVENEMENT, desinscrit: true };
    expect(await rendre(envoi())).toMatchObject({ statut: "ignorer" });
    etat.alerte = { canal: "whatsapp", email: null, compte_id: null, evenement_id: EVENEMENT, desinscrit: false };
    expect(await rendre(envoi())).toMatchObject({ statut: "ignorer" });
    etat.alerte = { canal: "email", email: "x@example.invalid", compte_id: null, evenement_id: "00000000-0000-4000-8000-0000000000ff", desinscrit: false };
    expect(await rendre(envoi())).toMatchObject({ statut: "ignorer" });
    etat.alerte = null;
    expect(await rendre(envoi())).toMatchObject({ statut: "ignorer" });
    etat.alerte = { canal: "compte", email: null, compte_id: "00000000-0000-4000-8000-0000000000ff", evenement_id: EVENEMENT, desinscrit: false };
    expect(await rendre(envoi({ compteId: COMPTE }))).toMatchObject({ statut: "ignorer" });
  });

  it("jamais annoncé si la vente n'est pas ouverte, est fermée, ou si l'événement est dépublié ou commencé", async () => {
    const base = { slug: "test-festival", titre_fr: "TEST", titre_en: null, publie_le: futur(-48), vente_ouvre_le: futur(-1), vente_ferme_le: null, debut_le: futur(240) };
    for (const s of [{ vente_ouvre_le: futur(2) }, { vente_ferme_le: futur(-0.5) }, { publie_le: null }, { debut_le: futur(-1) }]) {
      etat.evenement = { ...base, ...s };
      expect(await rendre(envoi())).toMatchObject({ statut: "ignorer" });
    }
    etat.evenement = null;
    expect(await rendre(envoi())).toMatchObject({ statut: "ignorer" });
  });

  it("vente ouverte à la publication (sans date d'ouverture) : annoncée", async () => {
    etat.evenement = { slug: "test-festival", titre_fr: "TEST", titre_en: null, publie_le: futur(-1), vente_ouvre_le: null, vente_ferme_le: null, debut_le: futur(240) };
    expect((await rendre(envoi())).statut).toBe("pret");
  });

  it("lecture impossible ou nom du site absent : nouvel essai, jamais d'invention", async () => {
    etat.erreurRpc = true;
    expect(await rendre(envoi())).toMatchObject({ statut: "reessayer" });
    etat.erreurRpc = false;
    etat.reglage = null;
    expect(await rendre(envoi())).toMatchObject({ statut: "reessayer" });
  });

  it("un autre modèle sans Compte n'est jamais rendu", async () => {
    expect(await rendre(envoi({ modele: "commande_payee" }))).toMatchObject({ statut: "ignorer", raison: "envoi sans Compte" });
  });
});

describe("désinscription par le lien d'un inscrit par email", () => {
  const SECRET = { DESINSCRIPTION_SECRET: "TEST_secret_de_desinscription_assez_long_0123456789" };
  beforeEach(() => {
    process.env.DESINSCRIPTION_SECRET = SECRET.DESINSCRIPTION_SECRET;
  });
  const deps = () => ({ desinscrire: vi.fn(async () => ({ fait: true })), desinscrireAlerte: vi.fn(async () => ({ fait: true })) });

  it("les signatures d'un Compte et d'une inscription ne valent jamais l'une pour l'autre", () => {
    const sa = signerDesinscriptionAlerte(ALERTE, SECRET);
    expect(verifierDesinscriptionAlerte(ALERTE, sa, SECRET)).toBe(true);
    expect(verifierDesinscription(ALERTE, sa, SECRET)).toBe(false);
    expect(verifierDesinscriptionAlerte(ALERTE, signerDesinscription(ALERTE, SECRET), SECRET)).toBe(false);
  });

  it("lien valide (a, s) : désinscrit l'inscription, jamais un Compte", async () => {
    const d = deps();
    expect(await desinscrireParLien(d, { a: ALERTE, s: signerDesinscriptionAlerte(ALERTE) })).toBe("desinscrit");
    expect(d.desinscrireAlerte).toHaveBeenCalledWith(ALERTE);
    expect(d.desinscrire).not.toHaveBeenCalled();
  });

  it("signature altérée ou d'un autre contexte : lien invalide, la base n'est jamais appelée", async () => {
    const d = deps();
    expect(await desinscrireParLien(d, { a: ALERTE, s: "TEST_faux" })).toBe("lien_invalide");
    expect(await desinscrireParLien(d, { a: ALERTE, s: signerDesinscription(ALERTE) })).toBe("lien_invalide");
    expect(d.desinscrireAlerte).not.toHaveBeenCalled();
  });

  it("inscription inconnue : lien invalide ; panne de la base : erreur, jamais un faux succès", async () => {
    const s = signerDesinscriptionAlerte(ALERTE);
    expect(await desinscrireParLien({ ...deps(), desinscrireAlerte: vi.fn(async () => ({ fait: false })) }, { a: ALERTE, s })).toBe("lien_invalide");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await desinscrireParLien({ ...deps(), desinscrireAlerte: vi.fn(async () => ({ erreur: "TEST" })) }, { a: ALERTE, s })).toBe("erreur");
  });
});
