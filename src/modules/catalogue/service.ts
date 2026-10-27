import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";
import { estFormatFichierKit, lireAnnonceFichierKit, objetKitDuProduit, objetKitValide, analyserContenuKit, EXTENSION_FORMAT, octetsAVerifier, tailleMaxFormat, TYPE_CONTENU_EXTENSION } from "./fichiers-kit";
import type { FormatFichierKit } from "./fichiers-kit";
import { nettoyerPhoto } from "./photo";
import { manquesPublication } from "./publication";
import { lireTranches } from "./tranches";
import { idSchema, lireAlt, lireFichierAnnonce, lireKit, lireProduit, lireUnivers, objetAttenteValide } from "./schemas";
import { PHOTOS_MAX, PHOTO_TAILLE_MAX } from "./types";
import type { ChampProduit, CodeErreurCatalogue, DependancesCatalogue, EntreeKit, EntreeProduit, EntreeTranche, EntreeUnivers, ResultatCatalogue } from "./types";

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie ni un identifiant de Compte.
function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[catalogue] ${contexte} : ${code}`);
}

async function verifierDroit(deps: DependancesCatalogue, droit: Droit = "produits.modifier"): Promise<{ auteur: AuteurCompte } | { erreur: CodeErreurCatalogue }> {
  try {
    return { auteur: (await deps.exigerDroit(droit)).auteur };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    journaliser("droit", code);
    return { erreur: code === "KS_VERIFICATION_IMPOSSIBLE" ? "generique" : "non_autorise" };
  }
}

// Erreur de la base d'un produit : code d'interface et champ concerné, sans donnée saisie.
const ERREURS_PRODUIT: ReadonlyArray<readonly [string, CodeErreurCatalogue, ChampProduit | undefined]> = [
  ["KS_FAMILLE_INVALIDE", "famille_invalide", "famille"],
  ["KS_TITRE_INVALIDE", "titre_invalide", "titre_fr"],
  ["KS_SLUG_INVALIDE", "slug_invalide", "slug"],
  ["KS_PRIX_INVALIDE", "prix_invalide", "prix"],
  ["KS_DELAI_INVALIDE", "delai_invalide", "delai"],
  ["KS_TEXTE_INVALIDE", "texte_invalide", "description_fr"],
  ["KS_UNIVERS_INTROUVABLE", "univers_invalide", "univers"],
  ["KS_TAILLE_INVALIDE", "taille_invalide", "variantes"],
  ["KS_STOCK_INVALIDE", "stock_invalide", "variantes"],
  ["KS_DELAI_MANQUANT", "delai_manquant", "variantes"],
  ["KS_NIVEAU_INVALIDE", "niveau_invalide", "niveau"],
  ["KS_KIT_LIE_INVALIDE", "kit_lie_invalide", "kit_lie"],
  ["KS_PRODUIT_INTROUVABLE", "produit_introuvable", undefined],
  ["KS_PRODUIT_PUBLIE_VERROUILLE", "produit_publie_verrouille", undefined],
  ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete", undefined],
  ["KS_DROIT_REFUSE", "non_autorise", undefined],
  ["KS_AUTEUR_MANQUANT", "non_autorise", undefined],
];

// Crée un univers (création seulement) : droit, validation, écriture ; « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13).
export async function creerUnivers(deps: DependancesCatalogue, entree: EntreeUnivers): Promise<ResultatCatalogue<{ id: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = lireUnivers(entree);
  if (!lu.ok) return { ok: false, erreur: "nom_invalide", champ: lu.champ };

  try {
    const { erreur, id } = await deps.ecrireUnivers({ auteur: droit.auteur, nomFr: lu.nomFr, nomEn: lu.nomEn });
    if (erreur) {
      journaliser("univers refusé", erreur);
      if (erreur.includes("KS_UNIVERS_EXISTE")) return { ok: false, erreur: "univers_existe" };
      if (erreur.includes("KS_UNIVERS_INVALIDE")) return { ok: false, erreur: "nom_invalide" };
      if (erreur.includes("KS_DROIT_REFUSE") || erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    if (!id) return { ok: false, erreur: "generique" };
    // La liste des univers du catalogue public est en cache : elle est vidée après la réponse réelle de la base.
    await invalider(deps);
    return { ok: true, id };
  } catch (e) {
    journaliser("univers", e);
    return { ok: false, erreur: "generique" };
  }
}

// Crée (id vide) ou modifie un brouillon de produit physique avec ses variantes : droit, validation, une seule écriture atomique.
// Jamais de publication ici (story 2.2). Adresse déjà prise : erreur sur le champ avec la première adresse libre.
export async function enregistrerProduit(deps: DependancesCatalogue, entree: EntreeProduit): Promise<ResultatCatalogue<{ id: string; cree: boolean }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = lireProduit(entree);
  if (!lu.ok) return lu;

  try {
    const { erreur, id } = await deps.ecrireProduit({ auteur: droit.auteur, id: lu.id, produit: lu.produit, variantes: lu.variantes });
    if (erreur) {
      journaliser("produit refusé", erreur);
      if (erreur.includes("KS_SLUG_PRIS")) {
        let slugPropose: string | undefined;
        try {
          slugPropose = await deps.premierSlugLibre(lu.produit.slug, lu.id);
        } catch (e) {
          journaliser("adresse libre", e);
        }
        return { ok: false, erreur: "slug_pris", champ: "slug", slugPropose };
      }
      const connue = ERREURS_PRODUIT.find(([code]) => erreur.includes(code));
      if (connue) return { ok: false, erreur: connue[1], champ: connue[2] };
      return { ok: false, erreur: "generique" };
    }
    if (!id) return { ok: false, erreur: "generique" };
    await invalider(deps);
    return { ok: true, id, cree: lu.id === null };
  } catch (e) {
    journaliser("produit", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Photos et publication (story 2.2) ----

// Erreurs de la base propres aux photos et à la publication.
const ERREURS_PHOTO: ReadonlyArray<readonly [string, CodeErreurCatalogue]> = [
  ["KS_PRODUIT_INTROUVABLE", "produit_introuvable"],
  ["KS_PHOTO_INTROUVABLE", "photo_introuvable"],
  ["KS_PHOTOS_LIMITE", "photos_limite"],
  ["KS_FICHIER_INVALIDE", "format_invalide"],
  ["KS_ALT_INVALIDE", "alt_invalide"],
  ["KS_PRODUIT_PUBLIE_VERROUILLE", "produit_publie_verrouille"],
  ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

function erreurPhoto(erreur: string): CodeErreurCatalogue {
  return ERREURS_PHOTO.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

// Autorisation d'envoi : droit, produit, type, taille, texte alternatif et nombre de photos vérifiés AVANT de signer.
// Le serveur choisit le nom de l'objet ; le navigateur n'envoie que ce que le jeton autorise.
export async function demanderEnvoiPhoto(
  deps: DependancesCatalogue,
  entree: { produitId: string; type: string; taille: number; altFr: string; altEn: string },
): Promise<ResultatCatalogue<{ objet: string; jeton: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  // Identifiant en minuscules dès l'entrée : la base compare le dossier du fichier en minuscules.
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  const fichier = lireFichierAnnonce(entree.type, entree.taille);
  if (!fichier.ok) return { ok: false, erreur: fichier.erreur };
  if (!lireAlt(entree.altFr, entree.altEn).ok) return { ok: false, erreur: "alt_invalide" };

  try {
    const produit = await deps.lireProduitComplet(id.data);
    if (!produit) return { ok: false, erreur: "produit_introuvable" };
    if (produit.nbPhotos >= PHOTOS_MAX) return { ok: false, erreur: "photos_limite" };
    const objet = `${id.data}/${crypto.randomUUID()}.${fichier.ext}`;
    const { erreur, jeton } = await deps.signerEnvoiPhoto({ objet });
    if (erreur || !jeton) {
      journaliser("jeton d'envoi", erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton };
  } catch (e) {
    journaliser("envoi de photo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Efface un objet sans jamais faire échouer l'appelant : seule la cause est journalisée.
async function effacer(deps: DependancesCatalogue, bucket: "galerie-attente" | "produits-public" | "kits-private", objet: string) {
  try {
    const { erreur } = await deps.supprimerObjets({ bucket, objets: [objet] });
    if (erreur) journaliser(`nettoyage ${bucket}`, erreur);
  } catch (e) {
    journaliser(`nettoyage ${bucket}`, e);
  }
}

// Finalisation : relit l'original d'attente, vérifie son contenu réel, le ré-encode sans métadonnée, l'écrit dans le bucket public,
// enregistre la photo. Rien d'orphelin : l'objet public est effacé si l'enregistrement échoue, l'original d'attente l'est toujours.
export async function finaliserPhoto(
  deps: DependancesCatalogue,
  entree: { produitId: string; objet: string; altFr: string; altEn: string },
): Promise<ResultatCatalogue<{ id: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  // Un objet qui n'appartient pas à ce produit n'est ni lu ni effacé.
  if (!objetAttenteValide(entree.objet, id.data)) return { ok: false, erreur: "format_invalide" };

  let objetPublic: string | null = null;
  // Une fois ecrirePhoto appelée, son résultat peut être inconnu (la ligne a pu être validée) : l'objet public n'est alors plus effacé.
  let photoAppelee = false;
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

    const nouveau = `${id.data}/${crypto.randomUUID()}.${propre.ext}`;
    // Posé AVANT l'écriture : si l'appel lève, le nettoyage efface quand même ce qui a pu être écrit.
    objetPublic = nouveau;
    const ecrit = await deps.ecrireObjetPublic({ objet: nouveau, octets: propre.octets, contentType: propre.contentType });
    if (ecrit.erreur) {
      journaliser("écriture publique", ecrit.erreur);
      await effacer(deps, "produits-public", nouveau);
      return { ok: false, erreur: "generique" };
    }
    photoAppelee = true;

    const { erreur, id: photoId } = await deps.ecrirePhoto({ auteur: droit.auteur, produitId: id.data, fichier: nouveau, altFr: alt.altFr, altEn: alt.altEn });
    if (erreur || !photoId) {
      journaliser("photo refusée", erreur ?? "");
      await effacer(deps, "produits-public", nouveau);
      return { ok: false, erreur: erreur ? erreurPhoto(erreur) : "generique" };
    }
    await invalider(deps);
    return { ok: true, id: photoId };
  } catch (e) {
    journaliser("photo", e);
    // Échec connu seulement : si ecrirePhoto a levé, on préfère un orphelin à une photo cassée.
    if (objetPublic && !photoAppelee) await effacer(deps, "produits-public", objetPublic);
    return { ok: false, erreur: "generique" };
  } finally {
    await effacer(deps, "galerie-attente", entree.objet);
  }
}

// Annulation d'un envoi : efface l'objet d'attente de ce produit (le droit est revérifié).
export async function annulerEnvoiPhoto(deps: DependancesCatalogue, entree: { produitId: string; objet: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.produitId);
  if (!id.success || !objetAttenteValide(entree.objet, id.data)) return { ok: false, erreur: "produit_introuvable" };
  await effacer(deps, "galerie-attente", entree.objet);
  return { ok: true };
}

export async function deplacerPhoto(deps: DependancesCatalogue, entree: { photoId: string; sens: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const photo = idSchema.safeParse(entree.photoId);
  if (!photo.success) return { ok: false, erreur: "photo_introuvable" };
  if (entree.sens !== "haut" && entree.sens !== "bas") return { ok: false, erreur: "generique" };
  try {
    const { erreur } = await deps.deplacerPhoto({ auteur: droit.auteur, photoId: photo.data, sens: entree.sens });
    if (erreur) {
      journaliser("déplacement refusé", erreur);
      return { ok: false, erreur: erreurPhoto(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("déplacement", e);
    return { ok: false, erreur: "generique" };
  }
}

// Supprime une photo : la base d'abord (ligne retirée, positions renumérotées, journal), puis le fichier public. Un échec d'effacement
// est journalisé sans annuler la suppression en base (un orphelin vaut mieux qu'une photo cassée).
// La dernière photo d'un produit publié est refusée par la base (déclencheur différé) : message « dépublie d'abord ».
export async function supprimerPhoto(deps: DependancesCatalogue, entree: { photoId: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const photo = idSchema.safeParse(entree.photoId);
  if (!photo.success) return { ok: false, erreur: "photo_introuvable" };
  try {
    const { erreur, fichier } = await deps.supprimerPhoto({ auteur: droit.auteur, photoId: photo.data });
    if (erreur) {
      journaliser("suppression de photo refusée", erreur);
      const code = erreurPhoto(erreur);
      return { ok: false, erreur: code === "publication_incomplete" ? "derniere_photo_publiee" : code };
    }
    // La ligne est déjà supprimée : un fichier inconnu est une anomalie journalisée, pas un échec.
    if (fichier) await effacer(deps, "produits-public", fichier);
    else journaliser("suppression de photo : fichier non renvoyé", "");
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("suppression de photo", e);
    return { ok: false, erreur: "generique" };
  }
}

// Corrige les textes alternatifs FR et EN d'une photo : « ok » seulement après la réponse réelle de la base.
export async function modifierAltPhoto(deps: DependancesCatalogue, entree: { photoId: string; altFr: string; altEn: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const photo = idSchema.safeParse(entree.photoId);
  if (!photo.success) return { ok: false, erreur: "photo_introuvable" };
  const alt = lireAlt(entree.altFr, entree.altEn);
  if (!alt.ok) return { ok: false, erreur: "alt_invalide" };
  try {
    const { erreur } = await deps.modifierAltPhoto({ auteur: droit.auteur, photoId: photo.data, altFr: alt.altFr, altEn: alt.altEn });
    if (erreur) {
      journaliser("texte alternatif refusé", erreur);
      return { ok: false, erreur: erreurPhoto(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("texte alternatif", e);
    return { ok: false, erreur: "generique" };
  }
}

// Après la réponse réelle de la base seulement : l'étiquette « catalogue » est vidée ; un échec de cette étape ne défait rien.
async function invalider(deps: DependancesCatalogue) {
  try {
    await deps.invaliderCatalogue();
  } catch (e) {
    journaliser("invalidation du cache", e);
  }
}

// Publie un produit : refus avec la liste des manques s'il est incomplet (la base revérifie).
export async function publierProduit(deps: DependancesCatalogue, entree: { id: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.id);
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  try {
    const produit = await deps.lireProduitComplet(id.data);
    if (!produit) return { ok: false, erreur: "produit_introuvable" };
    // La publication d'un Kit est définie par la story 3.2 : la base la refuse, la liste des manques d'un produit physique n'a pas de sens ici.
    if ((await deps.lireFamilleProduit(id.data)) === "kit") return { ok: false, erreur: "kit_non_publiable" };
    const manques = manquesPublication(produit);
    if (manques.length > 0) return { ok: false, erreur: "publication_incomplete", manques };

    const { erreur } = await deps.changerPublication({ auteur: droit.auteur, id: id.data, publier: true });
    if (erreur) {
      journaliser("publication refusée", erreur);
      const code = erreurPhoto(erreur);
      if (code === "publication_incomplete") {
        // Le produit a changé entre la lecture et l'écriture : la liste est relue.
        const relu = await deps.lireProduitComplet(id.data);
        return { ok: false, erreur: code, manques: relu ? manquesPublication(relu) : undefined };
      }
      return { ok: false, erreur: code };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("publication", e);
    return { ok: false, erreur: "generique" };
  }
}

export async function depublierProduit(deps: DependancesCatalogue, entree: { id: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.id);
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };
  try {
    const { erreur } = await deps.changerPublication({ auteur: droit.auteur, id: id.data, publier: false });
    if (erreur) {
      journaliser("dépublication refusée", erreur);
      return { ok: false, erreur: erreurPhoto(erreur) };
    }
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("dépublication", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Kits et leurs fichiers (story 3.1) ----

// Crée (id vide) ou modifie un brouillon de Kit : droit, validation, une seule écriture atomique. Jamais de publication ici (story 3.2).
// « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13).
export async function enregistrerKit(deps: DependancesCatalogue, entree: EntreeKit): Promise<ResultatCatalogue<{ id: string; cree: boolean }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = lireKit(entree);
  if (!lu.ok) return lu;

  try {
    const { erreur, id } = await deps.ecrireKit({ auteur: droit.auteur, id: lu.id, kit: lu.kit });
    if (erreur) {
      journaliser("kit refusé", erreur);
      if (erreur.includes("KS_SLUG_PRIS")) {
        let slugPropose: string | undefined;
        try {
          slugPropose = await deps.premierSlugLibre(lu.kit.slug, lu.id);
        } catch (e) {
          journaliser("adresse libre", e);
        }
        return { ok: false, erreur: "slug_pris", champ: "slug", slugPropose };
      }
      const connue = ERREURS_PRODUIT.find(([code]) => erreur.includes(code));
      // La famille d'un Kit n'est pas un champ du formulaire : l'erreur est rendue au formulaire entier.
      if (connue) return { ok: false, erreur: connue[1], champ: connue[1] === "famille_invalide" ? undefined : connue[2] };
      return { ok: false, erreur: "generique" };
    }
    if (!id) return { ok: false, erreur: "generique" };
    await invalider(deps);
    return { ok: true, id, cree: lu.id === null };
  } catch (e) {
    journaliser("kit", e);
    return { ok: false, erreur: "generique" };
  }
}

// Erreurs de la base propres aux fichiers de Kit.
const ERREURS_FICHIER_KIT: ReadonlyArray<readonly [string, CodeErreurCatalogue]> = [
  ["KS_PRODUIT_INTROUVABLE", "produit_introuvable"],
  ["KS_FAMILLE_INVALIDE", "famille_invalide"],
  ["KS_FICHIER_INTROUVABLE", "fichier_introuvable"],
  ["KS_FORMAT_INVALIDE", "format_invalide"],
  ["KS_NOM_INVALIDE", "nom_invalide"],
  ["KS_TAILLE_FICHIER_INVALIDE", "fichier_trop_lourd"],
  ["KS_CHEMIN_INVALIDE", "fichier_deja_enregistre"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

function erreurFichierKit(erreur: string): CodeErreurCatalogue {
  return ERREURS_FICHIER_KIT.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

// Autorisation d'envoi d'un fichier de Kit : droit, Kit (ou fichier à remplacer), extension, format et taille vérifiés AVANT de signer.
// Le serveur choisit le nom de l'objet de kits-private ; le navigateur n'envoie que ce que le jeton autorise.
// fichierId présent : remplacement du contenu de ce fichier (son format est celui de la base).
export async function demanderEnvoiFichierKit(
  deps: DependancesCatalogue,
  entree: { produitId: string; nomFichier: string; format: string; taille: number; fichierId?: string },
): Promise<ResultatCatalogue<{ objet: string; jeton: string; contentType: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  // Identifiant en minuscules dès l'entrée : la base compare le dossier du fichier en minuscules.
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };

  try {
    let format: string = entree.format;
    if (entree.fichierId !== undefined) {
      const fichierId = idSchema.safeParse(entree.fichierId);
      if (!fichierId.success) return { ok: false, erreur: "fichier_introuvable" };
      const existant = await deps.lireFichierKit(fichierId.data);
      if (!existant || existant.produitId !== id.data) return { ok: false, erreur: "fichier_introuvable" };
      format = existant.format;
    } else {
      const famille = await deps.lireFamilleProduit(id.data);
      if (!famille) return { ok: false, erreur: "produit_introuvable" };
      if (famille !== "kit") return { ok: false, erreur: "famille_invalide" };
    }

    const annonce = lireAnnonceFichierKit(entree.nomFichier, format, entree.taille);
    if (!annonce.ok) return { ok: false, erreur: annonce.erreur };

    const objet = `${id.data}/${crypto.randomUUID()}.${annonce.ext}`;
    const { erreur, jeton } = await deps.signerEnvoiFichierKit({ objet });
    if (erreur || !jeton) {
      journaliser("jeton d'envoi de fichier", erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton, contentType: TYPE_CONTENU_EXTENSION[annonce.ext] };
  } catch (e) {
    journaliser("envoi de fichier", e);
    return { ok: false, erreur: "generique" };
  }
}

function nomAffiche(texte: string): string | null {
  const rogne = texte.trim();
  return rogne.length >= 1 && rogne.length <= 120 ? rogne : null;
}

// Finalisation : vérifie l'objet envoyé (existence, taille annoncée, contenu réel), enregistre la ligne (ajout) ou remplace le contenu
// (fichierId présent : version + 1). Rien d'orphelin : l'objet est effacé dès qu'il est refusé ou que la base répond par une erreur.
// Remplacement : l'ancien objet n'est effacé qu'APRÈS la réponse de la base ; un échec d'effacement est journalisé, jamais bloquant.
// Si la base ne répond pas (exception), le résultat est inconnu : l'objet est gardé (un orphelin vaut mieux qu'un fichier cassé).
export async function finaliserFichierKit(
  deps: DependancesCatalogue,
  entree: { produitId: string; objet: string; format: string; taille: number; nomFr: string; nomEn: string; fichierId?: string },
): Promise<ResultatCatalogue<{ id: string }>> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success) return { ok: false, erreur: "produit_introuvable" };

  // Le format et le fichier à remplacer viennent de la base, jamais du navigateur.
  let format: FormatFichierKit;
  let fichierId: string | null = null;
  try {
    if (entree.fichierId !== undefined) {
      const lu = idSchema.safeParse(entree.fichierId);
      if (!lu.success) return { ok: false, erreur: "fichier_introuvable" };
      const existant = await deps.lireFichierKit(lu.data);
      if (!existant || existant.produitId !== id.data) return { ok: false, erreur: "fichier_introuvable" };
      format = existant.format;
      fichierId = lu.data;
    } else {
      if (!estFormatFichierKit(entree.format)) return { ok: false, erreur: "format_invalide" };
      format = entree.format;
    }
  } catch (e) {
    journaliser("fichier de kit", e);
    return { ok: false, erreur: "generique" };
  }
  // Un objet qui n'appartient pas à ce Kit (ou d'une autre extension que le format) n'est ni lu ni effacé.
  if (!objetKitValide(entree.objet, id.data, format)) return { ok: false, erreur: "format_invalide" };

  // Un objet déjà enregistré en base n'est jamais touché : ni lu comme un envoi neuf, ni effacé (double finalisation, jeton rejoué,
  // remplacement par le chemin courant). Tant que ce contrôle n'a pas eu lieu, rien ne peut être effacé.
  try {
    if (await deps.cheminKitEnregistre(entree.objet)) return { ok: false, erreur: "fichier_deja_enregistre" };
  } catch (e) {
    journaliser("chemin déjà enregistré", e);
    return { ok: false, erreur: "generique" };
  }

  // Objet à effacer si l'enregistrement n'aboutit pas : d'abord l'objet envoyé, puis (après le déplacement) l'objet déplacé.
  let aEffacer: string | null = entree.objet;
  try {
    if (!Number.isInteger(entree.taille) || entree.taille < 1) return { ok: false, erreur: "format_invalide" };
    if (entree.taille > tailleMaxFormat(format)) return { ok: false, erreur: "fichier_trop_lourd" };
    const nomFr = nomAffiche(entree.nomFr);
    const nomEn = nomAffiche(entree.nomEn);
    if (fichierId === null && (!nomFr || !nomEn)) return { ok: false, erreur: "nom_invalide" };

    const lu = await deps.lireObjetKit({ objet: entree.objet, octets: octetsAVerifier(format, entree.taille) });
    if (lu.erreur) {
      journaliser("lecture de l'objet", lu.erreur);
      // L'erreur de lecture ne refuse pas le fichier : l'objet envoyé est conservé (un orphelin sera purgé en 3.6).
      aEffacer = null;
      return { ok: false, erreur: "generique" };
    }
    if (!lu.trouve) return { ok: false, erreur: "envoi_incomplet" };
    // Taille réelle contrôlée par format (transcription 1 Mo, autres 50 Mo), puis comparée à la taille annoncée.
    if (lu.taille > tailleMaxFormat(format)) return { ok: false, erreur: "fichier_trop_lourd" };
    if (lu.taille !== entree.taille) return { ok: false, erreur: "envoi_incomplet" };
    const analyse = analyserContenuKit(format, lu.debut, lu.taille);
    if (analyse !== "ok") return { ok: false, erreur: analyse === "invalide" ? "format_invalide" : analyse };

    // Le jeton signé reste valable après la vérification : l'objet vérifié est déplacé vers un chemin que seul le serveur connaît.
    // L'ancien chemin (celui du jeton) devient vide ; en cas d'échec du déplacement, l'objet d'origine (non référencé) est effacé.
    const nouveau = `${id.data}/${crypto.randomUUID()}.${EXTENSION_FORMAT[format]}`;
    const deplace = await deps.deplacerObjetKit({ de: entree.objet, vers: nouveau });
    if (deplace.erreur) {
      journaliser("déplacement de l'objet", deplace.erreur);
      return { ok: false, erreur: "generique" };
    }
    aEffacer = nouveau;

    // À partir d'ici, l'écriture en base peut avoir abouti sans que nous le sachions.
    let conserver = true;
    try {
      if (fichierId === null) {
        const { erreur, id: cree } = await deps.ecrireFichierKit({
          auteur: droit.auteur,
          produitId: id.data,
          nomFr: nomFr as string,
          nomEn: nomEn as string,
          format,
          taille: lu.taille,
          chemin: nouveau,
        });
        if (erreur || !cree) {
          journaliser("fichier de kit refusé", erreur ?? "");
          // Chemin refusé comme déjà enregistré : on ne touche à rien.
          conserver = Boolean(erreur?.includes("KS_CHEMIN_INVALIDE"));
          return { ok: false, erreur: erreur ? erreurFichierKit(erreur) : "generique" };
        }
        await invalider(deps);
        return { ok: true, id: cree };
      }

      const { erreur, ancienChemin } = await deps.remplacerFichierKit({ auteur: droit.auteur, fichierId, taille: lu.taille, chemin: nouveau });
      if (erreur || !ancienChemin) {
        journaliser("remplacement refusé", erreur ?? "");
        conserver = Boolean(erreur?.includes("KS_CHEMIN_INVALIDE"));
        return { ok: false, erreur: erreur ? erreurFichierKit(erreur) : "generique" };
      }
      // La base a répondu : l'ancien objet est effacé ensuite, sans jamais bloquer (et jamais s'il est encore référencé).
      if (ancienChemin !== nouveau) await effacer(deps, "kits-private", ancienChemin);
      await invalider(deps);
      return { ok: true, id: fichierId };
    } finally {
      if (conserver) aEffacer = null;
    }
  } catch (e) {
    journaliser("fichier de kit", e);
    return { ok: false, erreur: "generique" };
  } finally {
    if (aEffacer) await effacer(deps, "kits-private", aEffacer);
  }
}

// Annulation d'un envoi : efface l'objet de ce Kit dans kits-private (le droit est revérifié).
export async function annulerEnvoiFichierKit(deps: DependancesCatalogue, entree: { produitId: string; objet: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const id = idSchema.safeParse(entree.produitId.toLowerCase());
  if (!id.success || !objetKitDuProduit(entree.objet, id.data)) return { ok: false, erreur: "produit_introuvable" };
  try {
    // Un objet déjà enregistré en base n'est jamais effacé par une annulation.
    if (await deps.cheminKitEnregistre(entree.objet)) return { ok: false, erreur: "fichier_deja_enregistre" };
  } catch (e) {
    journaliser("chemin déjà enregistré", e);
    return { ok: false, erreur: "generique" };
  }
  await effacer(deps, "kits-private", entree.objet);
  return { ok: true };
}

// Supprime un fichier : la base d'abord (lignes retirées, journal), puis l'objet. Un échec d'effacement est journalisé sans annuler la
// suppression en base.
export async function supprimerFichierKit(deps: DependancesCatalogue, entree: { fichierId: string }): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps);
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };
  const fichier = idSchema.safeParse(entree.fichierId);
  if (!fichier.success) return { ok: false, erreur: "fichier_introuvable" };
  try {
    const { erreur, chemin } = await deps.supprimerFichierKit({ auteur: droit.auteur, fichierId: fichier.data });
    if (erreur) {
      journaliser("suppression de fichier refusée", erreur);
      return { ok: false, erreur: erreurFichierKit(erreur) };
    }
    if (chemin) await effacer(deps, "kits-private", chemin);
    else journaliser("suppression de fichier : chemin non renvoyé", "");
    await invalider(deps);
    return { ok: true };
  } catch (e) {
    journaliser("suppression de fichier", e);
    return { ok: false, erreur: "generique" };
  }
}

// ---- Tranches de prix (story 2.3) ----

// Remplace l'ensemble des tranches (liste vide = plus de tranche, donc plus de filtre de prix) : droit « reglages.modifier »,
// validation, écriture atomique, puis invalidation du cache. « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13).
export async function enregistrerTranchesPrix(deps: DependancesCatalogue, entree: readonly EntreeTranche[]): Promise<ResultatCatalogue> {
  const droit = await verifierDroit(deps, "reglages.modifier");
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = lireTranches(entree);
  if (!lu.ok) return lu;

  try {
    const { erreur } = await deps.ecrireTranches({ auteur: droit.auteur, tranches: lu.tranches });
    if (erreur) {
      journaliser("tranches refusées", erreur);
      if (erreur.includes("KS_TRANCHE_INVALIDE")) return { ok: false, erreur: "tranche_bornes_invalides" };
      if (erreur.includes("KS_DROIT_REFUSE") || erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    try {
      await deps.invaliderReglages();
    } catch (e) {
      journaliser("invalidation du cache", e);
    }
    return { ok: true };
  } catch (e) {
    journaliser("tranches", e);
    return { ok: false, erreur: "generique" };
  }
}
