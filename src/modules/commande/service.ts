import {
  creerCommandeSchema,
  obtenirKitGratuitSchema,
  recapitulatifSchema,
  VERSION_CGV,
  VERSION_KIT_ACCES,
  VERSION_LICENCE_KIT,
  VERSION_SUR_MESURE,
} from "./schemas";
import type { EntreeCreerCommande, EntreeObtenirKitGratuit, EntreeRecapitulatif } from "./schemas";
import { CODES_REFUSES } from "./types";
import type { CodeErreurCommande, CodePromoRecap, DependancesCommande, LigneRecap, RecapBrut, Recapitulatif, ResultatCommande } from "./types";

// Seul le code de l'erreur est journalisé : ni identifiant de Compte, ni donnée personnelle.
function journaliser(contexte: string, code: string) {
  console.error(`[commande] ${contexte} : ${code}`);
}

const CODES_BASE: [string, CodeErreurCommande][] = [
  ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
  ["KS_ACCEPTATION_MANQUANTE", "licence"],
  ["KS_KIT_DEJA_POSSEDE", "deja_possede"],
  ["KS_KIT_NON_GRATUIT", "indisponible"],
  ["KS_PRODUIT_INTROUVABLE", "indisponible"],
  ["KS_PRODUIT_GRATUIT", "indisponible"],
  ["KS_INDISPONIBLE", "indisponible"],
  ["KS_CLE_IDEMPOTENCE_INVALIDE", "invalide"],
  ["KS_TELEPHONE_INVALIDE", "telephone"],
  ["KS_ADRESSE_MANQUANTE", "adresse"],
  ["KS_REMISE_MANQUANTE", "remise"],
  ["KS_REMISE_INVALIDE", "remise"],
  ["KS_TOTAL_CHANGE", "total_change"],
  ["KS_RECAP_CHANGE", "recap_change"],
  ["KS_COMMANDE_EN_ATTENTE", "commande_en_attente"],
  ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
  ["KS_PANIER_VIDE", "panier_vide"],
  ["KS_PANIER_INTROUVABLE", "panier_introuvable"],
  ["KS_ORIGINE_INVALIDE", "invalide"],
  ["KS_CODE_INCONNU", "code_inconnu"],
  ["KS_CODE_INACTIF", "code_inactif"],
  ["KS_CODE_PLAFOND", "code_plafond"],
  ["KS_CODE_PREMIER_ACHAT", "code_premier_achat"],
  ["KS_CODE_UN_SEUL", "code_un_seul"],
  ["KS_CODE_TOTAL_NUL", "code_total_nul"],
];

function codeDeLaBase(message: string): CodeErreurCommande {
  for (const [code, erreur] of CODES_BASE) if (message.includes(code)) return erreur;
  return "erreur";
}

type Compte = { compteId: string; auteur: import("@/lib/auth/auteur").Auteur };

// Session vérifiée et Compte complet, sinon le code d'erreur à montrer.
async function compteVerifie(deps: DependancesCommande): Promise<{ compte: Compte } | { erreur: CodeErreurCommande }> {
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

// Obtient le Kit gratuit d'un geste (FR-58). Le Compte vient de la session vérifiée, jamais de la saisie ; la base refuse tout le reste
// (Licence non acceptée, Kit payant, Kit non publié, Kit déjà possédé). Un succès n'est annoncé qu'après la réponse réelle de la base (règle 13).
export async function obtenirKitGratuit(deps: DependancesCommande, entree: EntreeObtenirKitGratuit): Promise<ResultatCommande<{ numero: string }>> {
  const lu = obtenirKitGratuitSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: entree?.licenceAcceptee !== true ? "licence" : "invalide" };

  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };

  try {
    const r = await deps.offrirCommande({
      auteur: v.compte.auteur,
      produitId: lu.data.produitId,
      acceptations: [{ objet: "licence_kit", version: VERSION_LICENCE_KIT }],
      cleIdempotence: lu.data.cleIdempotence,
    });
    if (r.erreur) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("offrir_commande", "échec");
      return { ok: false, erreur };
    }
    if (!r.numero) return { ok: false, erreur: "erreur" };
    return { ok: true, numero: r.numero };
  } catch {
    journaliser("offrir_commande", "exception");
    return { ok: false, erreur: "erreur" };
  }
}

const ETATS_RECAP = ["disponible", "sur_commande", "epuise"] as const;

// Code promo tel que la base l'a évalué : seuls les champs connus sont repris (jamais le taux de commission, qui ne quitte pas le serveur).
function enCodeRecap(c: RecapBrut["code"]): CodePromoRecap | null {
  if (!c) return null;
  if (c.valide && typeof c.code === "string") return { valide: true, code: c.code, reductionPct: Number(c.reduction_pct ?? 0) };
  const erreur = CODES_REFUSES.find((e) => e === c.erreur) ?? "code_inconnu";
  return { valide: false, erreur };
}

function enRecap(b: RecapBrut, langue: "fr" | "en"): Recapitulatif {
  const lignes = b.lignes
    .map((l): LigneRecap | null => {
      const etat = ETATS_RECAP.find((e) => e === l.etat);
      const famille = l.famille === "cosplay" || l.famille === "accessoire" || l.famille === "kit" ? l.famille : null;
      if (!etat || !famille) return null;
      return {
        ligneId: l.ligne_id,
        produitId: l.produit_id,
        famille,
        slug: l.slug,
        titre: langue === "en" && l.titre_en ? l.titre_en : l.titre_fr,
        taille: l.taille,
        nombre: l.nombre,
        prixCents: l.prix_cents ?? 0,
        etat,
        origine: l.origine === "stock" || l.origine === "fabrication" ? l.origine : null,
        delaiFabricationJours: l.delai_fabrication_jours,
        reductionCents: l.reduction_cents ?? 0,
      };
    })
    .filter((l): l is LigneRecap => l !== null);
  return {
    lignes,
    physique: b.physique,
    kit: b.kit,
    surMesure: b.sur_mesure,
    sousTotalCents: b.sous_total_cents,
    forfaitCents: b.forfait_cents,
    reductionCents: b.reduction_cents ?? 0,
    code: enCodeRecap(b.code),
    totalCents: b.total_cents,
    indisponible: b.indisponible || lignes.length < b.lignes.length,
    remiseManquante: b.remise_manquante,
    empreinte: b.empreinte,
  };
}

// Récapitulatif de la commande : prix, Forfait, total et délais relus en base à chaque appel (FR-14, UX-DR32, règle 3).
export async function lireRecapitulatif(
  deps: DependancesCommande,
  entree: EntreeRecapitulatif,
  langue: "fr" | "en",
): Promise<ResultatCommande<{ recap: Recapitulatif }>> {
  const lu = recapitulatifSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "remise" };
  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };
  try {
    const panierId = await deps.panierDuCompte(v.compte.compteId);
    if (!panierId) return { ok: false, erreur: "panier_vide" };
    const r = await deps.recapitulatif({ compteId: v.compte.compteId, panierId, zone: lu.data.zone ?? null, mode: lu.data.mode ?? null, code: lu.data.code?.trim() || null });
    if ("erreur" in r) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("recapitulatif_commande", "échec");
      return { ok: false, erreur };
    }
    return { ok: true, recap: enRecap(r.recap, langue) };
  } catch {
    journaliser("recapitulatif_commande", "exception");
    return { ok: false, erreur: "erreur" };
  }
}

// Crée la Commande en attente (FR-13, AD-8). Tout est relu en base ; le total que le client a vu est comparé au total relu : s'il diffère,
// rien n'est créé et le nouveau Récapitulatif est renvoyé pour une nouvelle confirmation. Le succès n'est annoncé qu'après la réponse réelle de la base.
export async function creerCommande(
  deps: DependancesCommande,
  entree: EntreeCreerCommande,
  langue: "fr" | "en",
): Promise<ResultatCommande<{ numero: string; expireLe: string }> | { ok: false; erreur: "total_change" | "recap_change"; recap: Recapitulatif | null }> {
  const lu = creerCommandeSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  const v = await compteVerifie(deps);
  if ("erreur" in v) return { ok: false, erreur: v.erreur };
  try {
    const panierId = await deps.panierDuCompte(v.compte.compteId);
    if (!panierId) return { ok: false, erreur: "panier_vide" };
    const a = lu.data.acceptations;
    const acceptations: { objet: string; version: string }[] = [];
    if (a.cgv) acceptations.push({ objet: "cgv", version: VERSION_CGV });
    if (a.kit) acceptations.push({ objet: "kit_acces_immediat", version: VERSION_KIT_ACCES });
    if (a.surMesure) acceptations.push({ objet: "sur_mesure", version: VERSION_SUR_MESURE });
    const r = await deps.creerCommande({
      auteur: v.compte.auteur,
      panierId,
      zone: lu.data.zone ?? null,
      mode: lu.data.mode ?? null,
      telephone: lu.data.telephone ?? null,
      adresse: lu.data.adresse ?? null,
      acceptations,
      origine: lu.data.origine ?? null,
      totalAttenduCents: lu.data.totalAttenduCents,
      empreinte: lu.data.empreinte,
      cleIdempotence: lu.data.cleIdempotence,
      code: lu.data.code?.trim() || null,
    });
    if ("erreur" in r) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "total_change" || erreur === "recap_change") {
        const nouveau = await lireRecapitulatif(deps, { zone: lu.data.zone, mode: lu.data.mode, code: lu.data.code }, langue);
        return { ok: false, erreur, recap: nouveau.ok ? nouveau.recap : null };
      }
      if (erreur === "erreur") journaliser("creer_commande", "échec");
      // La base dit « licence » pour une acceptation manquante : sur l'étape de commande, c'est une case à cocher.
      return { ok: false, erreur: erreur === "licence" ? "acceptation" : erreur };
    }
    return { ok: true, numero: r.numero, expireLe: r.expireLe };
  } catch {
    journaliser("creer_commande", "exception");
    return { ok: false, erreur: "erreur" };
  }
}
