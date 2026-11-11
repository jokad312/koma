import { z } from "zod";
import {
  MOTIF_APPAREIL,
  TAILLE_LOT_SYNCHRO,
  type BilanSynchro,
  type ErreurHorsLigne,
  type EtatVerrou,
  type ListeTelechargee,
  type ResultatEtat,
  type ResultatForcage,
  type ResultatLiberation,
  type ResultatPrise,
  type ResultatSynchroServeur,
} from "./hors-ligne-types";
import type { AuteurScan } from "./types";

// Verrou hors ligne (story 7.8, FR-36, AD-12) : service serveur avec dépendances injectées (en test, des faux nommés TEST_ les remplacent).
// Rien n'est jamais « réussi » sans la réponse réelle de la base (règle 13). Les erreurs ne gardent que le code KS_ : jamais un jeton, un code court,
// un nom, une empreinte ni un identifiant d'appareil dans les journaux.

export type RetourBase = { erreur: string | null; reponse: unknown };

// Forme attendue par synchroniser_scans.
export type ScanBase = { id: string; nature: "jeton" | "code"; empreinte: string; scanne_le: string };

export type DependancesHorsLigne = {
  // Droit de scanner CET Événement (Admin, ou bénévole dont l'accès est valable maintenant) : prise du Verrou, liste, état.
  exigerAcces: (evenementId: string) => Promise<{ auteur: AuteurScan }>;
  // Compte connecté seulement : la synchronisation et la libération restent possibles après la fin de la fenêtre du bénévole (la base vérifie que le
  // Verrou appartient bien à ce Compte et à cet appareil).
  exigerSession: () => Promise<{ auteur: AuteurScan }>;
  // Admin seulement (libération forcée) ; la base revérifie le rôle.
  exigerAdmin: () => Promise<{ auteur: AuteurScan }>;
  prendre: (a: { auteur: AuteurScan; evenementId: string; appareil: string }) => Promise<RetourBase>;
  telecharger: (a: { auteur: AuteurScan; evenementId: string; appareil: string }) => Promise<RetourBase>;
  synchroniser: (a: { auteur: AuteurScan; evenementId: string; appareil: string; scans: ScanBase[] }) => Promise<RetourBase>;
  liberer: (a: { auteur: AuteurScan; evenementId: string; appareil: string }) => Promise<RetourBase>;
  lireEtat: (a: { auteur: AuteurScan; evenementId: string; appareil: string }) => Promise<RetourBase>;
  forcer: (a: { auteur: AuteurScan; evenementId: string }) => Promise<RetourBase>;
  // Limite de débit en base (AD-22) et empreinte d'une valeur pour en faire une clé.
  consommerEssai: (a: { cle: string; fenetreSecondes: number; maximum: number }) => Promise<{ erreur: string | null; autorise: boolean }>;
  empreinteValeur: (valeur: string) => string;
};

// Débit : prises de Verrou par Compte, et lots de synchronisation (chacun d'au plus 200 scans) par Compte, sur 10 minutes.
const FENETRE_SECONDES = 600;
export const LIMITE_PRISES = 20;
export const LIMITE_LOTS = 100;

async function debitAutorise(deps: DependancesHorsLigne, auteur: AuteurScan, nom: string, maximum: number): Promise<ErreurHorsLigne | null> {
  try {
    const r = await deps.consommerEssai({ cle: `verrou:${nom}:${deps.empreinteValeur(auteur.id)}`, fenetreSecondes: FENETRE_SECONDES, maximum });
    if (r.erreur) {
      journaliser(`limite ${nom}`, r.erreur);
      return "generique";
    }
    return r.autorise ? null : "trop_d_essais";
  } catch (e) {
    journaliser(`limite ${nom} exception`, e);
    return "generique";
  }
}

const uuid = z.uuid();
const appareilSchema = z.string().regex(MOTIF_APPAREIL);
const scanSchema = z.object({
  id: z.uuid(),
  nature: z.enum(["jeton", "code"]),
  empreinte: z.string().regex(/^[0-9a-f]{64}$/),
  scanneLe: z.string().max(40).refine((d) => !Number.isNaN(Date.parse(d)), "date"),
});

function journaliser(contexte: string, erreur: unknown) {
  const brut = typeof erreur === "string" ? erreur : erreur instanceof Error ? erreur.message : "";
  console.error(`[scan-hors-ligne] ${contexte} : ${/KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue"}`);
}

function codeDepuisBase(erreur: string): ErreurHorsLigne {
  if (erreur.includes("KS_DROIT_REFUSE")) return "non_autorise";
  if (erreur.includes("KS_VERROU_PRIS")) return "verrou_pris";
  if (erreur.includes("KS_VERROU_ABSENT")) return "verrou_absent";
  if (erreur.includes("KS_VERROU_LIBERE_DE_FORCE")) return "verrou_libere_de_force";
  if (erreur.includes("KS_EVENEMENT_PASSE")) return "evenement_passe";
  if (erreur.includes("KS_LOT_TROP_GRAND")) return "lot_trop_grand";
  if (erreur.includes("KS_APPAREIL_INVALIDE")) return "appareil_invalide";
  if (erreur.includes("KS_EVENEMENT_INTROUVABLE")) return "evenement_invalide";
  return "generique";
}

type Droit = { auteur: AuteurScan } | { erreur: ErreurHorsLigne };

async function droit(lire: () => Promise<{ auteur: AuteurScan }>): Promise<Droit> {
  try {
    return { auteur: (await lire()).auteur };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "KS_NON_CONNECTE") return { erreur: "non_connecte" };
    if (code === "KS_DROIT_REFUSE") return { erreur: "non_autorise" };
    journaliser("droit", e);
    return { erreur: "generique" };
  }
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const HEX64 = /^[0-9a-f]{64}$/;

// Relit prudemment la liste rendue par la base : une forme inattendue n'est jamais devinée (null).
export function lireListe(brut: unknown): ListeTelechargee | null {
  if (!estObjet(brut)) return null;
  const { verrou_id, pris_le, expire_le, genere_le, evenement_fr, evenement_en, cle_code_court, types, pass } = brut;
  if (typeof verrou_id !== "string" || !uuid.safeParse(verrou_id).success) return null;
  if (typeof pris_le !== "string" || typeof expire_le !== "string" || typeof genere_le !== "string") return null;
  // Bornes : une réponse démesurée n'est jamais acceptée.
  if (typeof evenement_fr !== "string" || evenement_fr === "" || evenement_fr.length > 300) return null;
  if (typeof evenement_en === "string" && evenement_en.length > 300) return null;
  if (typeof pris_le === "string" && pris_le.length > 40) return null;
  if (Array.isArray(types) && types.length > 50) return null;
  if (Array.isArray(pass) && pass.length > 20000) return null;
  if (typeof cle_code_court !== "string" || !HEX64.test(cle_code_court)) return null;
  if (!Array.isArray(types) || !Array.isArray(pass)) return null;
  const typesLus: ListeTelechargee["types"] = [];
  for (const t of types) {
    if (!estObjet(t) || typeof t.fr !== "string" || t.fr.length > 200 || (typeof t.en === "string" && t.en.length > 200)) return null;
    typesLus.push({ fr: t.fr, en: typeof t.en === "string" && t.en.trim() !== "" ? t.en : null });
  }
  const passLus: ListeTelechargee["pass"] = [];
  for (const p of pass) {
    if (!estObjet(p) || typeof p.j !== "string" || !HEX64.test(p.j) || typeof p.c !== "string" || !HEX64.test(p.c)) return null;
    if (typeof p.n !== "string" || p.n === "" || p.n.length > 80 || !Number.isInteger(p.t) || (p.t as number) < 0 || (p.t as number) >= typesLus.length) return null;
    passLus.push({ j: p.j, c: p.c, n: p.n, t: p.t as number });
  }
  return {
    verrouId: verrou_id,
    prisLe: pris_le,
    expireLe: expire_le,
    genereLe: genere_le,
    evenementFr: evenement_fr,
    evenementEn: typeof evenement_en === "string" && evenement_en.trim() !== "" ? evenement_en : null,
    cleCodeCourt: cle_code_court,
    types: typesLus,
    pass: passLus,
  };
}

type Communes = { ok: true; evenementId: string; appareil: string } | { ok: false; erreur: ErreurHorsLigne };

function entreesCommunes(evenementId: unknown, appareil: unknown): Communes {
  const ev = uuid.safeParse(evenementId);
  if (!ev.success) return { ok: false, erreur: "evenement_invalide" };
  const ap = appareilSchema.safeParse(appareil);
  if (!ap.success) return { ok: false, erreur: "appareil_invalide" };
  return { ok: true, evenementId: ev.data, appareil: ap.data };
}

// Prend le Verrou (idempotent pour le même appareil) puis télécharge la liste. Un téléchargement en échec laisse le Verrou tenu : le même appel le reprend.
export async function prendreEtTelecharger(deps: DependancesHorsLigne, entree: { evenementId: unknown; appareil: unknown }): Promise<ResultatPrise> {
  const e = entreesCommunes(entree.evenementId, entree.appareil);
  if (!e.ok) return { ok: false, erreur: e.erreur };
  const d = await droit(() => deps.exigerAcces(e.evenementId));
  if ("erreur" in d) return { ok: false, erreur: d.erreur };
  const limite = await debitAutorise(deps, d.auteur, "prendre", LIMITE_PRISES);
  if (limite) return { ok: false, erreur: limite };
  try {
    const prise = await deps.prendre({ auteur: d.auteur, evenementId: e.evenementId, appareil: e.appareil });
    if (prise.erreur) {
      journaliser("prise", prise.erreur);
      return { ok: false, erreur: codeDepuisBase(prise.erreur) };
    }
    const retour = await deps.telecharger({ auteur: d.auteur, evenementId: e.evenementId, appareil: e.appareil });
    if (retour.erreur) {
      journaliser("liste", retour.erreur);
      return { ok: false, erreur: codeDepuisBase(retour.erreur) };
    }
    const liste = lireListe(retour.reponse);
    if (!liste) {
      journaliser("liste illisible", "");
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, liste };
  } catch (err) {
    journaliser("prise exception", err);
    return { ok: false, erreur: "generique" };
  }
}

function lireBilan(brut: unknown): BilanSynchro | null {
  if (!estObjet(brut)) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
  const appliques = n(brut.appliques);
  const conflits = n(brut.conflits);
  const inconnus = n(brut.inconnus);
  const invalides = n(brut.invalides);
  const dejaTraites = n(brut.deja_traites);
  if (appliques === null || conflits === null || inconnus === null || invalides === null || dejaTraites === null) return null;
  return { appliques, conflits, inconnus, invalides, dejaTraites };
}

// Applique un lot de scans faits hors ligne. Le lot est borné (200) ; chaque scan ne porte qu'une empreinte.
export async function synchroniserScans(deps: DependancesHorsLigne, entree: { evenementId: unknown; appareil: unknown; scans: unknown }): Promise<ResultatSynchroServeur> {
  const e = entreesCommunes(entree.evenementId, entree.appareil);
  if (!e.ok) return { ok: false, erreur: e.erreur };
  if (!Array.isArray(entree.scans)) return { ok: false, erreur: "generique" };
  if (entree.scans.length > TAILLE_LOT_SYNCHRO) return { ok: false, erreur: "lot_trop_grand" };
  const scans: ScanBase[] = [];
  for (const brut of entree.scans) {
    const s = scanSchema.safeParse(brut);
    if (!s.success) return { ok: false, erreur: "generique" };
    scans.push({ id: s.data.id, nature: s.data.nature, empreinte: s.data.empreinte, scanne_le: new Date(s.data.scanneLe).toISOString() });
  }
  const d = await droit(deps.exigerSession);
  if ("erreur" in d) return { ok: false, erreur: d.erreur };
  const limite = await debitAutorise(deps, d.auteur, "synchro", LIMITE_LOTS);
  if (limite) return { ok: false, erreur: limite };
  try {
    const retour = await deps.synchroniser({ auteur: d.auteur, evenementId: e.evenementId, appareil: e.appareil, scans });
    if (retour.erreur) {
      journaliser("synchronisation", retour.erreur);
      return { ok: false, erreur: codeDepuisBase(retour.erreur) };
    }
    const bilan = lireBilan(retour.reponse);
    if (!bilan) return { ok: false, erreur: "generique" };
    return { ok: true, bilan };
  } catch (err) {
    journaliser("synchronisation exception", err);
    return { ok: false, erreur: "generique" };
  }
}

export async function libererVerrou(deps: DependancesHorsLigne, entree: { evenementId: unknown; appareil: unknown }): Promise<ResultatLiberation> {
  const e = entreesCommunes(entree.evenementId, entree.appareil);
  if (!e.ok) return { ok: false, erreur: e.erreur };
  const d = await droit(deps.exigerSession);
  if ("erreur" in d) return { ok: false, erreur: d.erreur };
  try {
    const retour = await deps.liberer({ auteur: d.auteur, evenementId: e.evenementId, appareil: e.appareil });
    if (retour.erreur) {
      journaliser("libération", retour.erreur);
      return { ok: false, erreur: codeDepuisBase(retour.erreur) };
    }
    const statut = estObjet(retour.reponse) ? retour.reponse.statut : null;
    if (statut === "libere" || statut === "deja" || statut === "force") return { ok: true, statut };
    return { ok: false, erreur: "generique" };
  } catch (err) {
    journaliser("libération exception", err);
    return { ok: false, erreur: "generique" };
  }
}

export async function lireEtatVerrou(deps: DependancesHorsLigne, entree: { evenementId: unknown; appareil: unknown }): Promise<ResultatEtat> {
  const e = entreesCommunes(entree.evenementId, entree.appareil);
  if (!e.ok) return { ok: false, erreur: e.erreur };
  const d = await droit(() => deps.exigerAcces(e.evenementId));
  if ("erreur" in d) return { ok: false, erreur: d.erreur };
  try {
    const retour = await deps.lireEtat({ auteur: d.auteur, evenementId: e.evenementId, appareil: e.appareil });
    if (retour.erreur) {
      journaliser("état", retour.erreur);
      return { ok: false, erreur: codeDepuisBase(retour.erreur) };
    }
    if (!estObjet(retour.reponse)) return { ok: false, erreur: "generique" };
    const r = retour.reponse;
    let etat: EtatVerrou | null = null;
    if (r.etat === "libre") etat = { etat: "libre" };
    else if (r.etat === "autre") etat = { etat: "autre" };
    else if (r.etat === "moi" && typeof r.pris_le === "string" && typeof r.expire_le === "string") etat = { etat: "moi", prisLe: r.pris_le, expireLe: r.expire_le };
    return etat ? { ok: true, etat } : { ok: false, erreur: "generique" };
  } catch (err) {
    journaliser("état exception", err);
    return { ok: false, erreur: "generique" };
  }
}

// Libération forcée (Admin, appareil perdu) : le résultat n'existe qu'après la réponse de la base.
export async function forcerLiberation(deps: DependancesHorsLigne, entree: { evenementId: unknown }): Promise<ResultatForcage> {
  const ev = uuid.safeParse(entree.evenementId);
  if (!ev.success) return { ok: false, erreur: "evenement_invalide" };
  const d = await droit(deps.exigerAdmin);
  if ("erreur" in d) return { ok: false, erreur: d.erreur };
  try {
    const retour = await deps.forcer({ auteur: d.auteur, evenementId: ev.data });
    if (retour.erreur) {
      journaliser("libération forcée", retour.erreur);
      return { ok: false, erreur: codeDepuisBase(retour.erreur) };
    }
    const statut = estObjet(retour.reponse) ? retour.reponse.statut : null;
    if (statut === "force" || statut === "aucun") return { ok: true, statut };
    return { ok: false, erreur: "generique" };
  } catch (err) {
    journaliser("libération forcée exception", err);
    return { ok: false, erreur: "generique" };
  }
}
