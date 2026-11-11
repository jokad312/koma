import { z } from "zod";
import { CODES_REFUSES } from "@/modules/commande/types";
import { VERSION_PASS_PHOTOS } from "./achat-types";
import { nomValable } from "./candidature-nom";
import type {
  DependancesNommerAide,
  DependancesPaiementStand,
  ErreurNommerAide,
  ErreurPaiementStand,
  RecapStand,
  RecapStandBrut,
  ResultatNommerAide,
  ResultatPaiementStand,
} from "./candidature-types";

function journaliser(contexte: string, code: string) {
  console.error(`[candidature-stand] ${contexte} : ${code}`);
}

const TABLE: ReadonlyArray<readonly [string, ErreurPaiementStand]> = [
  ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
  ["KS_AUTEUR_INVALIDE", "non_connecte"],
  ["KS_AUTEUR_MANQUANT", "non_connecte"],
  ["KS_CANDIDATURE_INTROUVABLE", "introuvable"],
  ["KS_CANDIDATURE_EXPIREE", "expiree"],
  ["KS_CANDIDATURE_REFUSEE", "refusee"],
  ["KS_CANDIDATURE_DEJA_COMMANDEE", "deja_commandee"],
  ["KS_VENTE_FERMEE", "vente_fermee"],
  ["KS_PASS_GRATUIT", "gratuit"],
  ["KS_TITULAIRE_INVALIDE", "titulaire"],
  ["KS_ACCEPTATION_MANQUANTE", "mention"],
  ["KS_COMMANDE_EN_ATTENTE", "commande_en_attente"],
  ["KS_TOTAL_CHANGE", "total_change"],
  ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
  ["KS_CLE_IDEMPOTENCE_INVALIDE", "invalide"],
  ["KS_CODE_INCONNU", "code_inconnu"],
  ["KS_CODE_INACTIF", "code_inactif"],
  ["KS_CODE_PLAFOND", "code_plafond"],
  ["KS_CODE_PREMIER_ACHAT", "code_premier_achat"],
  ["KS_CODE_UN_SEUL", "code_un_seul"],
  ["KS_CODE_TOTAL_NUL", "code_total_nul"],
];

export function erreurPaiementDeLaBase(message: string): ErreurPaiementStand {
  return TABLE.find(([code]) => message.includes(code))?.[1] ?? "erreur";
}

async function compteVerifie(deps: DependancesPaiementStand): Promise<{ compte: Awaited<ReturnType<DependancesPaiementStand["exigerCompte"]>> } | { erreur: ErreurPaiementStand }> {
  try {
    return { compte: await deps.exigerCompte() };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "KS_NON_CONNECTE") return { erreur: "non_connecte" };
    if (code === "KS_COMPTE_INCOMPLET") return { erreur: "compte_incomplet" };
    journaliser("vérification du Compte", code || "inconnue");
    return { erreur: "erreur" };
  }
}

function enRecap(b: RecapStandBrut, langue: "fr" | "en"): RecapStand {
  let code: RecapStand["code"] = null;
  if (b.code) {
    code =
      b.code.valide && typeof b.code.code === "string"
        ? { valide: true, code: b.code.code, reductionPct: Number(b.code.reduction_pct ?? 0) }
        : { valide: false, erreur: CODES_REFUSES.find((e) => e === b.code?.erreur) ?? "code_inconnu" };
  }
  return {
    candidatureId: b.candidature_id,
    expireLe: b.expire_le,
    nom: langue === "en" && b.nom_en ? b.nom_en : b.nom_fr,
    prixCents: b.prix_cents,
    reductionCents: b.reduction_cents ?? 0,
    totalCents: b.total_cents,
    code,
  };
}

const recapSchema = z.object({ candidatureId: z.uuid(), code: z.string().max(40).nullish() });
const creationSchema = recapSchema.extend({
  mention: z.literal(true),
  totalAttenduCents: z.number().int().min(0).max(100_000_000),
  cleIdempotence: z.string().min(8).max(100),
  // Nom de l'exposant : seulement si le Compte n'en a pas (jamais inventé) ; nom de l'aide : facultatif (saisi plus tard dans « Mes Pass »).
  nomTitulaire: z.string().max(200).nullish(),
  nomAide: z.string().max(200).nullish(),
});

// Récapitulatif d'un Stand accepté : prix, réduction et total relus en base à chaque appel (règle 3). Aucune écriture.
export async function lireRecapitulatifStand(deps: DependancesPaiementStand, entree: unknown, langue: "fr" | "en"): Promise<ResultatPaiementStand<{ recap: RecapStand }>> {
  const lu = recapSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };
  try {
    const r = await deps.recapitulatif({ compteId: v.compte.compteId, candidatureId: lu.data.candidatureId, code: lu.data.code?.trim() || null });
    if ("erreur" in r) {
      const erreur = erreurPaiementDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("recapitulatif_commande_stand", "échec");
      return { ok: false, erreur };
    }
    return { ok: true, recap: enRecap(r.recap, langue) };
  } catch {
    journaliser("recapitulatif_commande_stand", "exception");
    return { ok: false, erreur: "erreur" };
  }
}

// Crée la Commande de Pass du Stand (2 Pass : l'exposant et son aide) à partir de la candidature acceptée. Le succès n'est annoncé qu'après la
// réponse réelle de la base (règle 13). Sans nom d'aide, le Pass de l'aide porte un nom provisoire à remplacer depuis « Mes Pass ».
export async function creerCommandeStand(
  deps: DependancesPaiementStand,
  entree: unknown,
  langue: "fr" | "en",
): Promise<ResultatPaiementStand<{ numero: string; expireLe: string }> | { ok: false; erreur: "total_change"; recap: RecapStand | null }> {
  const brut = (entree ?? {}) as { mention?: unknown };
  const lu = creationSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: brut.mention !== true ? "mention" : "invalide" };
  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };
  try {
    const nomCompte = await deps.nomDuCompte(v.compte.compteId);
    const nomTitulaire = (nomCompte ?? lu.data.nomTitulaire ?? "").replace(/\s+/g, " ").trim();
    if (!nomValable(nomTitulaire)) return { ok: false, erreur: "titulaire" };
    const aideSaisie = (lu.data.nomAide ?? "").replace(/\s+/g, " ").trim();
    if (aideSaisie !== "" && !nomValable(aideSaisie)) return { ok: false, erreur: "titulaire" };
    const aideASaisir = aideSaisie === "";
    const nomAide = aideASaisir ? await deps.nomAideProvisoire(langue) : aideSaisie;
    const code = lu.data.code?.trim() || null;
    const r = await deps.creerCommande({
      auteur: v.compte.auteur,
      candidatureId: lu.data.candidatureId,
      acceptations: [{ objet: "pass_photos_video", version: VERSION_PASS_PHOTOS }],
      totalAttenduCents: lu.data.totalAttenduCents,
      cleIdempotence: lu.data.cleIdempotence,
      nomTitulaire,
      nomAide,
      aideASaisir,
      code,
    });
    if ("erreur" in r) {
      const erreur = erreurPaiementDeLaBase(r.erreur);
      if (erreur === "total_change") {
        const nouveau = await lireRecapitulatifStand(deps, { candidatureId: lu.data.candidatureId, code }, langue);
        return { ok: false, erreur, recap: nouveau.ok ? nouveau.recap : null };
      }
      if (erreur === "erreur") journaliser("creer_commande_stand", "échec");
      return { ok: false, erreur };
    }
    return { ok: true, numero: r.numero, expireLe: r.expireLe };
  } catch {
    journaliser("creer_commande_stand", "exception");
    return { ok: false, erreur: "erreur" };
  }
}

const TABLE_AIDE: ReadonlyArray<readonly [string, ErreurNommerAide]> = [
  ["KS_TITULAIRE_INVALIDE", "nom_invalide"],
  ["KS_PASS_INTROUVABLE", "introuvable"],
  ["KS_NOM_DEJA_SAISI", "deja_saisi"],
  ["KS_EVENEMENT_COMMENCE", "evenement_commence"],
  ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
  ["KS_AUTEUR_INVALIDE", "non_connecte"],
];

// Nom de l'aide d'un Stand, saisi depuis « Mes Pass » : une seule fois, jusqu'au début de l'Événement. Le Compte vient de la session ; la base
// revérifie la propriété du Pass, le nom, la date et le fait qu'il reste à saisir.
export async function nommerAide(deps: DependancesNommerAide, entree: unknown): Promise<ResultatNommerAide> {
  const lu = z.object({ passId: z.uuid(), nom: z.string().max(200) }).safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  const nom = lu.data.nom.replace(/\s+/g, " ").trim();
  if (!nomValable(nom)) return { ok: false, erreur: "nom_invalide" };
  try {
    const compte = await deps.compte();
    if ("erreur" in compte) return { ok: false, erreur: compte.erreur };
    const { erreur } = await deps.nommer({ auteur: compte.auteur, passId: lu.data.passId, nom });
    if (erreur) return { ok: false, erreur: TABLE_AIDE.find(([code]) => erreur.includes(code))?.[1] ?? "generique" };
    return { ok: true };
  } catch {
    journaliser("nommer_aide_pass", "exception");
    return { ok: false, erreur: "generique" };
  }
}
