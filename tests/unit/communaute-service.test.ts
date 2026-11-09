// Story 8.1 : envoi d'une photo par un client (autorisation, finalisation avec nettoyage, annulation, liste, retrait).
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { construireAuteur } from "@/lib/auth/auteur";
import { annulerEnvoiPhoto, demanderEnvoiPhoto, finaliserPhoto, listerMesPhotos, retirerPhoto } from "@/modules/communaute/service";
import type { DependancesCommunaute } from "@/modules/communaute/types";

const COMPTE = "00000000-0000-4000-8000-0000000000f1";
const OBJET = `envois-photos/${COMPTE}.00000000-0000-4000-8000-000000000001.jpg`;
const OBJET_AUTRE = "envois-photos/00000000-0000-4000-8000-0000000000f9.00000000-0000-4000-8000-000000000001.jpg";
let JPEG_GPS: Uint8Array;

beforeAll(async () => {
  // Photo de test avec des métadonnées EXIF (dont une position GPS) : elles doivent disparaître.
  JPEG_GPS = new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#E3261C" } })
      .jpeg()
      .withExif({ IFD0: { Artist: "TEST_auteur" }, GPS: { GPSLatitudeRef: "S", GPSLatitude: "1/1 40/1 0/1" } } as never)
      .toBuffer(),
  );
});

function faux(s: Partial<DependancesCommunaute> = {}) {
  const ecrits: { objet: string; octets: Uint8Array; contentType: string }[] = [];
  const supprimes: string[] = [];
  const deps: DependancesCommunaute = {
    compte: vi.fn(async () => ({ compteId: COMPTE, auteur: construireAuteur(COMPTE) })),
    estMineur: vi.fn(async () => false),
    consommerEssai: vi.fn(async () => ({ autorise: true })),
    signerEnvoi: vi.fn(async () => ({ jeton: "TEST_jeton" })),
    lireObjet: vi.fn(async () => ({ octets: JPEG_GPS })),
    ecrireObjet: vi.fn(async (a) => {
      ecrits.push(a);
      return { erreur: null };
    }),
    supprimerObjet: vi.fn(async (o) => {
      supprimes.push(o);
      return { erreur: null };
    }),
    deposer: vi.fn(async () => ({ id: "00000000-0000-4000-8000-0000000000aa" })),
    lister: vi.fn(async () => ({ photos: [], objets: {} })),
    apercus: vi.fn(async () => ({})),
    retirer: vi.fn(async () => ({ resultat: "retiree" as const, objet: "photos-clients/x.jpg" })),
    ...s,
  };
  return { deps, ecrits, supprimes };
}

const finale = { objet: OBJET, accord: true, afficherNom: true, nom: " TEST_Pseudo ", afficherVille: false, ville: "ignorée" };

describe("demanderEnvoiPhoto", () => {
  it("JPEG, PNG ou WebP de 15 Mo au plus : chemin choisi par le serveur dans envois-photos/", async () => {
    const { deps } = faux();
    const r = await demanderEnvoiPhoto(deps, { type: "image/png", taille: 1000 });
    expect(r).toMatchObject({ ok: true, jeton: "TEST_jeton" });
    // Le chemin porte le Compte qui a demandé l'envoi.
    expect(r.ok && r.objet).toMatch(new RegExp(`^envois-photos/${COMPTE}\\.[0-9a-f-]{36}\\.png$`));
    expect(deps.consommerEssai).toHaveBeenCalledWith(`photo:${COMPTE}`);
  });

  it("refuse HEIC, un fichier vide ou de plus de 15 Mo, sans rien demander au serveur", async () => {
    const { deps } = faux();
    expect(await demanderEnvoiPhoto(deps, { type: "image/heic", taille: 1000 })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await demanderEnvoiPhoto(deps, { type: "image/jpeg", taille: 0 })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await demanderEnvoiPhoto(deps, { type: "image/jpeg", taille: 15 * 1024 * 1024 + 1 })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(deps.signerEnvoi).not.toHaveBeenCalled();
  });

  it("Compte mineur, limite atteinte, non connecté : refusés", async () => {
    expect(await demanderEnvoiPhoto(faux({ estMineur: vi.fn(async () => true) }).deps, { type: "image/jpeg", taille: 10 })).toEqual({ ok: false, erreur: "mineur" });
    expect(await demanderEnvoiPhoto(faux({ consommerEssai: vi.fn(async () => ({ autorise: false })) }).deps, { type: "image/jpeg", taille: 10 })).toEqual({ ok: false, erreur: "trop_d_envois" });
    expect(await demanderEnvoiPhoto(faux({ compte: vi.fn(async () => null) }).deps, { type: "image/jpeg", taille: 10 })).toEqual({ ok: false, erreur: "non_connecte" });
  });
});

describe("finaliserPhoto", () => {
  it("copie nettoyée (sans EXIF ni GPS) dans photos-clients/, original effacé, photo et accord enregistrés", async () => {
    const { deps, ecrits, supprimes } = faux();
    expect((await sharp(Buffer.from(JPEG_GPS)).metadata()).exif).toBeDefined();
    expect(await finaliserPhoto(deps, finale)).toEqual({ ok: true, id: "00000000-0000-4000-8000-0000000000aa" });
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0].objet).toMatch(/^photos-clients\/[0-9a-f-]{36}\.jpg$/);
    const meta = await sharp(Buffer.from(ecrits[0].octets)).metadata();
    expect(meta.exif).toBeUndefined();
    expect(supprimes).toContain(OBJET);
    expect(deps.deposer).toHaveBeenCalledWith(expect.objectContaining({ objet: ecrits[0].objet, nom: "TEST_Pseudo", ville: null }));
  });

  it("sans accord : refusé avant toute lecture", async () => {
    const { deps } = faux();
    expect(await finaliserPhoto(deps, { ...finale, accord: false })).toEqual({ ok: false, erreur: "accord_manquant" });
    expect(deps.lireObjet).not.toHaveBeenCalled();
  });

  it("pseudo demandé mais vide, ou chemin hors envois-photos/ : refusés", async () => {
    const { deps } = faux();
    expect(await finaliserPhoto(deps, { ...finale, nom: "   " })).toEqual({ ok: false, erreur: "affichage_invalide" });
    expect(await finaliserPhoto(deps, { ...finale, objet: "photos-clients/00000000-0000-4000-8000-000000000001.jpg" })).toEqual({ ok: false, erreur: "format_invalide" });
  });

  it("contenu qui n'est pas une image : refusé, original effacé, rien d'enregistré", async () => {
    const { deps, supprimes } = faux({ lireObjet: vi.fn(async () => ({ octets: new TextEncoder().encode("<script>TEST</script>") })) });
    expect(await finaliserPhoto(deps, finale)).toEqual({ ok: false, erreur: "format_invalide" });
    expect(supprimes).toContain(OBJET);
    expect(deps.deposer).not.toHaveBeenCalled();
  });

  it("enregistrement refusé par la base : la copie nettoyée est effacée", async () => {
    const { deps, ecrits, supprimes } = faux({ deposer: vi.fn(async () => ({ erreur: "KS_PHOTO_MINEUR" })) });
    expect(await finaliserPhoto(deps, finale)).toEqual({ ok: false, erreur: "mineur" });
    expect(supprimes).toContain(ecrits[0].objet);
  });
});

describe("revue 8.1", () => {
  it("un envoi autorisé pour un autre Compte n'est ni finalisé ni annulé, ni lu ni effacé", async () => {
    const { deps, supprimes } = faux();
    expect(await finaliserPhoto(deps, { ...finale, objet: OBJET_AUTRE })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await annulerEnvoiPhoto(deps, { objet: OBJET_AUTRE })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(deps.lireObjet).not.toHaveBeenCalled();
    expect(supprimes).toEqual([]);
  });

  it("enregistrement qui lève après l'écriture : la copie nettoyée est effacée aussi", async () => {
    const { deps, ecrits, supprimes } = faux({ deposer: vi.fn(async () => { throw new Error("TEST_panne"); }) });
    expect(await finaliserPhoto(deps, finale)).toEqual({ ok: false, erreur: "generique" });
    expect(supprimes).toContain(ecrits[0].objet);
  });

  it("pseudo fait de caractères invisibles ou d'inversion : refusé", async () => {
    const { deps } = faux();
    expect(await finaliserPhoto(deps, { ...finale, nom: "TEST‮ofni" })).toEqual({ ok: false, erreur: "affichage_invalide" });
    expect(await finaliserPhoto(deps, { ...finale, nom: "​" })).toEqual({ ok: false, erreur: "affichage_invalide" });
  });

  it("retrait : déjà retirée = succès sans effacement ; effacement qui lève = succès quand même (la base a retiré)", async () => {
    const a = faux({ retirer: vi.fn(async () => ({ resultat: "deja_retiree" as const, objet: "photos-clients/x.jpg" })) });
    expect(await retirerPhoto(a.deps, { id: "00000000-0000-4000-8000-0000000000aa" })).toEqual({ ok: true, resultat: "retiree" });
    const b = faux({ supprimerObjet: vi.fn(async () => { throw new Error("TEST_panne"); }) });
    expect(await retirerPhoto(b.deps, { id: "00000000-0000-4000-8000-0000000000aa" })).toEqual({ ok: true, resultat: "retiree" });
  });
});

describe("annulation, liste et retrait", () => {
  it("annuler n'efface qu'un objet d'envoi", async () => {
    const { deps, supprimes } = faux();
    expect(await annulerEnvoiPhoto(deps, { objet: OBJET })).toEqual({ ok: true });
    expect(await annulerEnvoiPhoto(deps, { objet: "photos-clients/00000000-0000-4000-8000-000000000001.jpg" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(supprimes).toEqual([OBJET]);
  });

  it("liste : aperçu signé pour une photo visible, jamais pour une photo retirée", async () => {
    const { deps } = faux({
      lister: vi.fn(async () => ({
        photos: [
          { id: "a", statut: "en_attente" as const, nomAffiche: null, ville: null, retraitDemande: false, creeLe: "2026-11-08T10:00:00Z" },
          { id: "b", statut: "retiree" as const, nomAffiche: null, ville: null, retraitDemande: false, creeLe: "2026-11-07T10:00:00Z" },
          { id: "c", statut: "publiee" as const, nomAffiche: null, ville: null, retraitDemande: false, creeLe: "2026-11-06T10:00:00Z" },
          { id: "d", statut: "refusee" as const, nomAffiche: null, ville: null, retraitDemande: false, creeLe: "2026-11-05T10:00:00Z" },
        ],
        objets: { a: "photos-clients/a.jpg", b: "photos-clients/b.jpg", c: "photos-clients/c.jpg", d: "photos-clients/d.jpg" },
      })),
      apercus: vi.fn(async () => ({ "photos-clients/a.jpg": "https://TEST.invalid/a" })),
    });
    const r = await listerMesPhotos(deps);
    // Seule une photo en attente a encore un original privé : aucun lien signé pour une photo publiée, refusée ou retirée.
    expect(r.ok && r.photos.map((p) => p.apercu)).toEqual(["https://TEST.invalid/a", null, null, null]);
    expect(deps.apercus).toHaveBeenCalledWith(["photos-clients/a.jpg"]);
  });

  it("retrait d'une photo en attente : le fichier est effacé ; photo publiée : demande seulement", async () => {
    const a = faux();
    expect(await retirerPhoto(a.deps, { id: "00000000-0000-4000-8000-0000000000aa" })).toEqual({ ok: true, resultat: "retiree" });
    expect(a.supprimes).toEqual(["photos-clients/x.jpg"]);
    const b = faux({ retirer: vi.fn(async () => ({ resultat: "demande" as const, objet: "photos-clients/y.jpg" })) });
    expect(await retirerPhoto(b.deps, { id: "00000000-0000-4000-8000-0000000000aa" })).toEqual({ ok: true, resultat: "demande" });
    expect(b.supprimes).toEqual([]);
  });
});
