import { extraireJeton } from "@/modules/evenements/pass-charge";
import { MOTIF_APPAREIL } from "./hors-ligne-types";
import { codeCourtValide, normaliserCodeCourt } from "./code-court";
import type { AuteurScan, DependancesScan, EntreeScan, ReponseScanBase, ResultatScan } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Fenêtre fixe de 10 minutes (AD-22). La saisie à la main est la seule voie qu'un humain peut essayer au hasard ; le Code QR n'est pas limité.
const FENETRE_CODE_SECONDES = 600;
// Par auteur : large pour une file d'entrée à la main (plusieurs codes à la suite), serré pour qui essaie des codes au hasard.
export const LIMITE_CODE_PAR_AUTEUR = 40;
// Par adresse IP : plus large, plusieurs bénévoles peuvent partager le même réseau.
export const LIMITE_CODE_PAR_IP = 150;

// Seule la cause est journalisée : le code KS_, jamais une saisie, un jeton ni un nom.
function journaliser(contexte: string, erreur: unknown) {
  const brut = typeof erreur === "string" ? erreur : erreur instanceof Error ? erreur.message : "";
  console.error(`[scan] ${contexte} : ${/KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue"}`);
}

const GENERIQUE: ResultatScan = { ok: false, erreur: "generique" };

// Relit prudemment la réponse de scanner_pass ; null si sa forme n'est pas celle attendue (jamais un « valide » deviné).
export function lireReponse(brut: unknown): ReponseScanBase | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const r = brut as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
  if (r.resultat === "valide") {
    const nom = texte(r.nom);
    const evenementFr = texte(r.evenement_fr);
    const typePassFr = texte(r.type_pass_fr);
    if (!nom || !evenementFr || !typePassFr) return null;
    return { resultat: "valide", nom, evenementFr, evenementEn: texte(r.evenement_en), typePassFr, typePassEn: texte(r.type_pass_en) };
  }
  if (r.resultat === "refuse") {
    const raisons = ["inconnu", "deja_scanne", "annule", "rembourse", "autre_evenement", "commande_non_payee"] as const;
    const raison = raisons.find((x) => x === r.raison);
    if (!raison) return null;
    return { resultat: "refuse", raison, scanneLe: raison === "deja_scanne" ? texte(r.scanne_le) : null };
  }
  return null;
}

// Un scan : validation de la saisie, droit, limite (code court seulement), puis scanner_pass (une transaction, verrou de ligne). « valide » n'est rendu
// qu'après la réponse réelle de la base (règle 13). Un Code QR dont la charge n'est pas « KOMA:PASS:<jeton> » est refusé sans appel à la base.
export async function scannerPass(deps: DependancesScan, entree: EntreeScan): Promise<ResultatScan> {
  if (typeof entree.evenementId !== "string" || !UUID.test(entree.evenementId)) return { ok: false, erreur: "evenement_invalide" };
  const langueEn = entree.langue === "en";
  const charge = typeof entree.charge === "string" ? entree.charge : null;
  const saisie = typeof entree.code === "string" ? entree.code : null;
  if ((charge === null) === (saisie === null)) return { ok: false, erreur: "saisie_invalide" };
  if ((charge !== null && charge.length > 200) || (saisie !== null && saisie.length > 64)) return { ok: false, erreur: "saisie_invalide" };

  let auteur: AuteurScan;
  try {
    ({ auteur } = await deps.exigerAcces(entree.evenementId));
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "KS_NON_CONNECTE") return { ok: false, erreur: "non_connecte" };
    if (code === "KS_DROIT_REFUSE") return { ok: false, erreur: "non_autorise" };
    journaliser("droit", e);
    return GENERIQUE;
  }

  try {
    let jeton: string | null = null;
    let code: string | null = null;
    if (charge !== null) {
      jeton = extraireJeton(charge);
      if (!jeton) return { ok: true, resultat: "refuse", raison: "qr_invalide", scanneLe: null };
    } else {
      code = normaliserCodeCourt(saisie ?? "");
      const essaiAuteur = await deps.consommerEssai({
        cle: `scan:code:auteur:${deps.empreinteValeur(auteur.id)}`,
        fenetreSecondes: FENETRE_CODE_SECONDES,
        maximum: LIMITE_CODE_PAR_AUTEUR,
      });
      if (essaiAuteur.erreur) {
        journaliser("limite auteur", essaiAuteur.erreur);
        return GENERIQUE;
      }
      if (!essaiAuteur.autorise) return { ok: false, erreur: "trop_d_essais" };
      const empreinte = await deps.empreinteClient();
      const essaiIp = await deps.consommerEssai({ cle: `scan:code:ip:${empreinte ?? "commun"}`, fenetreSecondes: FENETRE_CODE_SECONDES, maximum: LIMITE_CODE_PAR_IP });
      if (essaiIp.erreur) {
        journaliser("limite ip", essaiIp.erreur);
        return GENERIQUE;
      }
      if (!essaiIp.autorise) return { ok: false, erreur: "trop_d_essais" };
      // Mal formé : « inconnu », comme un code absent (aucune différence visible), sans appel à la base.
      if (!codeCourtValide(code)) return { ok: true, resultat: "refuse", raison: "inconnu", scanneLe: null };
    }

    const appareil = typeof entree.appareil === "string" && MOTIF_APPAREIL.test(entree.appareil) ? entree.appareil : null;
    const { erreur, reponse } = await deps.scanner({ auteur, evenementId: entree.evenementId, jeton, code, appareil });
    if (erreur) {
      journaliser("scan", erreur);
      if (erreur.includes("KS_DROIT_REFUSE")) return { ok: false, erreur: "non_autorise" };
      if (erreur.includes("KS_SCAN_VERROUILLE")) return { ok: false, erreur: "verrouille" };
      return GENERIQUE;
    }
    if (!reponse) return GENERIQUE;
    if (reponse.resultat === "valide") {
      return {
        ok: true,
        resultat: "valide",
        nom: reponse.nom,
        evenement: (langueEn ? reponse.evenementEn : null) ?? reponse.evenementFr,
        typePass: (langueEn ? reponse.typePassEn : null) ?? reponse.typePassFr,
      };
    }
    return { ok: true, resultat: "refuse", raison: reponse.raison, scanneLe: reponse.scanneLe };
  } catch (e) {
    journaliser("exception", e);
    return GENERIQUE;
  }
}
