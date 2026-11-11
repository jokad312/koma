import { CODES_REFUSES } from "@/modules/commande/types";
import type { CodePromoRecap } from "@/modules/commande/types";
import { creerCommandePassSchema, recapitulatifPassSchema } from "./achat-schemas";
import type { EntreeCreerCommandePass, EntreeRecapitulatifPass } from "./achat-schemas";
import { VERSION_PASS_PHOTOS } from "./achat-types";
import type { CodeErreurAchat, DependancesAchat, LignePassBase, RecapPass, RecapPassBrut, ResultatAchat } from "./achat-types";

// Seul le code de l'erreur est journalisé : ni identifiant de Compte, ni nom de titulaire.
function journaliser(contexte: string, code: string) {
  console.error(`[achat-pass] ${contexte} : ${code}`);
}

const CODES_BASE: ReadonlyArray<readonly [string, CodeErreurAchat]> = [
  ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
  ["KS_AUTEUR_INVALIDE", "non_connecte"],
  ["KS_AUTEUR_MANQUANT", "non_connecte"],
  ["KS_PASS_INVALIDE", "invalide"],
  ["KS_TITULAIRE_INVALIDE", "titulaire"],
  ["KS_ACCEPTATION_MANQUANTE", "mention"],
  ["KS_COMPLET", "complet"],
  ["KS_VENTE_FERMEE", "vente_fermee"],
  ["KS_EVENEMENT_INTROUVABLE", "evenement_introuvable"],
  ["KS_TYPE_PASS_INTROUVABLE", "type_introuvable"],
  ["KS_STAND_SUR_CANDIDATURE", "stand"],
  ["KS_PASS_GRATUIT", "gratuit"],
  ["KS_COMMANDE_EN_ATTENTE", "commande_en_attente"],
  ["KS_TOTAL_CHANGE", "total_change"],
  ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
  ["KS_CLE_IDEMPOTENCE_INVALIDE", "invalide"],
  ["KS_ORIGINE_INVALIDE", "invalide"],
  ["KS_CODE_INCONNU", "code_inconnu"],
  ["KS_CODE_INACTIF", "code_inactif"],
  ["KS_CODE_PLAFOND", "code_plafond"],
  ["KS_CODE_PREMIER_ACHAT", "code_premier_achat"],
  ["KS_CODE_UN_SEUL", "code_un_seul"],
  ["KS_CODE_TOTAL_NUL", "code_total_nul"],
];

export function codeDeLaBase(message: string): CodeErreurAchat {
  return CODES_BASE.find(([code]) => message.includes(code))?.[1] ?? "erreur";
}

type Compte = Awaited<ReturnType<DependancesAchat["exigerCompte"]>>;

async function compteVerifie(deps: DependancesAchat): Promise<{ compte: Compte } | { erreur: CodeErreurAchat }> {
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

// Espaces réduits, comme la base (qui revérifie tout) : le serveur ne garde que des noms propres.
function nettoyerNom(nom: string): string {
  return nom.replace(/\s+/g, " ").trim();
}

// Lignes envoyées à la base. Le Pass de l'acheteur (premier nom de la première ligne) reprend le nom du Compte quand il est connu :
// le navigateur ne décide pas de ce nom-là. Sans nom de Compte, le nom saisi est gardé (jamais inventé).
async function preparerLignes(
  deps: DependancesAchat,
  compteId: string,
  entree: { lignes: { typePassId: string; titulaires: string[] }[]; pourMoi: boolean },
): Promise<LignePassBase[]> {
  const nomCompte = entree.pourMoi ? await deps.nomDuCompte(compteId) : null;
  return entree.lignes.map((l, i) => ({
    type_pass_id: l.typePassId,
    titulaires: l.titulaires.map((nom, j) => (i === 0 && j === 0 && nomCompte ? nettoyerNom(nomCompte) : nettoyerNom(nom))),
  }));
}

function enCodeRecap(c: RecapPassBrut["code"]): CodePromoRecap | null {
  if (!c) return null;
  if (c.valide && typeof c.code === "string") return { valide: true, code: c.code, reductionPct: Number(c.reduction_pct ?? 0) };
  const erreur = CODES_REFUSES.find((e) => e === c.erreur) ?? "code_inconnu";
  return { valide: false, erreur };
}

function enRecap(b: RecapPassBrut, langue: "fr" | "en"): RecapPass {
  return {
    lignes: b.lignes.map((l) => ({
      typePassId: l.type_pass_id,
      nom: langue === "en" && l.nom_en ? l.nom_en : l.nom_fr,
      nombre: l.nombre,
      prixCents: l.prix_cents,
      reductionCents: l.reduction_cents ?? 0,
      titulaires: l.titulaires,
    })),
    personnes: b.personnes,
    sousTotalCents: b.sous_total_cents,
    reductionCents: b.reduction_cents ?? 0,
    code: enCodeRecap(b.code),
    totalCents: b.total_cents,
  };
}

// Récapitulatif de Pass (UX-DR32) : Types, noms, prix USD et total calculés par la base à chaque appel (règle 3). Aucune écriture.
export async function lireRecapitulatifPass(deps: DependancesAchat, entree: EntreeRecapitulatifPass, langue: "fr" | "en"): Promise<ResultatAchat<{ recap: RecapPass }>> {
  const lu = recapitulatifPassSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };
  try {
    const lignes = await preparerLignes(deps, v.compte.compteId, lu.data);
    const r = await deps.recapitulatif({ compteId: v.compte.compteId, evenementId: lu.data.evenementId, lignes, code: lu.data.code?.trim() || null });
    if ("erreur" in r) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("recapitulatif_commande_pass", "échec");
      return { ok: false, erreur };
    }
    return { ok: true, recap: enRecap(r.recap, langue) };
  } catch {
    journaliser("recapitulatif_commande_pass", "exception");
    return { ok: false, erreur: "erreur" };
  }
}

// Crée la Commande de Pass en attente (FR-33, AD-7). Jamais depuis le Panier. Le total vu est comparé au total relu : s'il diffère, rien n'est
// créé et le nouveau Récapitulatif est renvoyé. Le succès n'est annoncé qu'après la réponse réelle de la base (règle 13).
export async function creerCommandePass(
  deps: DependancesAchat,
  entree: EntreeCreerCommandePass,
  langue: "fr" | "en",
): Promise<ResultatAchat<{ numero: string; expireLe: string }> | { ok: false; erreur: "total_change"; recap: RecapPass | null }> {
  const lu = creerCommandePassSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: entree?.mention !== true ? "mention" : "invalide" };
  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };
  try {
    const lignes = await preparerLignes(deps, v.compte.compteId, lu.data);
    const code = lu.data.code?.trim() || null;
    const r = await deps.creerCommande({
      auteur: v.compte.auteur,
      evenementId: lu.data.evenementId,
      lignes,
      acceptations: [{ objet: "pass_photos_video", version: VERSION_PASS_PHOTOS }],
      totalAttenduCents: lu.data.totalAttenduCents,
      cleIdempotence: lu.data.cleIdempotence,
      code,
    });
    if ("erreur" in r) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "total_change") {
        const nouveau = await lireRecapitulatifPass(deps, { evenementId: lu.data.evenementId, lignes: lu.data.lignes, pourMoi: lu.data.pourMoi, code }, langue);
        return { ok: false, erreur, recap: nouveau.ok ? nouveau.recap : null };
      }
      if (erreur === "erreur") journaliser("creer_commande_pass", "échec");
      return { ok: false, erreur };
    }
    return { ok: true, numero: r.numero, expireLe: r.expireLe };
  } catch {
    journaliser("creer_commande_pass", "exception");
    return { ok: false, erreur: "erreur" };
  }
}
