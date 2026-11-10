import { analyserMontantUsd } from "@/lib/argent";
import { BUCKET_ATTENTE, BUCKET_PUBLIC } from "@/lib/supabase/stockage";
import { nettoyerPhoto } from "@/modules/catalogue/photo";
import { proposerSlug } from "@/modules/catalogue/slug";
import { codeErreurSchema, schemaEvenement } from "./schemas";
import {
  CHEMIN_IMAGE_EVENEMENT,
  DECALAGE_BOUTIQUE,
  FORMATS_IMAGE_EVENEMENT,
  IMAGE_EVENEMENT_TAILLE_MAX,
  MANQUES_PUBLICATION,
  type CodeErreurEvenement,
  type DependancesEvenements,
  type EntreeEvenement,
  type ResultatEvenement,
} from "./types";

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie ni un identifiant de Compte.
function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[evenements] ${contexte} : ${code}`);
}

const ERREURS_BASE: ReadonlyArray<readonly [string, CodeErreurEvenement]> = [
  ["KS_EVENEMENT_INVALIDE", "evenement_invalide"],
  ["KS_TITRE_INVALIDE", "titre_invalide"],
  ["KS_TEXTE_INVALIDE", "texte_invalide"],
  ["KS_SLUG_INVALIDE", "slug_invalide"],
  ["KS_SLUG_PRIS", "slug_pris"],
  ["KS_LIEU_INVALIDE", "lieu_invalide"],
  ["KS_DATE_INVALIDE", "date_invalide"],
  ["KS_CAPACITE_INVALIDE", "capacite_invalide"],
  ["KS_TYPE_PASS_INVALIDE", "type_pass_invalide"],
  ["KS_PRIX_INVALIDE", "prix_invalide"],
  ["KS_QUOTA_INVALIDE", "quota_invalide"],
  ["KS_EVENEMENT_INTROUVABLE", "evenement_introuvable"],
  ["KS_TYPE_PASS_INTROUVABLE", "type_pass_introuvable"],
  ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

function erreurBase(erreur: string): CodeErreurEvenement {
  return ERREURS_BASE.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

// Liste des manques renvoyée par la base : « KS_PUBLICATION_INCOMPLETE:titre_en,photo ». Seules les clés connues passent.
function manquesDe(erreur: string): string[] {
  const m = /KS_PUBLICATION_INCOMPLETE:([a-z_,]+)/.exec(erreur);
  if (!m) return [];
  return m[1].split(",").filter((cle) => (MANQUES_PUBLICATION as readonly string[]).includes(cle));
}

function identifiantValide(valeur: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur);
}

// Saisie à l'heure de Goma → instant absolu (la base stocke un timestamptz).
function versInstant(saisie: string | null | undefined): string | null {
  return saisie ? `${saisie}:00${DECALAGE_BOUTIQUE}` : null;
}

// Crée (id vide) ou modifie un brouillon d'Événement avec ses Types de pass : droit, validation, une seule écriture atomique.
export async function enregistrerEvenement(
  deps: DependancesEvenements,
  entree: { id: string | null; evenement: EntreeEvenement },
): Promise<ResultatEvenement<{ id: string; cree: boolean }>> {
  const droit = await deps.exigerDroit("evenements.gerer");
  if (entree.id !== null && !identifiantValide(entree.id)) return { ok: false, erreur: "evenement_introuvable" };
  const lu = schemaEvenement.safeParse(entree.evenement);
  if (!lu.success) return { ok: false, erreur: codeErreurSchema(lu.error.issues[0]?.message) };
  const e = lu.data;
  const slug = e.slug ?? proposerSlug(e.titreFr);
  if (slug === "") return { ok: false, erreur: "slug_invalide" };

  const types = e.types.map((t) => {
    const prix = analyserMontantUsd(t.prixUsd, 1_000_000);
    // Le schéma a déjà validé le prix : s'il ne passe plus ici, on s'arrête plutôt que de créer un Pass gratuit.
    if (!prix.ok) throw new Error("KS_PRIX_INVALIDE");
    return {
      id: t.id ?? null,
      nom_fr: t.nomFr,
      nom_en: t.nomEn ?? null,
      prix_cents: prix.cents,
      quota: t.quota ?? null,
      inclus_fr: t.inclusFr ?? null,
      inclus_en: t.inclusEn ?? null,
      est_stand: t.estStand,
    };
  });
  const evenement = {
    titre_fr: e.titreFr,
    titre_en: e.titreEn ?? null,
    slug,
    description_fr: e.descriptionFr ?? null,
    description_en: e.descriptionEn ?? null,
    lieu_type: e.lieuType ?? null,
    lieu_fr: e.lieuFr ?? null,
    lieu_en: e.lieuEn ?? null,
    debut_le: versInstant(e.debut),
    fin_le: versInstant(e.fin),
    vente_ouvre_le: versInstant(e.venteOuvre),
    vente_ferme_le: versInstant(e.venteFerme),
    capacite: e.capacite ?? null,
    images: e.images.map((image) => ({ fichier: image.fichier, alt_fr: image.altFr, alt_en: image.altEn })),
  };
  try {
    // Les images déjà enregistrées sont lues AVANT l'écriture : celles retirées seront effacées après la sauvegarde.
    const anciennes = entree.id !== null ? await deps.lireImagesEvenement(entree.id).catch(() => []) : [];
    const { erreur, id } = await deps.enregistrerEvenement({ auteur: droit.auteur, id: entree.id, evenement, types });
    if (erreur) {
      journaliser("événement refusé", erreur);
      return { ok: false, erreur: erreurBase(erreur) };
    }
    if (!id) return { ok: false, erreur: "generique" };
    const gardees = new Set(e.images.map((image) => image.fichier));
    for (const image of anciennes) {
      if (CHEMIN_IMAGE_EVENEMENT.test(image.fichier) && !gardees.has(image.fichier)) {
        await deps.supprimerObjet({ bucket: BUCKET_PUBLIC, objet: image.fichier }).catch(() => {});
      }
    }
    await deps.invaliderEvenements();
    return { ok: true, id, cree: entree.id === null };
  } catch (err) {
    journaliser("événement", err);
    return { ok: false, erreur: "generique" };
  }
}

// Publie (publier = true) ou dépublie : droit, refus avec la liste des manques si la publication est incomplète.
export async function changerPublication(deps: DependancesEvenements, entree: { id: string; publier: boolean }): Promise<ResultatEvenement<{ id: string }>> {
  const droit = await deps.exigerDroit("evenements.gerer");
  if (!identifiantValide(entree.id)) return { ok: false, erreur: "evenement_introuvable" };
  try {
    const { erreur } = await deps.changerPublication({ auteur: droit.auteur, id: entree.id, publier: entree.publier });
    if (erreur) {
      journaliser("publication", erreur);
      const code = erreurBase(erreur);
      return code === "publication_incomplete" ? { ok: false, erreur: code, manques: manquesDe(erreur) } : { ok: false, erreur: code };
    }
    await deps.invaliderEvenements();
    return { ok: true, id: entree.id };
  } catch (err) {
    journaliser("publication", err);
    return { ok: false, erreur: "generique" };
  }
}

function fichierAnnonce(type: string, taille: number): { ok: true; ext: string } | { ok: false; erreur: CodeErreurEvenement } {
  if (!Object.hasOwn(FORMATS_IMAGE_EVENEMENT, type)) return { ok: false, erreur: "format_invalide" };
  const ext = FORMATS_IMAGE_EVENEMENT[type as keyof typeof FORMATS_IMAGE_EVENEMENT];
  if (!Number.isInteger(taille) || taille < 1) return { ok: false, erreur: "format_invalide" };
  if (taille > IMAGE_EVENEMENT_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  return { ok: true, ext };
}

// Autorise l'envoi direct d'une photo vers le bucket d'attente : chemin choisi par le serveur, jamais par le navigateur.
export async function demanderEnvoiImage(deps: DependancesEvenements, entree: { type: string; taille: number }): Promise<ResultatEvenement<{ objet: string; jeton: string }>> {
  await deps.exigerDroit("evenements.gerer");
  const fichier = fichierAnnonce(entree.type, entree.taille);
  if (!fichier.ok) return { ok: false, erreur: fichier.erreur };
  try {
    const objet = `evenements/${crypto.randomUUID()}.${fichier.ext}`;
    const { erreur, jeton } = await deps.signerEnvoiImage({ objet });
    if (erreur || !jeton) {
      journaliser("jeton d'envoi d'image", erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, objet, jeton };
  } catch (err) {
    journaliser("envoi d'image", err);
    return { ok: false, erreur: "generique" };
  }
}

// Finalise une photo : contrôle du contenu réel, métadonnées retirées, copie publique, retour du chemin.
export async function finaliserImage(
  deps: DependancesEvenements,
  entree: { objet: string; altFr: string; altEn: string },
): Promise<ResultatEvenement<{ fichier: string; altFr: string; altEn: string }>> {
  await deps.exigerDroit("evenements.gerer");
  if (!CHEMIN_IMAGE_EVENEMENT.test(entree.objet)) return { ok: false, erreur: "format_invalide" };
  const altFr = entree.altFr.trim();
  const altEn = entree.altEn.trim();
  if (altFr === "" || altFr.length > 200 || altEn === "" || altEn.length > 200) return { ok: false, erreur: "alt_invalide" };

  let objetPublic: string | null = null;
  try {
    const lu = await deps.lireObjetAttente(entree.objet);
    if (lu.erreur || !lu.octets) {
      journaliser("lecture de l'image", lu.erreur ?? "");
      return { ok: false, erreur: "generique" };
    }
    if (lu.octets.byteLength > IMAGE_EVENEMENT_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
    const propre = await nettoyerPhoto(lu.octets);
    if (!propre.ok) return { ok: false, erreur: "format_invalide" };
    objetPublic = `evenements/${crypto.randomUUID()}.${propre.ext}`;
    const ecrit = await deps.ecrireObjetPublic({ objet: objetPublic, octets: propre.octets, contentType: propre.contentType });
    if (ecrit.erreur) {
      journaliser("écriture de l'image", ecrit.erreur);
      await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet });
      return { ok: false, erreur: "generique" };
    }
    await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet });
    return { ok: true, fichier: objetPublic, altFr, altEn };
  } catch (err) {
    journaliser("image", err);
    if (objetPublic === null) await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet }).catch(() => {});
    return { ok: false, erreur: "generique" };
  }
}

// Envoi abandonné : l'objet d'attente est effacé, jamais un fichier public.
export async function annulerEnvoiImage(deps: DependancesEvenements, entree: { objet: string }): Promise<ResultatEvenement> {
  await deps.exigerDroit("evenements.gerer");
  if (!CHEMIN_IMAGE_EVENEMENT.test(entree.objet)) return { ok: false, erreur: "format_invalide" };
  try {
    const { erreur } = await deps.supprimerObjet({ bucket: BUCKET_ATTENTE, objet: entree.objet });
    if (erreur) {
      journaliser("annulation d'image", erreur);
      return { ok: false, erreur: "generique" };
    }
    return { ok: true };
  } catch (err) {
    journaliser("annulation d'image", err);
    return { ok: false, erreur: "generique" };
  }
}
