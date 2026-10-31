import type { AuteurCompte } from "@/lib/auth/auteur";
import { creerVideoBunny, deposerSousTitresBunny, estIdVideo, lireVideoBunny, signerEnvoiBunny, supprimerSousTitresBunny, supprimerVideoBunny } from "@/lib/bunny/api";
import { BunnyNonConfigureError, type ConfigBunny } from "@/lib/bunny/config";
import { idSchema } from "./schemas";
import { lireAnnonceSousTitres, lireInstant, objetSousTitresValide, verifierWebVtt } from "./sous-titres";
import { EXTRAIT_KIT_TAILLE_MAX, LANGUES_SOUS_TITRES, SOUS_TITRES_EXTRAIT_TAILLE_MAX, SOUS_TITRES_TAILLE_MAX, TYPES_VIDEO_KIT, VIDEO_KIT_TAILLE_MAX } from "./types";
import type {
  ChampChapitre,
  CodeErreurCatalogue,
  DependancesMediasKit,
  EnvoiVideoKit,
  EtatVideoKit,
  GenreVideoKit,
  LangueSousTitres,
  ResultatMediasKit,
} from "./types";

// Vidéo, chapitres et sous-titres d'un Kit (story 3.2). Même cadre que le reste du catalogue : droit « produits.modifier » revérifié à chaque
// action ; « ok » n'est rendu qu'après la réponse réelle de la base, de Bunny ou du stockage (règle 13) ; seule la cause (code KS_) est
// journalisée, jamais une clé, une valeur saisie ni un identifiant. Les identifiants Bunny privés ne sont jamais renvoyés au navigateur,
// sauf celui de la vidéo en cours d'envoi, indispensable à l'envoi TUS.

function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[kit] ${contexte} : ${code}`);
}

async function verifierDroit(deps: DependancesMediasKit): Promise<{ auteur: AuteurCompte } | { erreur: CodeErreurCatalogue }> {
  try {
    return { auteur: (await deps.exigerDroit("produits.modifier")).auteur };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    journaliser("droit", code);
    return { erreur: code === "KS_VERIFICATION_IMPOSSIBLE" ? "generique" : "non_autorise" };
  }
}

const ERREURS_BASE: ReadonlyArray<readonly [string, CodeErreurCatalogue, ChampChapitre | undefined]> = [
  ["KS_PRODUIT_INTROUVABLE", "produit_introuvable", undefined],
  ["KS_FAMILLE_INVALIDE", "famille_invalide", undefined],
  ["KS_VIDEO_ABSENTE", "video_absente", undefined],
  ["KS_VIDEO_INVALIDE", "video_introuvable", undefined],
  ["KS_DUREE_INVALIDE", "duree_invalide", undefined],
  ["KS_CHAPITRES_HORS_DUREE", "chapitres_hors_duree", undefined],
  ["KS_CHAPITRE_INVALIDE", "chapitre_invalide", "debut"],
  ["KS_CHAPITRE_DEBUT_PRIS", "chapitre_debut_pris", "debut"],
  ["KS_CHAPITRES_LIMITE", "chapitres_limite", undefined],
  ["KS_CHAPITRE_INTROUVABLE", "chapitre_introuvable", undefined],
  ["KS_TITRE_INVALIDE", "titre_invalide", undefined],
  ["KS_LANGUE_INVALIDE", "langue_invalide", undefined],
  ["KS_TAILLE_FICHIER_INVALIDE", "fichier_trop_lourd", undefined],
  ["KS_CHEMIN_INVALIDE", "fichier_deja_enregistre", undefined],
  ["KS_SOUS_TITRES_INTROUVABLES", "sous_titres_introuvables", undefined],
  ["KS_EXTRAIT_ABSENT", "extrait_absent", undefined],
  ["KS_VALEUR_INVALIDE", "generique", undefined],
  ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete", undefined],
  ["KS_DROIT_REFUSE", "non_autorise", undefined],
  ["KS_AUTEUR_MANQUANT", "non_autorise", undefined],
];

function erreurBase(erreur: string): { erreur: CodeErreurCatalogue; champ?: ChampChapitre } {
  const connue = ERREURS_BASE.find(([code]) => erreur.includes(code));
  if (!connue) return { erreur: "generique" };
  return connue[2] ? { erreur: connue[1], champ: connue[2] } : { erreur: connue[1] };
}

// Refus connu de la base (code KS_) : rien n'a été écrit.
const refusConnu = (erreur: string) => ERREURS_BASE.some(([code]) => erreur.includes(code));

async function invalider(deps: DependancesMediasKit) {
  try {
    await deps.invaliderCatalogue();
  } catch (e) {
    journaliser("invalidation du cache", e);
  }
}

// Identifiant du Kit (minuscules) et famille lue en base.
async function lireKit(deps: DependancesMediasKit, produitId: string): Promise<{ id: string } | { erreur: CodeErreurCatalogue }> {
  const id = idSchema.safeParse(produitId.toLowerCase());
  if (!id.success) return { erreur: "produit_introuvable" };
  const famille = await deps.lireFamilleProduit(id.data);
  if (!famille) return { erreur: "produit_introuvable" };
  if (famille !== "kit") return { erreur: "famille_invalide" };
  return { id: id.data };
}

// ---- Vidéo complète (bibliothèque privée) et extrait (bibliothèque publique) ----

// Titre donné chez Bunny : jamais un nom de franchise, seulement l'identifiant du Kit. Le serveur n'efface ni n'enregistre jamais une vidéo
// dont le titre n'est pas exactement celui-là.
export function titreVideoKit(genre: GenreVideoKit, produitId: string): string {
  return genre === "complete" ? `KIT_${produitId}` : `KIT_EXTRAIT_${produitId}`;
}

function lireConfig(deps: DependancesMediasKit, genre: GenreVideoKit): ConfigBunny | CodeErreurCatalogue {
  try {
    return genre === "complete" ? deps.configBunnyPrive() : deps.configBunnyPublic();
  } catch (e) {
    journaliser("configuration Bunny", e);
    return e instanceof BunnyNonConfigureError ? "bunny_non_configure" : "generique";
  }
}

// N'efface chez Bunny qu'une vidéo créée pour ce Kit et ce genre (titre exact). Ne fait jamais échouer l'appelant.
async function effacerVideo(deps: DependancesMediasKit, config: ConfigBunny, genre: GenreVideoKit, produitId: string, videoId: string) {
  try {
    const video = await lireVideoBunny(config, videoId, deps.reseau);
    if (!video) return;
    if (video.titre !== titreVideoKit(genre, produitId)) {
      journaliser("effacement refusé", "KS_VIDEO_ETRANGERE");
      return;
    }
    await supprimerVideoBunny(config, videoId, deps.reseau);
  } catch (e) {
    journaliser("effacement chez Bunny", e);
  }
}

const estGenre = (g: unknown): g is GenreVideoKit => g === "complete" || g === "extrait";

// Autorisation d'envoi : droit, Kit, type et taille vérifiés AVANT de créer la vidéo chez Bunny (par l'API, côté serveur) ; renvoie la
// signature TUS (jamais la clé). Un extrait demande une vidéo complète déjà prête.
export async function demanderEnvoiVideoKit(
  deps: DependancesMediasKit,
  entree: { produitId: string; genre: GenreVideoKit; type: string; taille: number },
): Promise<ResultatMediasKit<{ envoi: EnvoiVideoKit }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!estGenre(entree.genre)) return { ok: false, erreur: "generique" };
  if (!(TYPES_VIDEO_KIT as readonly string[]).includes(entree.type)) return { ok: false, erreur: "format_invalide" };
  if (!Number.isInteger(entree.taille) || entree.taille < 1) return { ok: false, erreur: "format_invalide" };
  if (entree.taille > (entree.genre === "complete" ? VIDEO_KIT_TAILLE_MAX : EXTRAIT_KIT_TAILLE_MAX)) return { ok: false, erreur: "fichier_trop_lourd" };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    if (entree.genre === "extrait" && !(await deps.lireVideoKit(kit.id))) return { ok: false, erreur: "video_absente" };
    const config = lireConfig(deps, entree.genre);
    if (typeof config === "string") return { ok: false, erreur: config };
    const titre = titreVideoKit(entree.genre, kit.id);
    let video;
    try {
      video = await creerVideoBunny(config, titre, deps.reseau);
    } catch (e) {
      journaliser("création chez Bunny", e);
      return { ok: false, erreur: "bunny_indisponible" };
    }
    return { ok: true, envoi: { ...signerEnvoiBunny(config, video.id, deps.maintenant()), titre } };
  } catch (e) {
    journaliser("envoi de vidéo", e);
    return { ok: false, erreur: "generique" };
  }
}

// État de la vidéo envoyée, lu chez Bunny. Encodage terminé : la vidéo est enregistrée en base (durée lue chez Bunny), puis la vidéo
// remplacée est effacée chez Bunny APRÈS la base (échec journalisé, non bloquant). Encodage en échec : rien n'est enregistré, la vidéo
// est effacée chez Bunny. Jamais d'enregistrement sans l'état « terminé » lu à l'API de Bunny (règle 13).
export async function verifierVideoKit(
  deps: DependancesMediasKit,
  entree: { produitId: string; genre: GenreVideoKit; videoId: string },
): Promise<ResultatMediasKit<{ video: EtatVideoKit }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!estGenre(entree.genre)) return { ok: false, erreur: "generique" };
  const videoId = entree.videoId.toLowerCase();
  if (!estIdVideo(videoId)) return { ok: false, erreur: "video_introuvable" };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    const config = lireConfig(deps, entree.genre);
    if (typeof config === "string") return { ok: false, erreur: config };

    // Déjà enregistrée (double vérification) : prête.
    const enregistree = await deps.lireVideoKit(kit.id);
    const courante = entree.genre === "complete" ? enregistree?.bunnyIdPrive : enregistree?.extraitId;
    if (courante === videoId) return { ok: true, video: { etat: "prete" } };

    let video;
    try {
      video = await lireVideoBunny(config, videoId, deps.reseau);
    } catch (e) {
      journaliser("lecture chez Bunny", e);
      return { ok: false, erreur: "bunny_indisponible" };
    }
    if (!video || video.titre !== titreVideoKit(entree.genre, kit.id)) return { ok: false, erreur: "video_introuvable" };
    if (video.etat === "echec") {
      await effacerVideo(deps, config, entree.genre, kit.id, videoId);
      return { ok: false, erreur: "video_echec" };
    }
    if (video.etat !== "termine") return { ok: true, video: { etat: "en_cours", progression: Math.max(0, Math.min(100, Math.round(video.progression))) } };
    // Durée inconnue chez Bunny : rien n'est enregistré, la vidéo est gardée (une nouvelle vérification peut aboutir).
    if (video.duree < 1) return { ok: false, erreur: "duree_invalide" };

    const ecrit =
      entree.genre === "complete"
        ? await deps.ecrireVideoKit({ auteur: droit.auteur, produitId: kit.id, bunnyId: videoId, duree: video.duree })
        : await deps.ecrireExtraitKit({ auteur: droit.auteur, produitId: kit.id, extraitId: videoId });
    if (ecrit.erreur) {
      journaliser("vidéo refusée", ecrit.erreur);
      // Refus connu : rien n'est enregistré, la vidéo envoyée est effacée chez Bunny. Erreur inconnue : gardée (résultat incertain).
      if (refusConnu(ecrit.erreur)) await effacerVideo(deps, config, entree.genre, kit.id, videoId);
      return { ok: false, ...erreurBase(ecrit.erreur) };
    }
    if (ecrit.ancien && ecrit.ancien !== videoId) await effacerVideo(deps, config, entree.genre, kit.id, ecrit.ancien);
    await invalider(deps);
    return { ok: true, video: { etat: "prete" } };
  } catch (e) {
    journaliser("vérification de la vidéo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Envoi annulé ou abandonné : efface chez Bunny la vidéo créée pour l'envoi, jamais la vidéo enregistrée du Kit.
export async function annulerEnvoiVideoKit(
  deps: DependancesMediasKit,
  entree: { produitId: string; genre: GenreVideoKit; videoId: string },
): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!estGenre(entree.genre)) return { ok: false, erreur: "generique" };
  const videoId = entree.videoId.toLowerCase();
  if (!estIdVideo(videoId)) return { ok: false, erreur: "video_introuvable" };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    const config = lireConfig(deps, entree.genre);
    if (typeof config === "string") return { ok: false, erreur: config };
    const enregistree = await deps.lireVideoKit(kit.id);
    if (enregistree && (enregistree.bunnyIdPrive === videoId || enregistree.extraitId === videoId)) return { ok: false, erreur: "video_introuvable" };
    await effacerVideo(deps, config, entree.genre, kit.id, videoId);
    return { ok: true };
  } catch (e) {
    journaliser("annulation de la vidéo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Retire la vidéo complète (et son extrait) : la base d'abord, puis l'effacement chez Bunny (échec journalisé, non bloquant).
// Un Kit publié la garde (la base refuse : publication_incomplete).
export async function supprimerVideoKit(deps: DependancesMediasKit, entree: { produitId: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    const { erreur, prive, extrait } = await deps.supprimerVideoKit({ auteur: droit.auteur, produitId: kit.id });
    if (erreur) {
      journaliser("retrait de la vidéo refusé", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    for (const [genre, id] of [["complete", prive], ["extrait", extrait]] as const) {
      if (!id) continue;
      const config = lireConfig(deps, genre);
      if (typeof config === "string") continue;
      await effacerVideo(deps, config, genre, kit.id, id);
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("retrait de la vidéo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Retire l'extrait public : la base d'abord, puis l'effacement chez Bunny.
export async function retirerExtraitKit(deps: DependancesMediasKit, entree: { produitId: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    const { erreur, ancien } = await deps.ecrireExtraitKit({ auteur: droit.auteur, produitId: kit.id, extraitId: null });
    if (erreur) {
      journaliser("retrait de l'extrait refusé", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    if (ancien) {
      const config = lireConfig(deps, "extrait");
      if (typeof config !== "string") await effacerVideo(deps, config, "extrait", kit.id, ancien);
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("retrait de l'extrait", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Chapitres ----

type EntreeChapitre = { titreFr: string; titreEn: string; debut: string };

// Titres de 1 à 120 caractères après rognage ; instant « mm:ss » ou « h:mm:ss ». La base revérifie (et contrôle la durée de la vidéo).
function lireChapitre(entree: EntreeChapitre): { ok: true; titreFr: string; titreEn: string; debut: number } | { ok: false; erreur: CodeErreurCatalogue; champ: ChampChapitre } {
  const titreFr = entree.titreFr.trim();
  const titreEn = entree.titreEn.trim();
  if (titreFr.length < 1 || titreFr.length > 120) return { ok: false, erreur: "titre_invalide", champ: "titre_fr" };
  if (titreEn.length < 1 || titreEn.length > 120) return { ok: false, erreur: "titre_invalide", champ: "titre_en" };
  const debut = lireInstant(entree.debut);
  if (debut === null) return { ok: false, erreur: "instant_invalide", champ: "debut" };
  return { ok: true, titreFr, titreEn, debut };
}

export async function ajouterChapitreKit(deps: DependancesMediasKit, entree: EntreeChapitre & { produitId: string }): Promise<ResultatMediasKit<{ id: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  const lu = lireChapitre(entree);
  if (!lu.ok) return lu;
  try {
    const { erreur, id: cree } = await deps.ajouterChapitre({ auteur: droit.auteur, produitId: id.data, titreFr: lu.titreFr, titreEn: lu.titreEn, debut: lu.debut });
    if (erreur || !cree) {
      journaliser("chapitre refusé", erreur ?? "");
      return { ok: false, ...(erreur ? erreurBase(erreur) : { erreur: "generique" as const }) };
    }
    await invalider(deps);
    return { ok: true, id: cree };
  } catch (e) {
    journaliser("chapitre", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function modifierChapitreKit(deps: DependancesMediasKit, entree: EntreeChapitre & { chapitreId: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const chapitre = idSchema.safeParse(entree.chapitreId);
  if (!chapitre.success) return { ok: false, erreur: "chapitre_introuvable" };
  const lu = lireChapitre(entree);
  if (!lu.ok) return lu;
  try {
    const { erreur } = await deps.modifierChapitre({ auteur: droit.auteur, chapitreId: chapitre.data, titreFr: lu.titreFr, titreEn: lu.titreEn, debut: lu.debut });
    if (erreur) {
      journaliser("modification du chapitre refusée", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("modification du chapitre", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function deplacerChapitreKit(deps: DependancesMediasKit, entree: { chapitreId: string; sens: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const chapitre = idSchema.safeParse(entree.chapitreId);
  if (!chapitre.success) return { ok: false, erreur: "chapitre_introuvable" };
  if (entree.sens !== "haut" && entree.sens !== "bas") return { ok: false, erreur: "generique" };
  try {
    const { erreur } = await deps.deplacerChapitre({ auteur: droit.auteur, chapitreId: chapitre.data, sens: entree.sens });
    if (erreur) {
      journaliser("déplacement du chapitre refusé", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("déplacement du chapitre", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function supprimerChapitreKit(deps: DependancesMediasKit, entree: { chapitreId: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const chapitre = idSchema.safeParse(entree.chapitreId);
  if (!chapitre.success) return { ok: false, erreur: "chapitre_introuvable" };
  try {
    const { erreur } = await deps.supprimerChapitre({ auteur: droit.auteur, chapitreId: chapitre.data });
    if (erreur) {
      journaliser("suppression du chapitre refusée", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("suppression du chapitre", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Sous-titres WebVTT (kits-private) ----

const estLangue = (l: unknown): l is LangueSousTitres => (LANGUES_SOUS_TITRES as readonly unknown[]).includes(l);

async function effacerObjet(deps: DependancesMediasKit, objet: string) {
  try {
    const { erreur } = await deps.supprimerObjetsKit([objet]);
    if (erreur) journaliser("nettoyage kits-private", erreur);
  } catch (e) {
    journaliser("nettoyage kits-private", e);
  }
}

// Autorisation d'envoi : droit, Kit, langue, extension .vtt et taille vérifiés AVANT de signer ; le serveur choisit l'objet de kits-private.
export async function demanderEnvoiSousTitres(
  deps: DependancesMediasKit,
  entree: { produitId: string; langue: string; nomFichier: string; taille: number },
): Promise<ResultatMediasKit<{ objet: string; jeton: string; contentType: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!estLangue(entree.langue)) return { ok: false, erreur: "langue_invalide" };
  const annonce = lireAnnonceSousTitres(entree.nomFichier, entree.taille);
  if (!annonce.ok) return { ok: false, erreur: annonce.erreur };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    const objet = `${kit.id}/sous-titres/${crypto.randomUUID()}.vtt`;
    const { erreur, jeton } = await deps.signerEnvoiSousTitres({ objet });
    if (erreur || !jeton) {
      journaliser("jeton d'envoi des sous-titres", erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton, contentType: "text/vtt" };
  } catch (e) {
    journaliser("envoi des sous-titres", e);
    return { ok: false, erreur: "generique" };
  }
}

// Finalisation : objet de ce Kit, jamais déjà enregistré ; taille réelle égale à l'annonce ; contenu WebVTT vérifié. Refus : l'objet est
// effacé. Accepté : l'objet est déplacé vers un chemin que seul le serveur connaît, puis enregistré ; l'ancien (remplacement, version + 1)
// n'est effacé qu'APRÈS la réponse de la base. Base muette (exception) : l'objet est gardé (un orphelin vaut mieux qu'un fichier cassé).
export async function finaliserSousTitres(
  deps: DependancesMediasKit,
  entree: { produitId: string; langue: string; objet: string; taille: number },
): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  if (!estLangue(entree.langue)) return { ok: false, erreur: "langue_invalide" };
  const langue = entree.langue;
  // Un objet qui n'appartient pas à ce Kit n'est ni lu ni effacé.
  if (!objetSousTitresValide(entree.objet, id.data)) return { ok: false, erreur: "format_invalide" };
  try {
    if (await deps.cheminSousTitresEnregistre(entree.objet)) return { ok: false, erreur: "fichier_deja_enregistre" };
  } catch (e) {
    journaliser("chemin déjà enregistré", e);
    return { ok: false, erreur: "generique" };
  }

  let aEffacer: string | null = entree.objet;
  try {
    if (!Number.isInteger(entree.taille) || entree.taille < 1) return { ok: false, erreur: "format_invalide" };
    if (entree.taille > SOUS_TITRES_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
    const lu = await deps.lireObjetKit({ objet: entree.objet, octets: entree.taille });
    if (lu.erreur) {
      journaliser("lecture des sous-titres", lu.erreur);
      aEffacer = null;
      return { ok: false, erreur: "generique" };
    }
    if (!lu.trouve) return { ok: false, erreur: "envoi_incomplet" };
    if (lu.taille > SOUS_TITRES_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
    if (lu.taille !== entree.taille || lu.debut.length !== lu.taille) return { ok: false, erreur: "envoi_incomplet" };
    if (!verifierWebVtt(lu.debut)) return { ok: false, erreur: "format_invalide" };

    const nouveau = `${id.data}/sous-titres/${crypto.randomUUID()}.vtt`;
    const deplace = await deps.deplacerObjetKit({ de: entree.objet, vers: nouveau });
    if (deplace.erreur) {
      journaliser("déplacement des sous-titres", deplace.erreur);
      return { ok: false, erreur: "generique" };
    }
    aEffacer = nouveau;

    let conserver = true;
    try {
      const { erreur, ancienChemin } = await deps.ecrireSousTitres({ auteur: droit.auteur, produitId: id.data, langue, taille: lu.taille, chemin: nouveau });
      if (erreur) {
        journaliser("sous-titres refusés", erreur);
        // Refus connu (code KS_) : rien n'est écrit, l'objet est effacé. Autre erreur (réseau, délai) : la base a pu valider, il est gardé.
        conserver = !refusConnu(erreur);
        return { ok: false, ...erreurBase(erreur) };
      }
      if (ancienChemin && ancienChemin !== nouveau) await effacerObjet(deps, ancienChemin);
      await invalider(deps);
      return { ok: true };
    } finally {
      if (conserver) aEffacer = null;
    }
  } catch (e) {
    journaliser("sous-titres", e);
    return { ok: false, erreur: "generique" };
  } finally {
    if (aEffacer) await effacerObjet(deps, aEffacer);
  }
}

// Annulation d'un envoi : efface l'objet de ce Kit, jamais un objet déjà enregistré.
export async function annulerEnvoiSousTitres(deps: DependancesMediasKit, entree: { produitId: string; objet: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success || !objetSousTitresValide(entree.objet, id.data)) return { ok: false, erreur: "produit_introuvable" };
  try {
    if (await deps.cheminSousTitresEnregistre(entree.objet)) return { ok: false, erreur: "fichier_deja_enregistre" };
  } catch (e) {
    journaliser("chemin déjà enregistré", e);
    return { ok: false, erreur: "generique" };
  }
  await effacerObjet(deps, entree.objet);
  return { ok: true };
}

// Supprime les sous-titres d'une langue : la base d'abord, puis l'objet. Les sous-titres français d'un Kit publié restent (la base refuse).
export async function supprimerSousTitres(deps: DependancesMediasKit, entree: { produitId: string; langue: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  if (!estLangue(entree.langue)) return { ok: false, erreur: "langue_invalide" };
  try {
    const { erreur, chemin } = await deps.supprimerSousTitres({ auteur: droit.auteur, produitId: id.data, langue: entree.langue });
    if (erreur) {
      journaliser("suppression des sous-titres refusée", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    if (chemin) await effacerObjet(deps, chemin);
    else journaliser("suppression des sous-titres : chemin non renvoyé", "");
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("suppression des sous-titres", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Sous-titres de l'extrait public (story 3.3, décision de Jonathan du 2026-10-31) ----
// Le fichier .vtt (512 Ko au plus) arrive au serveur par une Server Action, est vérifié (verifierWebVtt), puis déposé dans les sous-titres de
// la vidéo d'extrait chez Bunny (bibliothèque publique) ; la langue n'est enregistrée en base qu'APRÈS la réponse réelle de Bunny (règle 13).

// Extrait enregistré du Kit (identifiant de la bibliothèque publique) ou le code d'erreur.
async function lireExtrait(deps: DependancesMediasKit, produitId: string): Promise<{ id: string; extraitId: string } | { erreur: CodeErreurCatalogue }> {
  const kit = await lireKit(deps, produitId);
  if ("erreur" in kit) return kit;
  const video = await deps.lireVideoKit(kit.id);
  if (!video) return { erreur: "video_absente" };
  if (!video.extraitId) return { erreur: "extrait_absent" };
  return { id: kit.id, extraitId: video.extraitId };
}

export async function deposerSousTitresExtrait(
  deps: DependancesMediasKit,
  entree: { produitId: string; langue: string; nomFichier: string; octets: Uint8Array },
): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!estLangue(entree.langue)) return { ok: false, erreur: "langue_invalide" };
  const langue = entree.langue;
  if (!/[.]vtt$/i.test(entree.nomFichier.trim()) || entree.octets.length < 1) return { ok: false, erreur: "format_invalide" };
  if (entree.octets.length > SOUS_TITRES_EXTRAIT_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  // Contenu vérifié AVANT tout appel à Bunny : un fichier invalide n'y est jamais déposé.
  if (!verifierWebVtt(entree.octets)) return { ok: false, erreur: "format_invalide" };
  try {
    const extrait = await lireExtrait(deps, entree.produitId);
    if ("erreur" in extrait) return { ok: false, erreur: extrait.erreur };
    const config = lireConfig(deps, "extrait");
    if (typeof config === "string") return { ok: false, erreur: config };
    try {
      await deposerSousTitresBunny(config, extrait.extraitId, langue, langue, entree.octets, deps.reseau);
    } catch (e) {
      journaliser("dépôt des sous-titres de l'extrait chez Bunny", e);
      return { ok: false, erreur: "bunny_indisponible" };
    }
    const { erreur } = await deps.ecrireSousTitresExtrait({ auteur: droit.auteur, produitId: extrait.id, langue });
    if (erreur) {
      journaliser("sous-titres de l'extrait refusés", erreur);
      // Rien n'est enregistré en base : le fichier déposé chez Bunny (public) est retiré ; un échec n'est que journalisé.
      try {
        await supprimerSousTitresBunny(config, extrait.extraitId, langue, deps.reseau);
      } catch (e) {
        journaliser("retrait des sous-titres de l'extrait chez Bunny", e);
      }
      return { ok: false, ...erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("sous-titres de l'extrait", e);
    return { ok: false, erreur: "generique" };
  }
}

// Supprime les sous-titres d'une langue de l'extrait : la base d'abord (elle refuse le français de l'extrait parlé d'un Kit publié), puis
// l'effacement chez Bunny (échec journalisé, non bloquant : la page ne propose plus que les langues enregistrées).
export async function supprimerSousTitresExtrait(deps: DependancesMediasKit, entree: { produitId: string; langue: string }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (!estLangue(entree.langue)) return { ok: false, erreur: "langue_invalide" };
  const langue = entree.langue;
  try {
    const extrait = await lireExtrait(deps, entree.produitId);
    if ("erreur" in extrait) return { ok: false, erreur: extrait.erreur };
    const { erreur } = await deps.supprimerSousTitresExtrait({ auteur: droit.auteur, produitId: extrait.id, langue });
    if (erreur) {
      journaliser("suppression des sous-titres de l'extrait refusée", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    const config = lireConfig(deps, "extrait");
    if (typeof config !== "string") {
      try {
        await supprimerSousTitresBunny(config, extrait.extraitId, langue, deps.reseau);
      } catch (e) {
        journaliser("effacement des sous-titres de l'extrait chez Bunny", e);
      }
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("suppression des sous-titres de l'extrait", e);
    return { ok: false, erreur: "generique" };
  }
}

// Case « Extrait sans parole » : cochée, aucun sous-titre d'extrait n'est exigé pour publier.
export async function definirExtraitSansParole(deps: DependancesMediasKit, entree: { produitId: string; valeur: boolean }): Promise<ResultatMediasKit> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  if (typeof entree.valeur !== "boolean") return { ok: false, erreur: "generique" };
  try {
    const kit = await lireKit(deps, entree.produitId);
    if ("erreur" in kit) return { ok: false, erreur: kit.erreur };
    const { erreur } = await deps.definirExtraitSansParole({ auteur: droit.auteur, produitId: kit.id, valeur: entree.valeur });
    if (erreur) {
      journaliser("case sans parole refusée", erreur);
      return { ok: false, ...erreurBase(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("case sans parole", e);
    return { ok: false, erreur: "generique" };
  }
}
