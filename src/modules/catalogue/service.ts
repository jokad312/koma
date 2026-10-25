import type { AuteurCompte } from "@/lib/auth/auteur";
import { nettoyerPhoto } from "./photo";
import { manquesPublication } from "./publication";
import { idSchema, lireAlt, lireFichierAnnonce, lireProduit, lireUnivers, objetAttenteValide } from "./schemas";
import { PHOTOS_MAX, PHOTO_TAILLE_MAX } from "./types";
import type { ChampProduit, CodeErreurCatalogue, DependancesCatalogue, EntreeProduit, EntreeUnivers, ResultatCatalogue } from "./types";

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie ni un identifiant de Compte.
function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[catalogue] ${contexte} : ${code}`);
}

async function verifierDroit(deps: DependancesCatalogue): Promise<{ auteur: AuteurCompte } | { erreur: CodeErreurCatalogue }> {
  try {
    return { auteur: (await deps.exigerDroit("produits.modifier")).auteur };
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
async function effacer(deps: DependancesCatalogue, bucket: "galerie-attente" | "produits-public", objet: string) {
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
