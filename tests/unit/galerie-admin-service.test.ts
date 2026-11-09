// Story 8.2 : validation (métadonnées retirées avant publication), refus, retrait, dépôt WhatsApp.
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/droits", () => ({ DroitRefuseError: class DroitRefuseError extends Error {} }));

import { DroitRefuseError } from "@/lib/auth/droits";
import { demanderEnvoiDepot, deposerPhotoWhatsapp, lirePhotosAdmin, refuserPhoto, retirerPhotoAdmin, validerPhoto } from "@/modules/communaute/admin-service";
import { CHEMIN_ENVOI_ADMIN, type DependancesGalerie } from "@/modules/communaute/admin-types";

const ID = "00000000-0000-4000-8000-0000000000aa";
const AUTEUR = { type: "compte" as const, id: "00000000-0000-4000-8000-0000000000a3", role: "admin" as const };
let JPEG_GPS: Uint8Array;

beforeAll(async () => {
  // Photo avec une position GPS : la copie publique ne doit plus en avoir.
  JPEG_GPS = new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#E3261C" } })
      .jpeg()
      .withExif({ IFD0: { Artist: "TEST_auteur" }, GPS: { GPSLatitudeRef: "S", GPSLatitude: "1/1 40/1 0/1" } } as never)
      .toBuffer(),
  );
});

function faux(s: Partial<DependancesGalerie> = {}) {
  const publics: { fichier: string; octets: Uint8Array }[] = [];
  const effaces: { lieu: string; chemin: string }[] = [];
  const deps: DependancesGalerie = {
    exigerDroit: vi.fn(async () => ({ auteur: AUTEUR })),
    lister: vi.fn(async () => ({ photos: [], objets: {} })),
    apercusPrives: vi.fn(async () => ({})),
    urlPublique: (f) => `https://TEST.invalid/${f}`,
    lirePhoto: vi.fn(async () => ({ objet: "photos-clients/a.jpg", statut: "en_attente", fichierPublic: null })),
    lireAttente: vi.fn(async () => ({ octets: JPEG_GPS })),
    ecrireAttente: vi.fn(async () => ({ erreur: null })),
    ecrirePublic: vi.fn(async (a) => {
      publics.push(a);
      return { erreur: null };
    }),
    ecrireCapture: vi.fn(async () => ({ erreur: null })),
    supprimerAttente: vi.fn(async (o) => {
      effaces.push({ lieu: "attente", chemin: o });
      return { erreur: null };
    }),
    supprimerPublic: vi.fn(async (f) => {
      effaces.push({ lieu: "public", chemin: f });
      return { erreur: null };
    }),
    supprimerCapture: vi.fn(async (f) => {
      effaces.push({ lieu: "capture", chemin: f });
      return { erreur: null };
    }),
    signerEnvoiAdmin: vi.fn(async () => ({ jeton: "TEST_jeton" })),
    valider: vi.fn(async () => ({ erreur: null })),
    refuser: vi.fn(async () => ({ objet: "photos-clients/a.jpg" })),
    retirer: vi.fn(async () => ({ fichierPublic: "galerie/x.jpg", objet: "photos-clients/a.jpg" })),
    trouverCompte: vi.fn(async () => ({ compteId: "00000000-0000-4000-8000-0000000000a1" })),
    deposer: vi.fn(async () => ({ id: ID })),
    invaliderGalerie: vi.fn(),
    ...s,
  };
  return { deps, publics, effaces };
}

describe("validerPhoto", () => {
  it("la photo publiée n'a plus de métadonnées (position GPS comprise) ; original effacé ; cache invalidé", async () => {
    expect((await sharp(Buffer.from(JPEG_GPS)).metadata()).exif).toBeDefined();
    const { deps, publics, effaces } = faux();
    expect(await validerPhoto(deps, { id: ID })).toEqual({ ok: true });
    expect(publics[0].fichier).toMatch(/^galerie\/[0-9a-f-]{36}\.jpg$/);
    expect((await sharp(Buffer.from(publics[0].octets)).metadata()).exif).toBeUndefined();
    expect(deps.valider).toHaveBeenCalledWith(AUTEUR, ID, publics[0].fichier);
    expect(effaces).toEqual([{ lieu: "attente", chemin: "photos-clients/a.jpg" }]);
    expect(deps.invaliderGalerie).toHaveBeenCalled();
  });

  it("refus de la base (Compte mineur) : la copie publique est effacée, rien n'est publié", async () => {
    const { deps, publics, effaces } = faux({ valider: vi.fn(async () => ({ erreur: "KS_PHOTO_MINEUR" })) });
    expect(await validerPhoto(deps, { id: ID })).toEqual({ ok: false, erreur: "mineur" });
    expect(effaces).toEqual([{ lieu: "public", chemin: publics[0].fichier }]);
    expect(deps.invaliderGalerie).not.toHaveBeenCalled();
  });

  it("photo déjà traitée ou absente : refusée sans écriture ; sans droit : refusée", async () => {
    const a = faux({ lirePhoto: vi.fn(async () => ({ objet: "photos-clients/a.jpg", statut: "publiee", fichierPublic: "galerie/x.jpg" })) });
    expect(await validerPhoto(a.deps, { id: ID })).toEqual({ ok: false, erreur: "deja_traitee" });
    expect(a.deps.ecrirePublic).not.toHaveBeenCalled();
    expect(await validerPhoto(faux({ lirePhoto: vi.fn(async () => null) }).deps, { id: ID })).toEqual({ ok: false, erreur: "introuvable" });
    const refus = faux({ exigerDroit: vi.fn(async () => { throw new DroitRefuseError("KS_DROIT_REFUSE"); }) });
    expect(await validerPhoto(refus.deps, { id: ID })).toEqual({ ok: false, erreur: "non_autorise" });
  });
});

describe("revue 8.2", () => {
  it("réponse de la base perdue mais photo publiée : la copie publique est gardée", async () => {
    let lectures = 0;
    const { deps, effaces, publics } = faux({
      valider: vi.fn(async () => ({ erreur: "fetch failed" })),
      lirePhoto: vi.fn(async () => (++lectures === 1 ? { objet: "photos-clients/a.jpg", statut: "en_attente", fichierPublic: null } : { objet: "photos-clients/a.jpg", statut: "publiee", fichierPublic: publics[0].fichier })),
    });
    expect(await validerPhoto(deps, { id: ID })).toEqual({ ok: true });
    expect(effaces.some((e) => e.lieu === "public")).toBe(false);
  });

  it("photo illisible à la validation : message dédié, rien n'est écrit", async () => {
    const { deps } = faux({ lireAttente: vi.fn(async () => ({ octets: new TextEncoder().encode("TEST") })) });
    expect(await validerPhoto(deps, { id: ID })).toEqual({ ok: false, erreur: "photo_illisible" });
    expect(deps.ecrirePublic).not.toHaveBeenCalled();
  });

  it("demanderEnvoiDepot : chemin accepté par le dépôt ; format, taille et droit vérifiés", async () => {
    const r = await demanderEnvoiDepot(faux().deps, { type: "image/webp", taille: 10 });
    expect(r.ok && CHEMIN_ENVOI_ADMIN.test(r.objet)).toBe(true);
    expect(await demanderEnvoiDepot(faux().deps, { type: "image/heic", taille: 10 })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await demanderEnvoiDepot(faux().deps, { type: "image/jpeg", taille: 15 * 1024 * 1024 + 1 })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    const refus = faux({ exigerDroit: vi.fn(async () => { throw new DroitRefuseError("KS_DROIT_REFUSE"); }) });
    expect(await demanderEnvoiDepot(refus.deps, { type: "image/jpeg", taille: 10 })).toEqual({ ok: false, erreur: "non_autorise" });
  });
});

describe("refus et retrait", () => {
  it("refus : l'original est effacé", async () => {
    const { deps, effaces } = faux();
    expect(await refuserPhoto(deps, { id: ID })).toEqual({ ok: true });
    expect(effaces).toEqual([{ lieu: "attente", chemin: "photos-clients/a.jpg" }]);
  });

  const publiee = () => vi.fn(async () => ({ objet: "photos-clients/a.jpg", statut: "publiee", fichierPublic: "galerie/x.jpg" }));

  it("retrait : copie publique effacée AVANT la base, puis cache invalidé", async () => {
    const ordre: string[] = [];
    const { deps } = faux({
      lirePhoto: publiee(),
      supprimerPublic: vi.fn(async () => (ordre.push("public"), { erreur: null })),
      retirer: vi.fn(async () => (ordre.push("base"), { fichierPublic: "galerie/x.jpg", objet: "photos-clients/a.jpg" })),
    });
    expect(await retirerPhotoAdmin(deps, { id: ID })).toEqual({ ok: true });
    expect(ordre).toEqual(["public", "base"]);
    expect(deps.invaliderGalerie).toHaveBeenCalled();
  });

  it("retrait : effacement public en échec : la base n'est pas touchée, le retrait peut être refait", async () => {
    const { deps } = faux({ lirePhoto: publiee(), supprimerPublic: vi.fn(async () => ({ erreur: "TEST_panne" })) });
    expect(await retirerPhotoAdmin(deps, { id: ID })).toEqual({ ok: false, erreur: "generique" });
    expect(deps.retirer).not.toHaveBeenCalled();
  });

  it("retrait d'une photo non publiée : introuvable, rien d'effacé", async () => {
    const { deps, effaces } = faux();
    expect(await retirerPhotoAdmin(deps, { id: ID })).toEqual({ ok: false, erreur: "introuvable" });
    expect(effaces).toEqual([]);
  });
});

describe("file", () => {
  it("aperçu signé pour une photo en attente, adresse publique pour une photo publiée", async () => {
    const { deps } = faux({
      lister: vi.fn(async () => ({
        photos: [
          { id: "a", statut: "en_attente" as const, source: "compte" as const, nomAffiche: null, ville: null, retraitDemande: false, creeLe: "2026-11-09T10:00:00Z", accordWhatsappLe: null, capture: false },
          { id: "b", statut: "publiee" as const, source: "whatsapp" as const, nomAffiche: null, ville: null, retraitDemande: true, creeLe: "2026-11-08T10:00:00Z", accordWhatsappLe: "2026-11-08", capture: true },
        ],
        objets: { a: { objet: "photos-clients/a.jpg", fichierPublic: null }, b: { objet: "photos-clients/b.jpg", fichierPublic: "galerie/b.jpg" } },
      })),
      apercusPrives: vi.fn(async () => ({ "photos-clients/a.jpg": "https://TEST.invalid/signe" })),
    });
    const r = await lirePhotosAdmin(deps);
    expect(r.ok && r.photos.map((p) => p.apercu)).toEqual(["https://TEST.invalid/signe", "https://TEST.invalid/galerie/b.jpg"]);
  });
});

describe("deposerPhotoWhatsapp", () => {
  const depot = {
    objetPhoto: "envois-admin/00000000-0000-4000-8000-000000000001.jpg",
    objetCapture: "envois-admin/00000000-0000-4000-8000-000000000002.jpg",
    email: "",
    afficherNom: true,
    nom: " TEST_Ami ",
    afficherVille: false,
    ville: "",
    accordLe: "2026-11-08",
    accordRecu: true,
    majeur: true,
  };

  it("sans Compte : photo nettoyée dans photos-clients/, capture dans le stockage privé, envois effacés", async () => {
    const { deps, effaces } = faux();
    expect(await deposerPhotoWhatsapp(deps, depot)).toEqual({ ok: true, id: ID });
    expect(deps.deposer).toHaveBeenCalledWith(expect.objectContaining({ compteId: null, nom: "TEST_Ami", ville: null, accordLe: "2026-11-08", majeur: true, capture: expect.stringMatching(/^[0-9a-f-]{36}\.jpg$/) }));
    expect(deps.ecrireAttente).toHaveBeenCalledWith(expect.objectContaining({ objet: expect.stringMatching(/^photos-clients\//) }));
    expect(effaces.map((e) => e.chemin)).toEqual([depot.objetPhoto, depot.objetCapture]);
  });

  it("accord non coché, date impossible, majorité non confirmée, capture identique à la photo : refusés avant toute lecture", async () => {
    const { deps } = faux();
    expect(await deposerPhotoWhatsapp(deps, { ...depot, accordLe: "2026-02-31" })).toEqual({ ok: false, erreur: "accord_manquant" });
    expect(await deposerPhotoWhatsapp(deps, { ...depot, objetCapture: depot.objetPhoto })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await deposerPhotoWhatsapp(deps, { ...depot, accordRecu: false })).toEqual({ ok: false, erreur: "accord_manquant" });
    expect(await deposerPhotoWhatsapp(deps, { ...depot, majeur: false })).toEqual({ ok: false, erreur: "majorite" });
    expect(deps.lireAttente).not.toHaveBeenCalled();
  });

  it("email inconnu : refusé ; sans Compte et sans pseudo : refusé", async () => {
    expect(await deposerPhotoWhatsapp(faux({ trouverCompte: vi.fn(async () => ({ compteId: null })) }).deps, { ...depot, email: "TEST@example.invalid" })).toEqual({ ok: false, erreur: "compte_introuvable" });
    expect(await deposerPhotoWhatsapp(faux().deps, { ...depot, afficherNom: false })).toEqual({ ok: false, erreur: "affichage_invalide" });
  });

  it("refus de la base (Compte mineur) : la photo et la capture déjà écrites sont effacées", async () => {
    const { deps, effaces } = faux({ deposer: vi.fn(async () => ({ erreur: "KS_PHOTO_MINEUR" })) });
    expect(await deposerPhotoWhatsapp(deps, { ...depot, email: "TEST@example.invalid" })).toEqual({ ok: false, erreur: "mineur" });
    expect(effaces.some((e) => e.lieu === "attente" && e.chemin.startsWith("photos-clients/"))).toBe(true);
    expect(effaces.some((e) => e.lieu === "capture")).toBe(true);
  });
});
