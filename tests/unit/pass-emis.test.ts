// Story 7.5 : email « pass_emis ». Gabarit FR/EN (tous les Pass, Code QR joint et affiché, code court en texte, lien vers Mes Pass), rendu relu en base
// (jamais pour une Commande non payée ni sans Pass valide), pièces jointes transmises à Resend. Faux client Supabase et faux Resend nommés TEST.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ commande: null as unknown, pass: [] as unknown[], erreurPass: null as unknown, envoyes: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (args: unknown) => (etat.envoyes.push(args), { data: { id: "TEST_resend" }, error: null }) };
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST@example.invalid" } }, error: null }) } },
    from: (table: string) => {
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        order: () => chaine,
        maybeSingle: async () => ({ data: table === "commande" ? etat.commande : table === "reglage" ? { valeur: "TEST_Boutique" } : null, error: null }),
        then: (ok: (v: unknown) => void) => ok({ data: etat.pass, error: etat.erreurPass }),
      };
      return chaine;
    },
  }),
}));

import { creerDependancesEnvois } from "@/modules/envois/dependances";
import { rendrePassEmis } from "@/modules/envois/modeles/pass-emis";
import type { EnvoiReserve } from "@/modules/envois/types";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const COMPTE = "00000000-0000-4000-8000-0000000000d1";
const COMMANDE = "00000000-0000-4000-8000-0000000000c1";
const JETON_A = "0123456789abcdef0123456789abcdef0123456789abcdef";
const JETON_B = "fedcba9876543210fedcba9876543210fedcba9876543210";

const passEmail = (n: "A" | "B") => ({
  id: `TEST_pass_${n}`,
  typeNom: "TEST_VIP",
  nomTitulaire: `TEST_Nom ${n}`,
  evenement: "TEST_Festival",
  date: "11/03/2027 16:00",
  lieu: "TEST_Salle",
  codeCourt: n === "A" ? "ABCD2345" : "WXYZ6789",
  jeton: n === "A" ? JETON_A : JETON_B,
});
const donnees = { nomSite: "TEST_Boutique", numero: "KS-2027-000001", url: "https://test.example.invalid/fr/compte/pass", pass: [passEmail("A"), passEmail("B")] };

describe("gabarit pass_emis", () => {
  it("français : tous les Pass, chacun avec son nom, son Type, son Événement, sa date, son lieu, son code court et son Code QR", () => {
    const m = rendrePassEmis("fr", donnees);
    expect(m.sujet).toBe("Tes Pass pour TEST_Festival");
    for (const n of ["A", "B"] as const) {
      const p = passEmail(n);
      expect(m.html).toContain(`Pass TEST_VIP de ${p.nomTitulaire}`);
      expect(m.html).toContain(p.codeCourt);
      expect(m.texte).toContain(`Code court : ${p.codeCourt}`);
      expect(m.html).toContain(`alt="Code QR du Pass TEST_VIP de ${p.nomTitulaire}, TEST_Festival"`);
      expect(m.html).toContain(`src="cid:pass-TEST_pass_${n}"`);
    }
    expect(m.html).toContain("Date : 11/03/2027 16:00 (heure de Goma)");
    expect(m.html).toContain("Lieu : TEST_Salle");
    expect(m.html).toContain("https://test.example.invalid/fr/compte/pass");
    expect(m.texte).toContain("https://test.example.invalid/fr/compte/pass");
    expect(m.html).toContain("Voir mes Pass");
  });

  it("joint un Code QR par Pass, en GIF, rattaché à son contentId, et n'écrit jamais le jeton dans le message", () => {
    const m = rendrePassEmis("fr", donnees);
    expect(m.pieces).toHaveLength(2);
    expect(m.pieces?.map((p) => p.contentId)).toEqual(["pass-TEST_pass_A", "pass-TEST_pass_B"]);
    for (const piece of m.pieces ?? []) {
      expect(piece.type).toBe("image/gif");
      expect(piece.contenu.subarray(0, 3).toString("ascii")).toBe("GIF");
    }
    // Les deux images diffèrent : un jeton par Pass.
    expect(m.pieces?.[0].contenu.equals(m.pieces![1].contenu)).toBe(false);
    for (const jeton of [JETON_A, JETON_B]) {
      expect(m.html).not.toContain(jeton);
      expect(m.texte).not.toContain(jeton);
      expect(m.sujet).not.toContain(jeton);
    }
  });

  it("anglais : mêmes éléments dans la langue du client", () => {
    const m = rendrePassEmis("en", donnees);
    expect(m.sujet).toBe("Your Passes for TEST_Festival");
    expect(m.html).toContain("TEST_VIP Pass of TEST_Nom A");
    expect(m.html).toContain('alt="QR code of the TEST_VIP Pass of TEST_Nom A, TEST_Festival"');
    expect(m.html).toContain("Date: 11/03/2027 16:00 (Goma time)");
    expect(m.html).toContain("See my Passes");
  });

  it("n'écrit ni date ni lieu absents, et échappe les noms", () => {
    const m = rendrePassEmis("fr", { ...donnees, pass: [{ ...passEmail("A"), date: null, lieu: null, nomTitulaire: "TEST_<b>Nom</b>" }] });
    expect(m.html).not.toContain("Date :");
    expect(m.html).not.toContain("Lieu :");
    expect(m.html).not.toContain("<b>Nom</b>");
    expect(m.html).toContain("TEST_&lt;b&gt;Nom&lt;/b&gt;");
  });

  it("textes sans emoji ni argot : clés identiques FR et EN", () => {
    expect(Object.keys(fr.Emails.pass_emis).sort()).toEqual(Object.keys(en.Emails.pass_emis).sort());
    const tout = JSON.stringify([fr.Emails.pass_emis, en.Emails.pass_emis]);
    expect(tout).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

const dep = () => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" });
const envoi = (langue: "fr" | "en" = "fr"): EnvoiReserve => ({ id: "TEST_e", modele: "pass_emis", compteId: COMPTE, langue, donnees: { commande_id: COMMANDE }, tentatives: 0 });
const lignePass = (n: "A" | "B", statut = "valide") => ({
  id: `TEST_pass_${n}`,
  nom_titulaire: `TEST_Nom ${n}`,
  statut,
  jeton: n === "A" ? JETON_A : JETON_B,
  code_court: n === "A" ? "ABCD2345" : "WXYZ6789",
  evenement: { titre_fr: "TEST_Festival", titre_en: "TEST_Festival EN", lieu_fr: "TEST_Salle", lieu_en: null, debut_le: "2027-03-11T14:00:00Z" },
  ligne: { pass_nom_fr: "TEST_VIP", pass_nom_en: "TEST_VIP EN" },
});

describe("rendu relu en base", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
    etat.commande = { id: COMMANDE, numero: "KS-2027-000001", compte_id: COMPTE, statut: "payee", total_cents: 3000, forfait_cents: 0, mode_remise: null, numero_suivi: null };
    etat.pass = [lignePass("A"), lignePass("B")];
    etat.erreurPass = null;
    etat.envoyes = [];
  });

  it("rend l'email d'une Commande de Pass payée, avec date à l'heure de Goma et lien vers Mes Pass", async () => {
    const r = await dep().rendre(envoi());
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.destinataire).toBe("TEST@example.invalid");
    expect(r.message.html).toContain("16:00");
    expect(r.message.html).toContain("https://test.example.invalid/fr/compte/pass");
    expect(r.message.pieces).toHaveLength(2);
  });

  it("anglais : titres et noms de Types en anglais quand ils existent, repli sur le français pour le lieu", async () => {
    const r = await dep().rendre(envoi("en"));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.sujet).toBe("Your Passes for TEST_Festival EN");
    expect(r.message.html).toContain("TEST_VIP EN Pass of TEST_Nom A");
    expect(r.message.html).toContain("Place: TEST_Salle");
  });

  it("ignore une Commande qui n'est pas payée", async () => {
    etat.commande = { ...(etat.commande as object), statut: "en_attente" };
    expect(await dep().rendre(envoi())).toEqual({ statut: "ignorer", raison: "commande de Pass non payée" });
  });

  it.each(["annulee", "remboursee", "expiree"])("ignore une Commande de Pass %s : aucun QR ne part", async (statut) => {
    etat.commande = { ...(etat.commande as object), statut };
    expect(await dep().rendre(envoi())).toEqual({ statut: "ignorer", raison: "commande de Pass non payée" });
  });

  it("ignore une Commande dont aucun Pass n'est valide, et n'envoie que les Pass valides", async () => {
    etat.pass = [lignePass("A", "annule"), lignePass("B", "annule")];
    expect(await dep().rendre(envoi())).toEqual({ statut: "ignorer", raison: "aucun Pass valide" });
    etat.pass = [lignePass("A", "annule"), lignePass("B")];
    const r = await dep().rendre(envoi());
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.pieces).toHaveLength(1);
    expect(r.message.html).not.toContain("TEST_Nom A");
  });

  it("ignore l'email d'une Commande d'un autre Compte", async () => {
    etat.commande = { ...(etat.commande as object), compte_id: "00000000-0000-4000-8000-0000000000d2" };
    expect((await dep().rendre(envoi())).statut).toBe("ignorer");
  });

  it("réessaie plus tard quand la lecture des Pass échoue", async () => {
    etat.erreurPass = { message: "base" };
    expect((await dep().rendre(envoi())).statut).toBe("reessayer");
  });

  it("transmet les Codes QR à Resend comme pièces jointes intégrées (contentId)", async () => {
    const r = await dep().rendre(envoi());
    if (r.statut !== "pret") throw new Error("rendu attendu");
    await dep().envoyer({ envoiId: "TEST_e", destinataire: "TEST@example.invalid", message: r.message });
    const envoye = etat.envoyes.at(-1) as { attachments: { filename: string; contentType: string; contentId: string; content: Buffer }[] };
    expect(envoye.attachments).toHaveLength(2);
    expect(envoye.attachments[0]).toMatchObject({ filename: "code-qr-1.gif", contentType: "image/gif", contentId: "pass-TEST_pass_A" });
    expect(Buffer.isBuffer(envoye.attachments[0].content)).toBe(true);
  });

  it("n'ajoute aucune pièce jointe aux autres emails", async () => {
    await dep().envoyer({ envoiId: "TEST_e2", destinataire: "TEST@example.invalid", message: { sujet: "s", html: "<p>h</p>", texte: "t" } });
    expect(etat.envoyes.at(-1)).not.toHaveProperty("attachments");
  });
});
