import { z } from "zod";
import { nettoyerPhoto } from "@/modules/catalogue/photo";
import { CHEMIN_ENVOI_PHOTO, compteDeLEnvoi, DOSSIER_PHOTOS_CLIENTS, FORMATS_PHOTO_CLIENT, PHOTO_CLIENT_TAILLE_MAX } from "./types";
import type { DependancesCommunaute, PhotoClient, ResultatPhoto } from "./types";

// Seul le contexte est journalisé : ni identifiant de Compte, ni nom de fichier, ni donnée personnelle.
function journaliser(contexte: string) {
  console.error(`[communaute] ${contexte} : échec`);
}

// Caractères de contrôle, de substitution et de mise en forme invisibles (U+200B, U+202E…) refusés.
const CONTROLE = /[\p{Cc}\p{Cs}\p{Cf}]/u;

// Choix d'affichage : vide = ne pas afficher. Pseudo 40 caractères, ville 60, sans caractère de contrôle.
const affichageSchema = z.object({
  nom: z.string().max(200).transform((v) => v.trim()),
  ville: z.string().max(200).transform((v) => v.trim()),
});

function affichageValide(nom: string, ville: string): boolean {
  return [...nom].length <= 40 && [...ville].length <= 60 && !CONTROLE.test(nom) && !CONTROLE.test(ville);
}

// Autorise l'envoi direct d'une photo vers le bucket privé : chemin choisi par le serveur, Compte complet, pas de Compte mineur, limite d'envois.
export async function demanderEnvoiPhoto(deps: DependancesCommunaute, entree: unknown): Promise<ResultatPhoto<{ objet: string; jeton: string }>> {
  const lu = z.object({ type: z.string(), taille: z.number() }).safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "format_invalide" };
  if (!Object.hasOwn(FORMATS_PHOTO_CLIENT, lu.data.type)) return { ok: false, erreur: "format_invalide" };
  if (!Number.isInteger(lu.data.taille) || lu.data.taille < 1) return { ok: false, erreur: "format_invalide" };
  if (lu.data.taille > PHOTO_CLIENT_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    if (await deps.estMineur(compte.compteId)) return { ok: false, erreur: "mineur" };
    const essai = await deps.consommerEssai(`photo:${compte.compteId}`);
    if ("erreur" in essai) {
      journaliser("limite d'envois");
      return { ok: false, erreur: "generique" };
    }
    if (!essai.autorise) return { ok: false, erreur: "trop_d_envois" };
    const ext = FORMATS_PHOTO_CLIENT[lu.data.type as keyof typeof FORMATS_PHOTO_CLIENT];
    const objet = `envois-photos/${compte.compteId.toLowerCase()}.${crypto.randomUUID()}.${ext}`;
    const signe = await deps.signerEnvoi(objet);
    if ("erreur" in signe) {
      journaliser("autorisation d'envoi");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton: signe.jeton };
  } catch {
    journaliser("autorisation d'envoi");
    return { ok: false, erreur: "generique" };
  }
}

// Finalise l'envoi : accord obligatoire, contenu réel contrôlé (JPEG, PNG ou WebP, 15 Mo au plus), métadonnées retirées (position GPS
// comprise), copie nettoyée rangée dans photos-clients/, original de l'envoi effacé, puis photo et accord enregistrés en base.
export async function finaliserPhoto(deps: DependancesCommunaute, entree: unknown): Promise<ResultatPhoto<{ id: string }>> {
  const lu = z
    .object({ objet: z.string(), accord: z.boolean(), afficherNom: z.boolean(), nom: z.string(), afficherVille: z.boolean(), ville: z.string() })
    .safeParse(entree);
  if (!lu.success || !CHEMIN_ENVOI_PHOTO.test(lu.data.objet)) return { ok: false, erreur: "format_invalide" };
  if (lu.data.accord !== true) return { ok: false, erreur: "accord_manquant" };
  const affichage = affichageSchema.safeParse({ nom: lu.data.afficherNom ? lu.data.nom : "", ville: lu.data.afficherVille ? lu.data.ville : "" });
  if (!affichage.success || !affichageValide(affichage.data.nom, affichage.data.ville)) return { ok: false, erreur: "affichage_invalide" };
  if (lu.data.afficherNom && affichage.data.nom === "") return { ok: false, erreur: "affichage_invalide" };
  if (lu.data.afficherVille && affichage.data.ville === "") return { ok: false, erreur: "affichage_invalide" };

  const objetEnvoi = lu.data.objet;
  let objetGarde: string | null = null;
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    // Un envoi autorisé pour un autre Compte n'est jamais lu, enregistré ni effacé ici.
    if (compteDeLEnvoi(objetEnvoi) !== compte.compteId.toLowerCase()) return { ok: false, erreur: "format_invalide" };
    if (await deps.estMineur(compte.compteId)) {
      await deps.supprimerObjet(objetEnvoi);
      return { ok: false, erreur: "mineur" };
    }
    const brut = await deps.lireObjet(objetEnvoi);
    if ("erreur" in brut) {
      journaliser("lecture de la photo");
      return { ok: false, erreur: "generique" };
    }
    if (brut.octets.byteLength > PHOTO_CLIENT_TAILLE_MAX) {
      await deps.supprimerObjet(objetEnvoi);
      return { ok: false, erreur: "fichier_trop_lourd" };
    }
    const propre = await nettoyerPhoto(brut.octets);
    if (!propre.ok) {
      await deps.supprimerObjet(objetEnvoi);
      return { ok: false, erreur: "format_invalide" };
    }
    objetGarde = `${DOSSIER_PHOTOS_CLIENTS}/${crypto.randomUUID()}.${propre.ext}`;
    const ecrit = await deps.ecrireObjet({ objet: objetGarde, octets: propre.octets, contentType: propre.contentType });
    if (ecrit.erreur) {
      journaliser("écriture de la photo");
      await deps.supprimerObjet(objetEnvoi);
      return { ok: false, erreur: "generique" };
    }
    await deps.supprimerObjet(objetEnvoi);
    const depot = await deps.deposer({ auteur: compte.auteur, objet: objetGarde, nom: affichage.data.nom || null, ville: affichage.data.ville || null });
    if ("erreur" in depot) {
      // Rien n'est enregistré : la copie nettoyée est effacée (sinon la purge des fichiers sans photo la reprendra).
      const efface = await deps.supprimerObjet(objetGarde);
      if (efface.erreur) journaliser("effacement de la copie non enregistrée");
      if (depot.erreur.includes("KS_PHOTO_MINEUR")) return { ok: false, erreur: "mineur" };
      if (depot.erreur.includes("KS_AFFICHAGE_INVALIDE")) return { ok: false, erreur: "affichage_invalide" };
      journaliser("enregistrement de la photo");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, id: depot.id };
  } catch {
    journaliser("finalisation de la photo");
    await deps.supprimerObjet(objetEnvoi).catch(() => ({ erreur: null }));
    if (objetGarde) await deps.supprimerObjet(objetGarde).catch(() => ({ erreur: null }));
    return { ok: false, erreur: "generique" };
  }
}

// Envoi abandonné par le client : l'objet d'envoi est effacé (jamais une photo déjà enregistrée).
export async function annulerEnvoiPhoto(deps: DependancesCommunaute, entree: unknown): Promise<ResultatPhoto> {
  const lu = z.object({ objet: z.string() }).safeParse(entree);
  if (!lu.success || !CHEMIN_ENVOI_PHOTO.test(lu.data.objet)) return { ok: false, erreur: "format_invalide" };
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    if (compteDeLEnvoi(lu.data.objet) !== compte.compteId.toLowerCase()) return { ok: false, erreur: "format_invalide" };
    const { erreur } = await deps.supprimerObjet(lu.data.objet);
    if (erreur) {
      journaliser("annulation d'envoi");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true };
  } catch {
    journaliser("annulation d'envoi");
    return { ok: false, erreur: "generique" };
  }
}

// Photos du Compte avec leur état réel et un aperçu signé de courte durée (bucket privé).
export async function listerMesPhotos(deps: DependancesCommunaute): Promise<ResultatPhoto<{ photos: PhotoClient[]; mineur: boolean }>> {
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    const [lu, mineur] = await Promise.all([deps.lister(compte.compteId), deps.estMineur(compte.compteId)]);
    if ("erreur" in lu) {
      journaliser("lecture des photos");
      return { ok: false, erreur: "generique" };
    }
    const visibles = lu.photos.filter((p) => p.statut !== "retiree").map((p) => lu.objets[p.id]).filter((o): o is string => typeof o === "string");
    const apercus = visibles.length > 0 ? await deps.apercus(visibles) : {};
    return {
      ok: true,
      mineur,
      photos: lu.photos.map((p) => ({ ...p, apercu: p.statut === "retiree" ? null : (apercus[lu.objets[p.id] ?? ""] ?? null) })),
    };
  } catch {
    journaliser("lecture des photos");
    return { ok: false, erreur: "generique" };
  }
}

// Retrait demandé par le client : en attente, la photo est retirée et son original effacé ; publiée, la demande est enregistrée.
export async function retirerPhoto(deps: DependancesCommunaute, entree: unknown): Promise<ResultatPhoto<{ resultat: "retiree" | "demande" }>> {
  const lu = z.object({ id: z.uuid() }).safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "introuvable" };
  try {
    const compte = await deps.compte();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    const r = await deps.retirer(compte.auteur, lu.data.id);
    if ("erreur" in r) {
      if (r.erreur.includes("KS_PHOTO_INTROUVABLE")) return { ok: false, erreur: "introuvable" };
      journaliser("retrait de la photo");
      return { ok: false, erreur: "generique" };
    }
    if (r.resultat === "retiree") {
      // La base a retiré la photo : l'effacement du fichier suit ; un échec est journalisé (la photo n'est plus jamais servie).
      try {
        const { erreur } = await deps.supprimerObjet(r.objet);
        if (erreur) journaliser("effacement du fichier retiré");
      } catch {
        journaliser("effacement du fichier retiré");
      }
    }
    return { ok: true, resultat: r.resultat === "demande" ? "demande" : "retiree" };
  } catch {
    journaliser("retrait de la photo");
    return { ok: false, erreur: "generique" };
  }
}
