// Story 7.10 : Galerie d'événement. Service d'enregistrement du lien (droit, format, erreurs de la base), route planifiée /api/cron/galerie-evenement
// (CRON_SECRET), gabarit et rendu de l'email « galerie_evenement » relu en base. Faux accès nommés TEST ; aucun vrai email.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  rpc: vi.fn(),
  donneesEnvoi: null as unknown,
  erreurEnvoi: null as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: "TEST_resend" }, error: null }) };
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async (nom: string, args: unknown) => (nom === "galerie_evenement_pour_envoi" ? { data: etat.donneesEnvoi, error: etat.erreurEnvoi } : etat.rpc(nom, args)),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST@example.invalid" } }, error: null }) } },
    from: () => {
      const chaine = { select: () => chaine, eq: () => chaine, maybeSingle: async () => ({ data: { valeur: "TEST_Boutique" }, error: null }) };
      return chaine;
    },
  }),
}));

import { POST } from "@/app/api/cron/galerie-evenement/route";
import { enregistrerGalerieEvenement } from "@/modules/evenements/galerie";
import { creerDependancesEnvois } from "@/modules/envois/dependances";
import { rendreGalerieEvenement } from "@/modules/envois/modeles/galerie-evenement";
import type { EnvoiReserve } from "@/modules/envois/types";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const EVENEMENT = "00000000-0000-4000-8000-0000000000a1";
const COMPTE = "00000000-0000-4000-8000-0000000000d1";
const AUTEUR = { type: "compte", id: COMPTE, role: "admin" } as const;
const LIEN = "https://drive.google.com/drive/folders/TEST_abc";

describe("enregistrerGalerieEvenement", () => {
  const deps = (erreur: string | null = null, droit = true) => ({
    exigerDroit: vi.fn(async () => {
      if (!droit) throw new Error("TEST_refus");
      return { auteur: AUTEUR };
    }),
    enregistrer: vi.fn(async () => ({ erreur })),
    invalider: vi.fn(async () => {}),
  });
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("enregistre le lien (sans espaces), exige le droit « evenements.gerer » et vide le cache", async () => {
    const d = deps();
    expect(await enregistrerGalerieEvenement(d, { evenementId: EVENEMENT, lien: `  ${LIEN}  ` })).toEqual({ ok: true, lien: LIEN });
    expect(d.exigerDroit).toHaveBeenCalledWith("evenements.gerer");
    expect(d.enregistrer).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: EVENEMENT, lien: LIEN });
    expect(d.invalider).toHaveBeenCalled();
  });
  it("un texte vide efface le lien", async () => {
    const d = deps();
    expect(await enregistrerGalerieEvenement(d, { evenementId: EVENEMENT, lien: "  " })).toEqual({ ok: true, lien: null });
    expect(d.enregistrer).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: EVENEMENT, lien: "" });
  });
  it.each([
    "http://drive.google.com/x",
    "https://evil.example.invalid/drive.google.com/x",
    "https://drive.google.com.evil.example.invalid/x",
    "https://drive.google.com/un espace",
    "javascript:alert(1)",
    `https://drive.google.com/${"a".repeat(600)}`,
  ])("lien refusé avant la base : %s", async (lien) => {
    const d = deps();
    expect(await enregistrerGalerieEvenement(d, { evenementId: EVENEMENT, lien })).toEqual({ ok: false, erreur: "lien_invalide" });
    expect(d.enregistrer).not.toHaveBeenCalled();
  });
  it("accepte les trois hôtes de Google", async () => {
    for (const lien of ["https://drive.google.com/a", "https://photos.google.com/share/a", "https://photos.app.goo.gl/a"]) {
      expect((await enregistrerGalerieEvenement(deps(), { evenementId: EVENEMENT, lien })).ok).toBe(true);
    }
  });
  it("identifiant mal formé ou lien non textuel : entrée invalide, sans droit demandé", async () => {
    const d = deps();
    expect(await enregistrerGalerieEvenement(d, { evenementId: "x", lien: LIEN })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await enregistrerGalerieEvenement(d, { evenementId: EVENEMENT, lien: 12 })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(d.exigerDroit).not.toHaveBeenCalled();
  });
  it("sans droit : refusé, rien n'est écrit", async () => {
    const d = deps(null, false);
    expect(await enregistrerGalerieEvenement(d, { evenementId: EVENEMENT, lien: LIEN })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.enregistrer).not.toHaveBeenCalled();
  });
  it.each([
    ["KS_LIEN_INVALIDE", "lien_invalide"],
    ["KS_EVENEMENT_INTROUVABLE", "evenement_introuvable"],
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["autre chose", "generique"],
  ])("erreur de la base %s : %s, jamais un succès ni le lien dans le journal", async (code, attendu) => {
    const d = deps(code);
    expect(await enregistrerGalerieEvenement(d, { evenementId: EVENEMENT, lien: LIEN })).toEqual({ ok: false, erreur: attendu });
    expect(d.invalider).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("drive.google.com");
  });
});

describe("POST /api/cron/galerie-evenement", () => {
  const requete = (autorisation?: string) => new Request("http://localhost/api/cron/galerie-evenement", { method: "POST", headers: autorisation ? { authorization: autorisation } : {} });
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "TEST_secret");
    etat.rpc.mockReset().mockResolvedValue({ data: 3, error: null });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuse sans secret et avec un mauvais secret, sans rien planifier", async () => {
    expect((await POST(requete())).status).toBe(401);
    expect((await POST(requete("Bearer TEST_autre"))).status).toBe(401);
    expect(etat.rpc).not.toHaveBeenCalled();
  });
  it("avec le bon secret : planifie et rend le nombre", async () => {
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, planifies: 3 });
    expect(etat.rpc).toHaveBeenCalledWith("planifier_galeries_evenements", undefined);
  });
  it("échec de la base : 500, jamais un faux succès", async () => {
    etat.rpc.mockResolvedValue({ data: null, error: { message: "TEST_panne" } });
    expect((await POST(requete("Bearer TEST_secret"))).status).toBe(500);
  });
});

describe("gabarit galerie_evenement", () => {
  it("français : lien de la Galerie en bouton, rappel du retrait par le contact", () => {
    const m = rendreGalerieEvenement("fr", { nomSite: "TEST_Boutique", evenement: "TEST_<b>Fête</b>", lienGalerie: LIEN });
    expect(m.sujet).toBe("Les photos de TEST_<b>Fête</b> sont en ligne");
    expect(m.html).toContain(`href="${LIEN}"`);
    expect(m.html).toContain("TEST_&lt;b&gt;Fête&lt;/b&gt;");
    expect(m.html).toContain("page Contact");
    expect(m.texte).toContain(LIEN);
  });
  it("anglais", () => {
    const m = rendreGalerieEvenement("en", { nomSite: "TEST_Boutique", evenement: "TEST_Party", lienGalerie: LIEN });
    expect(m.sujet).toBe("The photos of TEST_Party are online");
    expect(m.texte).toContain("Contact page");
  });
  it("clés identiques FR et EN, sans emoji", () => {
    expect(Object.keys(fr.Emails.galerie_evenement).sort()).toEqual(Object.keys(en.Emails.galerie_evenement).sort());
    expect(JSON.stringify([fr.Emails.galerie_evenement, en.Emails.galerie_evenement, fr.Festival.galerie, en.Festival.galerie])).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("rendu relu en base", () => {
  const dep = () => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" });
  const envoi = (donnees: Record<string, string> = { evenement_id: EVENEMENT }): EnvoiReserve => ({ id: "TEST_e", modele: "galerie_evenement", compteId: COMPTE, langue: "fr", donnees, tentatives: 0 });
  const complet = { titre_fr: "TEST_Fête", titre_en: "TEST_Party", galerie_url: LIEN, publie: true, termine: true, acheteur: true };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
    etat.donneesEnvoi = complet;
    etat.erreurEnvoi = null;
  });

  it("prêt quand l'Événement est publié, terminé, le lien saisi et le Compte acheteur", async () => {
    const r = await dep().rendre(envoi());
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.sujet).toBe("Les photos de TEST_Fête sont en ligne");
    expect(r.message.html).toContain(LIEN);
  });
  it.each([
    [{ ...complet, termine: false }, "Événement non publié ou pas terminé"],
    [{ ...complet, publie: false }, "Événement non publié ou pas terminé"],
    [{ ...complet, acheteur: false }, "aucun Pass valide pour ce Compte"],
    [{ ...complet, galerie_url: null }, "lien de la Galerie absent ou invalide"],
    [{ ...complet, galerie_url: "https://exemple.invalid/photos" }, "lien de la Galerie absent ou invalide"],
    [{ ...complet, galerie_url: "http://drive.google.com/x" }, "lien de la Galerie absent ou invalide"],
    [null, "Événement introuvable"],
  ])("ignoré : %#", async (donnees, raison) => {
    etat.donneesEnvoi = donnees;
    expect(await dep().rendre(envoi())).toEqual({ statut: "ignorer", raison });
  });
  it("sans identifiant d'Événement : ignoré ; lecture en échec : à réessayer", async () => {
    expect(await dep().rendre(envoi({}))).toEqual({ statut: "ignorer", raison: "Événement non indiqué" });
    etat.erreurEnvoi = { message: "TEST_panne" };
    expect((await dep().rendre(envoi())).statut).toBe("reessayer");
  });
});
