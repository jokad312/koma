import { extraireJeton } from "@/modules/evenements/pass-charge";
import { codeCourtValide, normaliserCodeCourt } from "./code-court";
import { empreinteCodeCourt, empreinteJeton, nouvelIdScan } from "./empreintes";
import type { EntreeListe } from "./hors-ligne-types";
import type { ListeLocale, ScanLocal, Stockage } from "./stockage-hors-ligne";
import type { ResultatScan } from "./types";

// Comparaison locale du Scan hors ligne (story 7.8). Même résultat VALIDE / REFUSÉ que le scan en ligne (story 7.6) : le même composant l'affiche.
// Le jeton lu sur le Code QR n'existe que le temps du calcul de son empreinte ; il n'est ni gardé, ni affiché, ni journalisé.

export type ListeIndexee = {
  liste: ListeLocale;
  parJeton: Map<string, EntreeListe>;
  parCode: Map<string, EntreeListe>;
};

export function indexerListe(liste: ListeLocale): ListeIndexee {
  const parJeton = new Map<string, EntreeListe>();
  const parCode = new Map<string, EntreeListe>();
  for (const e of liste.pass) {
    parJeton.set(e.j, e);
    parCode.set(e.c, e);
  }
  return { liste, parJeton, parCode };
}

export type DependancesLocales = {
  stockage: Pick<Stockage, "enregistrerScan">;
  maintenant: () => Date;
  nouvelId?: () => string;
  langue: "fr" | "en";
};

export type EntreeLocale = { charge: string } | { code: string };

const refus = (raison: Extract<ResultatScan, { resultat: "refuse" }>["raison"], scanneLe: string | null = null): ResultatScan => ({ ok: true, resultat: "refuse", raison, scanneLe });

// Saisie à la main hors ligne : un frein, pas une défense. Au plus 10 essais par fenêtre de 10 minutes sur cet appareil (la saisie en ligne est limitée par
// la base). Contre un appareil volé, la protection est la clé du HMAC (voir scan_hors_ligne.sql), pas ce compteur.
export function creerLimiteurEssais(maximum = 10, fenetreMs = 600_000) {
  let essais: number[] = [];
  return {
    autoriser(maintenant: number): boolean {
      essais = essais.filter((t) => maintenant - t < fenetreMs);
      if (essais.length >= maximum) return false;
      essais.push(maintenant);
      return true;
    },
  };
}

// Un scan contre la liste locale. VALIDE n'est rendu qu'après l'écriture du scan dans IndexedDB : si elle échoue, ni VALIDE ni REFUSÉ, une erreur (le Pass ne doit
// jamais être accepté sans que l'appareil puisse se souvenir de l'avoir accepté).
export async function scannerLocalement(deps: DependancesLocales, idx: ListeIndexee, entree: EntreeLocale): Promise<ResultatScan> {
  const { liste } = idx;
  const maintenant = deps.maintenant();
  if (maintenant.getTime() >= Date.parse(liste.expireLe)) return { ok: false, erreur: "liste_expiree" };

  let nature: "jeton" | "code";
  let empreinte: string;
  let trouve: EntreeListe | undefined;
  if ("charge" in entree) {
    const jeton = extraireJeton(entree.charge);
    if (!jeton) return refus("qr_invalide");
    nature = "jeton";
    empreinte = await empreinteJeton(jeton);
    trouve = idx.parJeton.get(empreinte);
  } else {
    const code = normaliserCodeCourt(entree.code);
    if (!codeCourtValide(code)) return refus("inconnu");
    nature = "code";
    empreinte = await empreinteCodeCourt(code, liste.cle);
    trouve = idx.parCode.get(empreinte);
  }

  const id = (deps.nouvelId ?? nouvelIdScan)();
  const base = { id, evenementId: liste.evenementId, nature, empreinte, scanneLe: maintenant.toISOString(), origine: "hors_ligne" as const, synchronise: 0 as const };
  try {
    if (!trouve) {
      // Un Pass vendu après le téléchargement de la liste, annulé ou déjà scanné en ligne n'y figure pas : « inconnu » hors ligne.
      await deps.stockage.enregistrerScan({ ...base, resultat: "refuse", raison: "inconnu" });
      return refus("inconnu");
    }
    const scan: ScanLocal = { ...base, passJ: trouve.j, cleDoublon: `${liste.evenementId}|${trouve.j}`, resultat: "valide" };
    const r = await deps.stockage.enregistrerScan(scan);
    if (r.statut === "deja") return refus("deja_scanne", r.scanneLe);
  } catch {
    return { ok: false, erreur: "stockage" };
  }

  const en = deps.langue === "en";
  const type = liste.types[trouve.t];
  return {
    ok: true,
    resultat: "valide",
    nom: trouve.n,
    evenement: (en ? liste.evenementEn : null) ?? liste.evenementFr,
    typePass: (en ? type?.en : null) ?? type?.fr ?? "",
  };
}

// Un Pass accepté EN LIGNE par l'appareil qui tient le Verrou est aussi noté localement (déjà connu du serveur) : hors ligne, la liste le croirait encore
// valide. Une erreur ici est sans effet sur le verdict déjà affiché ; elle est avalée.
export async function noterScanEnLigne(deps: DependancesLocales, idx: ListeIndexee, entree: EntreeLocale): Promise<void> {
  try {
    let trouve: EntreeListe | undefined;
    let nature: "jeton" | "code";
    let empreinte: string;
    if ("charge" in entree) {
      const jeton = extraireJeton(entree.charge);
      if (!jeton) return;
      nature = "jeton";
      empreinte = await empreinteJeton(jeton);
      trouve = idx.parJeton.get(empreinte);
    } else {
      const code = normaliserCodeCourt(entree.code);
      if (!codeCourtValide(code)) return;
      nature = "code";
      empreinte = await empreinteCodeCourt(code, idx.liste.cle);
      trouve = idx.parCode.get(empreinte);
    }
    if (!trouve) return;
    await deps.stockage.enregistrerScan({
      id: (deps.nouvelId ?? nouvelIdScan)(),
      evenementId: idx.liste.evenementId,
      passJ: trouve.j,
      cleDoublon: `${idx.liste.evenementId}|${trouve.j}`,
      nature,
      empreinte,
      scanneLe: deps.maintenant().toISOString(),
      origine: "en_ligne",
      resultat: "valide",
      synchronise: 1,
    });
  } catch {
    // Sans effet sur le verdict déjà donné par le serveur.
  }
}
