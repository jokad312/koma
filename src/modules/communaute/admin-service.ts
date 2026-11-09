import { z } from "zod";
import { DroitRefuseError } from "@/lib/auth/droits";
import { nettoyerPhoto } from "@/modules/catalogue/photo";
import { CHEMIN_ENVOI_ADMIN } from "./admin-types";
import type { DependancesGalerie, DepotWhatsapp, ErreurGalerie, PhotoAdmin, ResultatGalerie } from "./admin-types";
import { DOSSIER_PHOTOS_CLIENTS, FORMATS_PHOTO_CLIENT, PHOTO_CLIENT_TAILLE_MAX } from "./types";

// Seul le contexte est journalisé : ni nom, ni email, ni chemin.
function journaliser(contexte: string) {
  console.error(`[galerie] ${contexte} : échec`);
}

const idSchema = z.object({ id: z.uuid() });
const CONTROLE = /[\p{Cc}\p{Cs}\p{Cf}]/u;

function erreurDeLaBase(message: string): ErreurGalerie {
  if (message.includes("KS_PHOTO_INTROUVABLE") || message.includes("KS_PHOTO_NON_PUBLIEE")) return "introuvable";
  if (message.includes("KS_PHOTO_DEJA_TRAITEE")) return "deja_traitee";
  if (message.includes("KS_PHOTO_MINEUR")) return "mineur";
  if (message.includes("KS_ACCORD_MANQUANT")) return "accord_manquant";
  if (message.includes("KS_MAJORITE_NON_CONFIRMEE")) return "majorite";
  if (message.includes("KS_AFFICHAGE_INVALIDE")) return "affichage_invalide";
  if (message.includes("KS_COMPTE_INTROUVABLE")) return "compte_introuvable";
  if (message.includes("KS_DROIT_REFUSE")) return "non_autorise";
  return "generique";
}

async function droit(deps: DependancesGalerie) {
  try {
    return await deps.exigerDroit();
  } catch (e) {
    if (e instanceof DroitRefuseError) return null;
    throw e;
  }
}

// File de la page « Galerie » : aperçu signé pour une photo en attente, adresse publique pour une photo publiée.
export async function lirePhotosAdmin(deps: DependancesGalerie): Promise<ResultatGalerie<{ photos: PhotoAdmin[] }>> {
  try {
    const d = await droit(deps);
    if (!d) return { ok: false, erreur: "non_autorise" };
    const lu = await deps.lister(d.auteur);
    if ("erreur" in lu) {
      journaliser("lecture de la file");
      return { ok: false, erreur: "generique" };
    }
    const enAttente = lu.photos.filter((p) => p.statut === "en_attente").map((p) => lu.objets[p.id]?.objet).filter((o): o is string => !!o);
    const prives = enAttente.length > 0 ? await deps.apercusPrives(enAttente) : {};
    return {
      ok: true,
      photos: lu.photos.map((p) => {
        const o = lu.objets[p.id];
        const apercu = p.statut === "en_attente" ? (prives[o?.objet ?? ""] ?? null) : o?.fichierPublic ? deps.urlPublique(o.fichierPublic) : null;
        return { ...p, apercu };
      }),
    };
  } catch {
    journaliser("lecture de la file");
    return { ok: false, erreur: "generique" };
  }
}

// Validation : la photo est relue, ses métadonnées (EXIF, position GPS) retirées une nouvelle fois, la copie écrite dans produits-public, puis la
// base la publie (journalisé). Échec de la base : la copie publique est effacée. Succès : l'original privé est effacé, le cache « galerie » invalidé.
export async function validerPhoto(deps: DependancesGalerie, entree: unknown): Promise<ResultatGalerie> {
  const lu = idSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "introuvable" };
  let fichier: string | null = null;
  try {
    const d = await droit(deps);
    if (!d) return { ok: false, erreur: "non_autorise" };
    const photo = await deps.lirePhoto(lu.data.id);
    if (photo === null) return { ok: false, erreur: "introuvable" };
    if ("erreur" in photo) {
      journaliser("lecture de la photo");
      return { ok: false, erreur: "generique" };
    }
    if (photo.statut !== "en_attente") return { ok: false, erreur: "deja_traitee" };
    const brut = await deps.lireAttente(photo.objet);
    if ("erreur" in brut) {
      journaliser("lecture de l'original");
      return { ok: false, erreur: "generique" };
    }
    const propre = await nettoyerPhoto(brut.octets);
    if (!propre.ok) return { ok: false, erreur: "photo_illisible" };
    fichier = `galerie/${crypto.randomUUID()}.${propre.ext}`;
    const ecrit = await deps.ecrirePublic({ fichier, octets: propre.octets, contentType: propre.contentType });
    if (ecrit.erreur) {
      journaliser("écriture de la copie publique");
      return { ok: false, erreur: "generique" };
    }
    const v = await deps.valider(d.auteur, lu.data.id, fichier);
    if (v.erreur) {
      const erreur = erreurDeLaBase(v.erreur);
      // Réponse perdue (réseau) : la ligne est relue ; si la base a publié, la copie publique est gardée.
      if (erreur === "generique") {
        const relue = await deps.lirePhoto(lu.data.id).catch(() => null);
        if (relue && !("erreur" in relue) && relue.statut === "publiee" && relue.fichierPublic === fichier) {
          fichier = null;
          return await apresPublication(deps, photo.objet);
        }
        journaliser("validation");
      }
      const e1 = await deps.supprimerPublic(fichier).catch(() => ({ erreur: "exception" }));
      if (e1.erreur) journaliser("effacement de la copie publique non publiée");
      fichier = null;
      return { ok: false, erreur };
    }
    // Publiée : la copie publique ne doit plus jamais être effacée par ce traitement.
    fichier = null;
    return await apresPublication(deps, photo.objet);
  } catch {
    journaliser("validation");
    if (fichier) await deps.supprimerPublic(fichier).catch(() => ({ erreur: null }));
    return { ok: false, erreur: "generique" };
  }
}

// Après publication : l'original privé est effacé et le cache invalidé ; un échec est journalisé, jamais rapporté comme un échec de validation.
async function apresPublication(deps: DependancesGalerie, objet: string): Promise<ResultatGalerie> {
  const efface = await deps.supprimerAttente(objet).catch(() => ({ erreur: "exception" }));
  if (efface.erreur) journaliser("effacement de l'original validé");
  try {
    deps.invaliderGalerie();
  } catch {
    journaliser("invalidation du cache");
  }
  return { ok: true };
}

// Refus : jamais publiée ; l'original est effacé.
export async function refuserPhoto(deps: DependancesGalerie, entree: unknown): Promise<ResultatGalerie> {
  const lu = idSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "introuvable" };
  try {
    const d = await droit(deps);
    if (!d) return { ok: false, erreur: "non_autorise" };
    const r = await deps.refuser(d.auteur, lu.data.id);
    if ("erreur" in r) {
      const erreur = erreurDeLaBase(r.erreur);
      if (erreur === "generique") journaliser("refus");
      return { ok: false, erreur };
    }
    const efface = await deps.supprimerAttente(r.objet).catch(() => ({ erreur: "exception" }));
    if (efface.erreur) journaliser("effacement de l'original refusé");
    return { ok: true };
  } catch {
    journaliser("refus");
    return { ok: false, erreur: "generique" };
  }
}

// Retrait d'une photo publiée : la base la retire aussitôt du mur ; la copie publique et l'original sont effacés, le cache invalidé.
export async function retirerPhotoAdmin(deps: DependancesGalerie, entree: unknown): Promise<ResultatGalerie> {
  const lu = idSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "introuvable" };
  try {
    const d = await droit(deps);
    if (!d) return { ok: false, erreur: "non_autorise" };
    // La copie publique est effacée AVANT que la base retire la photo : si l'effacement échoue, rien ne change et le retrait peut être
    // refait ; une photo retirée n'est donc jamais encore accessible par son adresse publique.
    const photo = await deps.lirePhoto(lu.data.id);
    if (photo === null) return { ok: false, erreur: "introuvable" };
    if ("erreur" in photo) {
      journaliser("lecture de la photo");
      return { ok: false, erreur: "generique" };
    }
    if (photo.statut !== "publiee") return { ok: false, erreur: "introuvable" };
    if (photo.fichierPublic) {
      const e1 = await deps.supprimerPublic(photo.fichierPublic);
      if (e1.erreur) {
        journaliser("effacement de la copie publique");
        return { ok: false, erreur: "generique" };
      }
    }
    const r = await deps.retirer(d.auteur, lu.data.id);
    if ("erreur" in r) {
      const erreur = erreurDeLaBase(r.erreur);
      if (erreur === "generique") journaliser("retrait");
      return { ok: false, erreur };
    }
    try {
      deps.invaliderGalerie();
    } catch {
      journaliser("invalidation du cache");
    }
    return { ok: true };
  } catch {
    journaliser("retrait");
    return { ok: false, erreur: "generique" };
  }
}

// Autorisation d'envoi du personnel (photo reçue par WhatsApp ou capture de l'accord) vers galerie-attente/envois-admin/.
export async function demanderEnvoiDepot(deps: DependancesGalerie, entree: unknown): Promise<ResultatGalerie<{ objet: string; jeton: string }>> {
  const lu = z.object({ type: z.string(), taille: z.number() }).safeParse(entree);
  if (!lu.success || !Object.hasOwn(FORMATS_PHOTO_CLIENT, lu.data.type) || !Number.isInteger(lu.data.taille) || lu.data.taille < 1) return { ok: false, erreur: "format_invalide" };
  if (lu.data.taille > PHOTO_CLIENT_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  try {
    const d = await droit(deps);
    if (!d) return { ok: false, erreur: "non_autorise" };
    const objet = `envois-admin/${crypto.randomUUID()}.${FORMATS_PHOTO_CLIENT[lu.data.type as keyof typeof FORMATS_PHOTO_CLIENT]}`;
    const s = await deps.signerEnvoiAdmin(objet);
    if ("erreur" in s) {
      journaliser("autorisation d'envoi");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton: s.jeton };
  } catch {
    journaliser("autorisation d'envoi");
    return { ok: false, erreur: "generique" };
  }
}

const depotSchema = z.object({
  objetPhoto: z.string(),
  objetCapture: z.string().nullable(),
  email: z.string().max(320),
  afficherNom: z.boolean(),
  nom: z.string().max(200),
  afficherVille: z.boolean(),
  ville: z.string().max(200),
  // Date réelle (2026-02-31 refusée) ; la base la borne aussi : ni future, ni plus vieille d'un an.
  accordLe: z.string().max(10),
  accordRecu: z.boolean(),
  majeur: z.boolean(),
});

// Dépôt d'une photo reçue par WhatsApp : accord reçu (case + date) et majorité confirmée obligatoires ; photo nettoyée dans photos-clients/,
// capture nettoyée dans le bucket privé accords-whatsapp ; Compte rattaché par son email (mineur refusé), sinon pseudo obligatoire.
export async function deposerPhotoWhatsapp(deps: DependancesGalerie, entree: unknown): Promise<ResultatGalerie<{ id: string }>> {
  const lu = depotSchema.safeParse(entree);
  if (!lu.success || !CHEMIN_ENVOI_ADMIN.test(lu.data.objetPhoto) || (lu.data.objetCapture !== null && !CHEMIN_ENVOI_ADMIN.test(lu.data.objetCapture))) {
    return { ok: false, erreur: "format_invalide" };
  }
  const e: DepotWhatsapp = lu.data;
  if (e.objetCapture === e.objetPhoto) return { ok: false, erreur: "format_invalide" };
  if (!e.accordRecu) return { ok: false, erreur: "accord_manquant" };
  const dateReelle = /^\d{4}-\d{2}-\d{2}$/.test(e.accordLe) && !Number.isNaN(Date.parse(e.accordLe)) && new Date(e.accordLe).toISOString().slice(0, 10) === e.accordLe;
  if (!dateReelle) return { ok: false, erreur: "accord_manquant" };
  if (!e.majeur) return { ok: false, erreur: "majorite" };
  const nom = e.afficherNom ? e.nom.trim() : "";
  const ville = e.afficherVille ? e.ville.trim() : "";
  if ((e.afficherNom && nom === "") || (e.afficherVille && ville === "") || [...nom].length > 40 || [...ville].length > 60 || CONTROLE.test(nom) || CONTROLE.test(ville)) {
    return { ok: false, erreur: "affichage_invalide" };
  }
  const ecrits: { attente: string[]; capture: string[] } = { attente: [], capture: [] };
  const nettoyer = async () => {
    for (const o of ecrits.attente) await deps.supprimerAttente(o).catch(() => ({ erreur: null }));
    for (const c of ecrits.capture) await deps.supprimerCapture(c).catch(() => ({ erreur: null }));
  };
  try {
    const d = await droit(deps);
    if (!d) return { ok: false, erreur: "non_autorise" };
    let compteId: string | null = null;
    if (e.email.trim() !== "") {
      const t = await deps.trouverCompte(d.auteur, e.email);
      if ("erreur" in t) {
        journaliser("recherche du Compte");
        return { ok: false, erreur: "generique" };
      }
      if (!t.compteId) return { ok: false, erreur: "compte_introuvable" };
      compteId = t.compteId;
    } else if (nom === "") {
      return { ok: false, erreur: "affichage_invalide" };
    }

    const photo = await deps.lireAttente(e.objetPhoto);
    if ("erreur" in photo) {
      journaliser("lecture de la photo déposée");
      return { ok: false, erreur: "generique" };
    }
    const propre = await nettoyerPhoto(photo.octets);
    if (!propre.ok) {
      await deps.supprimerAttente(e.objetPhoto).catch(() => ({ erreur: null }));
      if (e.objetCapture) await deps.supprimerAttente(e.objetCapture).catch(() => ({ erreur: null }));
      return { ok: false, erreur: "format_invalide" };
    }
    const objet = `${DOSSIER_PHOTOS_CLIENTS}/${crypto.randomUUID()}.${propre.ext}`;
    const ecritPhoto = await deps.ecrireAttente({ objet, octets: propre.octets, contentType: propre.contentType });
    if (ecritPhoto.erreur) {
      journaliser("écriture de la photo déposée");
      return { ok: false, erreur: "generique" };
    }
    ecrits.attente.push(objet);

    let capture: string | null = null;
    if (e.objetCapture) {
      const brut = await deps.lireAttente(e.objetCapture);
      if ("erreur" in brut) {
        await nettoyer();
        journaliser("lecture de la capture");
        return { ok: false, erreur: "generique" };
      }
      const c = await nettoyerPhoto(brut.octets);
      if (!c.ok) {
        await nettoyer();
        return { ok: false, erreur: "format_invalide" };
      }
      capture = `${crypto.randomUUID()}.${c.ext}`;
      const ec = await deps.ecrireCapture({ fichier: capture, octets: c.octets, contentType: c.contentType });
      if (ec.erreur) {
        await nettoyer();
        journaliser("écriture de la capture");
        return { ok: false, erreur: "generique" };
      }
      ecrits.capture.push(capture);
    }

    const depot = await deps.deposer({ auteur: d.auteur, objet, compteId, nom: nom || null, ville: ville || null, accordLe: e.accordLe, majeur: true, capture });
    if ("erreur" in depot) {
      await nettoyer();
      const erreur = erreurDeLaBase(depot.erreur);
      if (erreur === "generique") journaliser("dépôt");
      return { ok: false, erreur };
    }
    await deps.supprimerAttente(e.objetPhoto).catch(() => ({ erreur: null }));
    if (e.objetCapture) await deps.supprimerAttente(e.objetCapture).catch(() => ({ erreur: null }));
    return { ok: true, id: depot.id };
  } catch {
    journaliser("dépôt");
    await nettoyer();
    return { ok: false, erreur: "generique" };
  }
}
