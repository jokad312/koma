import { z } from "zod";
import { nettoyerPhoto } from "@/modules/catalogue/photo";
import {
  CHEMIN_ENVOI_CANDIDATURE,
  compteDeLEnvoiCandidature,
  descriptionValable,
  FORMATS_PHOTO_CANDIDATURE,
  instagramValable,
  NOMBRE_PHOTOS_CANDIDATURE,
  PHOTO_CANDIDATURE_TAILLE_MAX,
  VERSION_ENGAGEMENT_STAND,
} from "./candidature-types";
import type { DependancesCandidature, ErreurCandidature, ResultatCandidature } from "./candidature-types";

// Seul le contexte est journalisé : ni identifiant de Compte, ni description, ni Instagram, ni chemin de photo.
function journaliser(contexte: string) {
  console.error(`[candidature-stand] ${contexte} : échec`);
}

const TABLE_BASE: ReadonlyArray<readonly [string, ErreurCandidature]> = [
  ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
  ["KS_AUTEUR_INVALIDE", "non_connecte"],
  ["KS_AUTEUR_MANQUANT", "non_connecte"],
  ["KS_COMPLET", "complet"],
  ["KS_CANDIDATURE_EXISTANTE", "deja_candidat"],
  ["KS_CANDIDATURE_REFUSEE", "candidature_refusee"],
  ["KS_VENTE_FERMEE", "vente_fermee"],
  ["KS_EVENEMENT_INTROUVABLE", "evenement_introuvable"],
  ["KS_TYPE_PASS_INTROUVABLE", "type_introuvable"],
  ["KS_PASS_GRATUIT", "type_introuvable"],
  ["KS_CANDIDATURE_DESCRIPTION", "description_invalide"],
  ["KS_CANDIDATURE_INSTAGRAM", "instagram_invalide"],
  ["KS_CANDIDATURE_PHOTOS", "format_invalide"],
  ["KS_ACCEPTATION_MANQUANTE", "engagement_manquant"],
  ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
];

export function erreurDeLaBase(message: string): ErreurCandidature {
  return TABLE_BASE.find(([code]) => message.includes(code))?.[1] ?? "generique";
}

const demandeSchema = z.object({
  evenementId: z.uuid(),
  typePassId: z.uuid(),
  fichiers: z.array(z.object({ type: z.string(), taille: z.number() })).length(NOMBRE_PHOTOS_CANDIDATURE),
});

// Autorise l'envoi direct des trois photos vers le bucket privé : chemins choisis par le serveur, Compte complet, limite de demandes par heure.
// Aucune règle d'âge ici : la Candidature Stand n'en prévoit pas (le Compte doit seulement être complet, comme pour tout achat de Pass).
export async function demanderEnvoiCandidature(
  deps: DependancesCandidature,
  entree: unknown,
): Promise<ResultatCandidature<{ objets: { objet: string; jeton: string }[] }>> {
  const lu = demandeSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  for (const f of lu.data.fichiers) {
    if (!Object.hasOwn(FORMATS_PHOTO_CANDIDATURE, f.type)) return { ok: false, erreur: "format_invalide" };
    if (!Number.isInteger(f.taille) || f.taille < 1) return { ok: false, erreur: "format_invalide" };
    if (f.taille > PHOTO_CANDIDATURE_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  }
  try {
    const compte = await deps.compte();
    if ("erreur" in compte) return { ok: false, erreur: compte.erreur };
    // Obstacle connu (déjà candidat, refus, vente fermée, complet) : annoncé avant tout envoi de photos, sans consommer la limite d'envois.
    const possible = await deps.verifierPossible({ compteId: compte.compteId, evenementId: lu.data.evenementId, typePassId: lu.data.typePassId });
    if ("erreur" in possible) {
      journaliser("pré-contrôle de la candidature");
      return { ok: false, erreur: "generique" };
    }
    if (possible.obstacle) return { ok: false, erreur: erreurDeLaBase(possible.obstacle) };
    const essai = await deps.consommerEssai(`candidature:${compte.compteId}`);
    if ("erreur" in essai) {
      journaliser("limite d'envois");
      return { ok: false, erreur: "generique" };
    }
    if (!essai.autorise) return { ok: false, erreur: "trop_d_envois" };
    const objets: { objet: string; jeton: string }[] = [];
    for (const f of lu.data.fichiers) {
      const ext = FORMATS_PHOTO_CANDIDATURE[f.type as keyof typeof FORMATS_PHOTO_CANDIDATURE];
      const objet = `envois-candidatures/${compte.compteId.toLowerCase()}.${crypto.randomUUID()}.${ext}`;
      const signe = await deps.signerEnvoi(objet);
      if ("erreur" in signe) {
        journaliser("autorisation d'envoi");
        return { ok: false, erreur: "generique" };
      }
      objets.push({ objet, jeton: signe.jeton });
    }
    return { ok: true, objets };
  } catch {
    journaliser("autorisation d'envoi");
    return { ok: false, erreur: "generique" };
  }
}

const finalisationSchema = z.object({
  evenementId: z.uuid(),
  typePassId: z.uuid(),
  objets: z.array(z.string()).length(NOMBRE_PHOTOS_CANDIDATURE),
  description: z.string().max(5000),
  instagram: z.string().max(500),
  engagement: z.boolean(),
});

async function effacer(deps: DependancesCandidature, objets: string[]) {
  for (const o of objets) {
    try {
      const { erreur } = await deps.supprimerObjet(o);
      if (erreur) journaliser("effacement d'un fichier");
    } catch {
      journaliser("effacement d'un fichier");
    }
  }
}

// Finalise la candidature : engagement obligatoire, contenu réel des trois photos contrôlé (JPEG, PNG ou WebP, 15 Mo), métadonnées retirées,
// copies rangées sous <événement>/<candidature>/<n>.<ext>, originaux effacés, puis dépôt en base (candidature acceptée immédiatement). Le succès
// n'est annoncé qu'après la réponse réelle de la base (règle 13). En cas d'échec, tout ce qui a été écrit est effacé.
export async function finaliserCandidature(deps: DependancesCandidature, entree: unknown): Promise<ResultatCandidature<{ candidatureId: string; expireLe: string }>> {
  const lu = finalisationSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  const e = lu.data;
  const objets = e.objets;
  if (new Set(objets).size !== objets.length || objets.some((o) => !CHEMIN_ENVOI_CANDIDATURE.test(o))) return { ok: false, erreur: "format_invalide" };
  // Engagement non coché : ni lecture ni effacement (les envois abandonnés sont purgés).
  if (e.engagement !== true) return { ok: false, erreur: "engagement_manquant" };
  const description = e.description.trim();
  const instagram = e.instagram.trim();

  const gardes: string[] = [];
  try {
    const compte = await deps.compte();
    if ("erreur" in compte) return { ok: false, erreur: compte.erreur };
    // Un envoi autorisé pour un autre Compte n'est jamais lu ni effacé ici.
    if (objets.some((o) => compteDeLEnvoiCandidature(o) !== compte.compteId.toLowerCase())) return { ok: false, erreur: "format_invalide" };
    if (!descriptionValable(description)) {
      await effacer(deps, objets);
      return { ok: false, erreur: "description_invalide" };
    }
    if (!instagramValable(instagram)) {
      await effacer(deps, objets);
      return { ok: false, erreur: "instagram_invalide" };
    }

    const id = crypto.randomUUID();
    for (const [i, objet] of objets.entries()) {
      const brut = await deps.lireObjet(objet);
      if ("erreur" in brut) {
        journaliser("lecture d'une photo");
        await effacer(deps, [...objets, ...gardes]);
        return { ok: false, erreur: "generique" };
      }
      if (brut.octets.byteLength > PHOTO_CANDIDATURE_TAILLE_MAX) {
        await effacer(deps, [...objets, ...gardes]);
        return { ok: false, erreur: "fichier_trop_lourd" };
      }
      const propre = await nettoyerPhoto(brut.octets);
      if (!propre.ok) {
        await effacer(deps, [...objets, ...gardes]);
        return { ok: false, erreur: "format_invalide" };
      }
      const final = `${e.evenementId}/${id}/${i + 1}.${propre.ext}`;
      const ecrit = await deps.ecrireObjet({ objet: final, octets: propre.octets, contentType: propre.contentType });
      if (ecrit.erreur) {
        journaliser("écriture d'une photo");
        await effacer(deps, [...objets, ...gardes]);
        return { ok: false, erreur: "generique" };
      }
      gardes.push(final);
    }
    await effacer(deps, objets);

    const depot = await deps.deposer({
      auteur: compte.auteur,
      id,
      evenementId: e.evenementId,
      typePassId: e.typePassId,
      description,
      instagram,
      photos: gardes,
      versionEngagement: VERSION_ENGAGEMENT_STAND,
    });
    if ("erreur" in depot) {
      // Rien n'est enregistré : les copies sont effacées (la candidature n'existe pas).
      await effacer(deps, gardes);
      const erreur = erreurDeLaBase(depot.erreur);
      if (erreur === "generique") journaliser("enregistrement de la candidature");
      return { ok: false, erreur };
    }
    return { ok: true, candidatureId: id, expireLe: depot.expireLe };
  } catch {
    journaliser("finalisation de la candidature");
    await effacer(deps, [...objets, ...gardes]);
    return { ok: false, erreur: "generique" };
  }
}

// Envoi abandonné par l'exposant : les objets d'envoi sont effacés (jamais une photo déjà rattachée à une candidature).
export async function annulerEnvoiCandidature(deps: DependancesCandidature, entree: unknown): Promise<ResultatCandidature> {
  const lu = z.object({ objets: z.array(z.string()).max(NOMBRE_PHOTOS_CANDIDATURE) }).safeParse(entree);
  if (!lu.success || lu.data.objets.some((o) => !CHEMIN_ENVOI_CANDIDATURE.test(o))) return { ok: false, erreur: "invalide" };
  try {
    const compte = await deps.compte();
    if ("erreur" in compte) return { ok: false, erreur: compte.erreur };
    if (lu.data.objets.some((o) => compteDeLEnvoiCandidature(o) !== compte.compteId.toLowerCase())) return { ok: false, erreur: "invalide" };
    await effacer(deps, lu.data.objets);
    return { ok: true };
  } catch {
    journaliser("annulation d'envoi");
    return { ok: false, erreur: "generique" };
  }
}
