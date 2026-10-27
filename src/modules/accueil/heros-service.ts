import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";
import {
  PREFIXE_TITRE_HEROS,
  choisirFichierMp4,
  creerVideoBunny,
  estIdVideo,
  lireVideoBunny,
  signerEnvoiBunny,
  supprimerVideoBunny,
} from "@/lib/bunny/api";
import { BunnyNonConfigureError, type ConfigBunnyPublic } from "@/lib/bunny/config";
import { nettoyerPhoto } from "@/modules/catalogue/photo";
import { idSchema, lireAlt, lireFichierAnnonce, objetAttenteValide } from "@/modules/catalogue/schemas";
import { PHOTO_TAILLE_MAX } from "@/modules/catalogue/types";
import { analyserPistesMp4 } from "./heros-mp4";
import { TYPES_VIDEO_HEROS, VIDEO_HEROS_TAILLE_MAX } from "./heros-types";
import type { CodeErreurHeros, DependancesHeros, EnvoiVideoAutorise, EtatVideo, ResultatHeros } from "./heros-types";

// Réglages de l'accueil : même cadre que le catalogue. Le droit est revérifié ici ; « ok » n'est rendu qu'après la réponse réelle de la base,
// de Bunny ou du stockage (règle 13) ; seule la cause (code KS_) est journalisée, jamais une clé, une valeur saisie ni un identifiant de Compte.
const DROIT: Droit = "reglages.modifier";
// Dossier des objets du héros dans galerie-attente et dans produits-public.
export const DOSSIER_HEROS = "heros";

function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[heros] ${contexte} : ${code}`);
}

async function verifierDroit(deps: DependancesHeros): Promise<{ auteur: AuteurCompte } | { erreur: CodeErreurHeros }> {
  try {
    return { auteur: (await deps.exigerDroit(DROIT)).auteur };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    journaliser("droit", code);
    return { erreur: code === "KS_VERIFICATION_IMPOSSIBLE" ? "generique" : "non_autorise" };
  }
}

function lireConfig(deps: DependancesHeros): ConfigBunnyPublic | CodeErreurHeros {
  try {
    return deps.configBunny();
  } catch (e) {
    journaliser("configuration Bunny", e);
    return e instanceof BunnyNonConfigureError ? "bunny_non_configure" : "generique";
  }
}

const ERREURS_BASE: ReadonlyArray<readonly [string, CodeErreurHeros]> = [
  ["KS_VEDETTE_INVALIDE", "vedette_invalide"],
  ["KS_ALT_INVALIDE", "alt_invalide"],
  ["KS_PHOTO_INTROUVABLE", "photo_introuvable"],
  ["KS_VIDEO_INTROUVABLE", "video_introuvable"],
  ["KS_FICHIER_INVALIDE", "format_invalide"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

function erreurBase(erreur: string): CodeErreurHeros {
  return ERREURS_BASE.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

async function invalider(deps: DependancesHeros) {
  try {
    await deps.invalider();
  } catch (e) {
    journaliser("invalidation du cache", e);
  }
}

async function effacerObjet(deps: DependancesHeros, bucket: "galerie-attente" | "produits-public", objet: string) {
  try {
    const { erreur } = await deps.supprimerObjets({ bucket, objets: [objet] });
    if (erreur) journaliser(`nettoyage ${bucket}`, erreur);
  } catch (e) {
    journaliser(`nettoyage ${bucket}`, e);
  }
}

// N'efface chez Bunny qu'une vidéo créée pour le héros (titre à préfixe) : jamais une autre vidéo de la bibliothèque. Ne fait jamais échouer l'appelant.
async function effacerVideo(deps: DependancesHeros, config: ConfigBunnyPublic, videoId: string) {
  try {
    const video = await lireVideoBunny(config, videoId, deps.reseau);
    if (!video) return;
    if (!video.titre.startsWith(PREFIXE_TITRE_HEROS)) {
      journaliser("effacement refusé", "KS_VIDEO_ETRANGERE");
      return;
    }
    await supprimerVideoBunny(config, videoId, deps.reseau);
  } catch (e) {
    journaliser("effacement chez Bunny", e);
  }
}

// ---- Cosplay vedette ----

export async function choisirVedette(deps: DependancesHeros, entree: { produitId: string | null }): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  let produitId: string | null = null;
  if (entree.produitId !== null) {
    const id = idSchema.safeParse(entree.produitId.toLowerCase());
    if (!id.success) return { ok: false, erreur: "vedette_invalide" };
    produitId = id.data;
  }
  try {
    const { erreur } = await deps.ecrireVedette({ auteur: droit.auteur, produitId });
    if (erreur) {
      journaliser("vedette refusée", erreur);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("vedette", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Vidéo (bibliothèque Bunny publique) ----

// Autorisation d'envoi : droit, type et taille vérifiés AVANT de créer la vidéo chez Bunny. Le serveur crée la vidéo et signe l'autorisation ;
// le navigateur n'envoie que ce que la signature autorise, et ne reçoit jamais la clé.
export async function demanderEnvoiVideo(deps: DependancesHeros, entree: { type: string; taille: number }): Promise<ResultatHeros<{ envoi: EnvoiVideoAutorise }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!(TYPES_VIDEO_HEROS as readonly string[]).includes(entree.type)) return { ok: false, erreur: "type_invalide" };
  if (!Number.isInteger(entree.taille) || entree.taille < 1) return { ok: false, erreur: "type_invalide" };
  if (entree.taille > VIDEO_HEROS_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  const config = lireConfig(deps);
  if (typeof config === "string") return { ok: false, erreur: config };
  try {
    const titre = `${PREFIXE_TITRE_HEROS}${crypto.randomUUID()}`;
    const video = await creerVideoBunny(config, titre, deps.reseau);
    const autorisation = signerEnvoiBunny(config, video.id, deps.maintenant());
    return { ok: true, envoi: { ...autorisation, titre } };
  } catch (e) {
    journaliser("création chez Bunny", e);
    return { ok: false, erreur: "bunny_indisponible" };
  }
}

// Fin de l'envoi : la vidéo existe chez Bunny (et a été créée pour le héros) ; elle devient la vidéo du héros, à vérifier (le MP4 reste nul).
// L'ancienne vidéo est effacée chez Bunny APRÈS l'enregistrement.
export async function finaliserVideo(deps: DependancesHeros, entree: { videoId: string }): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const videoId = entree.videoId.toLowerCase();
  if (!estIdVideo(videoId)) return { ok: false, erreur: "video_introuvable" };
  const config = lireConfig(deps);
  if (typeof config === "string") return { ok: false, erreur: config };
  try {
    const video = await lireVideoBunny(config, videoId, deps.reseau);
    if (!video || !video.titre.startsWith(PREFIXE_TITRE_HEROS)) return { ok: false, erreur: "video_introuvable" };
    const { erreur, ancien } = await deps.ecrireVideo({ auteur: droit.auteur, videoId });
    if (erreur) {
      journaliser("vidéo refusée", erreur);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    if (ancien) await effacerVideo(deps, config, ancien);
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("vidéo", e);
    return { ok: false, erreur: "bunny_indisponible" };
  }
}

// Envoi annulé ou abandonné : efface la vidéo créée pour l'envoi, sauf si c'est la vidéo actuelle du héros.
export async function annulerEnvoiVideo(deps: DependancesHeros, entree: { videoId: string }): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const videoId = entree.videoId.toLowerCase();
  if (!estIdVideo(videoId)) return { ok: false, erreur: "video_introuvable" };
  const config = lireConfig(deps);
  if (typeof config === "string") return { ok: false, erreur: config };
  try {
    const heros = await deps.lireHeros();
    if (heros.videoId === videoId) return { ok: false, erreur: "video_introuvable" };
    await effacerVideo(deps, config, videoId);
    return { ok: true };
  } catch (e) {
    journaliser("annulation de la vidéo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Retire la vidéo du héros (et l'efface chez Bunny) : le héros montre alors la photo de repli.
export async function supprimerVideo(deps: DependancesHeros): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const config = lireConfig(deps);
  if (typeof config === "string") return { ok: false, erreur: config };
  try {
    const { erreur, ancien } = await deps.ecrireVideo({ auteur: droit.auteur, videoId: null });
    if (erreur) {
      journaliser("retrait de la vidéo", erreur);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    if (ancien) await effacerVideo(deps, config, ancien);
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("retrait de la vidéo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Vérification de la vidéo enregistrée : l'encodage doit être terminé chez Bunny (état lu à son API), le fichier MP4 doit être lisible depuis le CDN
// public et ne contenir AUCUNE piste audio (FR-1). Seulement alors le fichier est validé : tant qu'il ne l'est pas, l'accueil montre la photo.
export async function verifierVideo(deps: DependancesHeros): Promise<ResultatHeros<{ video: EtatVideo }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const config = lireConfig(deps);
  if (typeof config === "string") return { ok: false, erreur: config };
  try {
    const heros = await deps.lireHeros();
    if (!heros.videoId) return { ok: false, erreur: "video_introuvable" };
    if (heros.videoFichier) return { ok: true, video: { etat: "prete" } };

    const video = await lireVideoBunny(config, heros.videoId, deps.reseau);
    if (!video || !video.titre.startsWith(PREFIXE_TITRE_HEROS)) return { ok: false, erreur: "video_introuvable" };
    if (video.etat === "echec") return { ok: false, erreur: "encodage_echec" };
    if (video.etat !== "termine") return { ok: true, video: { etat: "en_cours", progression: Math.max(0, Math.min(100, Math.round(video.progression))) } };

    const fichier = choisirFichierMp4(video.resolutions);
    if (!fichier) return { ok: false, erreur: "video_illisible" };
    const lecteur = await deps.ouvrirLecteurMp4(`https://${config.hoteCdn}/${heros.videoId}/${fichier}`);
    if (!lecteur) return { ok: false, erreur: "mp4_indisponible" };
    const pistes = await analyserPistesMp4(lecteur);
    if (!pistes || !pistes.video) return { ok: false, erreur: "video_illisible" };
    if (pistes.audio) return { ok: false, erreur: "video_avec_audio" };

    const { erreur } = await deps.validerVideo({ auteur: droit.auteur, videoId: heros.videoId, fichier });
    if (erreur) {
      journaliser("validation de la vidéo", erreur);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true, video: { etat: "prete" } };
  } catch (e) {
    journaliser("vérification de la vidéo", e);
    return { ok: false, erreur: "bunny_indisponible" };
  }
}

// ---- Photo de repli (même passage que les photos de produit : original en attente, sharp, copie propre dans produits-public) ----

export async function demanderEnvoiRepli(
  deps: DependancesHeros,
  entree: { type: string; taille: number; altFr: string; altEn: string },
): Promise<ResultatHeros<{ objet: string; jeton: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const fichier = lireFichierAnnonce(entree.type, entree.taille);
  if (!fichier.ok) return { ok: false, erreur: fichier.erreur };
  if (!lireAlt(entree.altFr, entree.altEn).ok) return { ok: false, erreur: "alt_invalide" };
  try {
    const objet = `${DOSSIER_HEROS}/${crypto.randomUUID()}.${fichier.ext}`;
    const { erreur, jeton } = await deps.signerEnvoiPhoto({ objet });
    if (erreur || !jeton) {
      journaliser("jeton d'envoi", erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton };
  } catch (e) {
    journaliser("envoi de la photo de repli", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function finaliserRepli(deps: DependancesHeros, entree: { objet: string; altFr: string; altEn: string }): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  // Un objet qui n'est pas du dossier du héros n'est ni lu ni effacé.
  if (!objetAttenteValide(entree.objet, DOSSIER_HEROS)) return { ok: false, erreur: "format_invalide" };

  let objetPublic: string | null = null;
  // Une fois ecrireRepli appelée, son résultat peut être inconnu (la ligne a pu être validée) : l'objet public n'est alors plus effacé.
  let repliAppele = false;
  try {
    const alt = lireAlt(entree.altFr, entree.altEn);
    if (!alt.ok) return { ok: false, erreur: "alt_invalide" };
    const lu = await deps.lireObjetAttente(entree.objet);
    if (lu.erreur || !lu.octets) {
      journaliser("lecture de l'original", lu.erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    if (lu.octets.byteLength > PHOTO_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
    const propre = await nettoyerPhoto(lu.octets);
    if (!propre.ok) return { ok: false, erreur: "format_invalide" };

    const nouveau = `${DOSSIER_HEROS}/${crypto.randomUUID()}.${propre.ext}`;
    objetPublic = nouveau;
    const ecrit = await deps.ecrireObjetPublic({ objet: nouveau, octets: propre.octets, contentType: propre.contentType });
    if (ecrit.erreur) {
      journaliser("écriture publique", ecrit.erreur);
      await effacerObjet(deps, "produits-public", nouveau);
      return { ok: false, erreur: "generique" };
    }
    repliAppele = true;
    const { erreur, ancien } = await deps.ecrireRepli({ auteur: droit.auteur, fichier: nouveau, altFr: alt.altFr, altEn: alt.altEn });
    if (erreur) {
      journaliser("photo de repli refusée", erreur);
      await effacerObjet(deps, "produits-public", nouveau);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    if (ancien) await effacerObjet(deps, "produits-public", ancien);
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("photo de repli", e);
    if (objetPublic && !repliAppele) await effacerObjet(deps, "produits-public", objetPublic);
    return { ok: false, erreur: "generique" };
  } finally {
    await effacerObjet(deps, "galerie-attente", entree.objet);
  }
}

export async function annulerEnvoiRepli(deps: DependancesHeros, entree: { objet: string }): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!objetAttenteValide(entree.objet, DOSSIER_HEROS)) return { ok: false, erreur: "format_invalide" };
  await effacerObjet(deps, "galerie-attente", entree.objet);
  return { ok: true };
}

// Corrige les deux textes alternatifs de la photo de repli, sans la renvoyer.
export async function modifierAltRepli(deps: DependancesHeros, entree: { altFr: string; altEn: string }): Promise<ResultatHeros> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const alt = lireAlt(entree.altFr, entree.altEn);
  if (!alt.ok) return { ok: false, erreur: "alt_invalide" };
  try {
    const { erreur } = await deps.ecrireRepli({ auteur: droit.auteur, fichier: null, altFr: alt.altFr, altEn: alt.altEn });
    if (erreur) {
      journaliser("textes alternatifs refusés", erreur);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("textes alternatifs du repli", e);
    return { ok: false, erreur: "generique" };
  }
}
