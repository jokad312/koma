import { nouvelIdentifiantAppareil } from "./empreintes";
import type { EntreeListe, ListeTelechargee, TypePassListe } from "./hors-ligne-types";

// Stockage du Scan hors ligne dans IndexedDB (story 7.8, AD-2 : seule écriture côté navigateur autorisée avec les téléversements signés, AD-12).
// Ce qui est gardé : la liste (empreintes, noms, Types de pass), la clé du HMAC des codes courts (CryptoKey NON extractible), l'identifiant de l'appareil et
// chaque scan (empreinte seulement). Jamais un jeton ni un code court, ni dans la liste ni dans les scans.
// La base est effacée pour un Événement à la libération du Verrou. Le fabricant IndexedDB est injecté (un faux nommé TEST_ en test).

const NOM_BASE = "koma-scan";
const VERSION = 1;
const MAGASIN_META = "meta";
const MAGASIN_LISTES = "listes";
const MAGASIN_SCANS = "scans";

export type ListeLocale = {
  evenementId: string;
  verrouId: string;
  prisLe: string;
  expireLe: string;
  genereLe: string;
  evenementFr: string;
  evenementEn: string | null;
  cle: CryptoKey;
  types: TypePassListe[];
  pass: EntreeListe[];
};

export type ScanLocal = {
  id: string;
  evenementId: string;
  // Empreinte du jeton du Pass dans la liste : identifie le Pass quelle que soit la façon dont il a été scanné (QR ou code court). Absent d'un refus.
  passJ?: string;
  // « evenementId|passJ » : un Pass n'est enregistré VALIDE qu'une fois par Événement sur cet appareil (index unique).
  cleDoublon?: string;
  nature: "jeton" | "code";
  empreinte: string;
  scanneLe: string;
  origine: "hors_ligne" | "en_ligne";
  resultat: "valide" | "refuse";
  raison?: string;
  // 0 : à envoyer au serveur ; 1 : déjà connu du serveur.
  synchronise: 0 | 1;
};

export type Stockage = {
  lireAppareil: () => Promise<string>;
  enregistrerListe: (liste: ListeLocale) => Promise<void>;
  lireListe: (evenementId: string) => Promise<ListeLocale | null>;
  // Enregistre un scan. Pour un scan VALIDE, vérifie et écrit dans UNE transaction : deux scans simultanés du même Pass n'en enregistrent qu'un.
  enregistrerScan: (scan: ScanLocal) => Promise<{ statut: "enregistre" } | { statut: "deja"; scanneLe: string }>;
  scansASynchroniser: (evenementId: string) => Promise<ScanLocal[]>;
  marquerSynchronises: (ids: string[]) => Promise<void>;
  compterEnAttente: (evenementId: string) => Promise<number>;
  // Efface la liste et les scans d'un Événement, SAUF les scans VALIDE faits hors ligne et pas encore envoyés (jamais perdus). Rend le nombre gardé.
  effacerEvenement: (evenementId: string) => Promise<number>;
  // Compte qui a ouvert l'écran en dernier : à un autre Compte, les listes (noms) sont effacées. Rend vrai si une purge a eu lieu.
  changerDeCompte: (compteId: string) => Promise<boolean>;
  fermer: () => void;
};

function promesse<T>(requete: IDBRequest<T>): Promise<T> {
  return new Promise((resolu, rejete) => {
    requete.onsuccess = () => resolu(requete.result);
    requete.onerror = () => rejete(requete.error ?? new Error("IndexedDB"));
  });
}

function terminee(tx: IDBTransaction): Promise<void> {
  return new Promise((resolu, rejete) => {
    tx.oncomplete = () => resolu();
    tx.onerror = () => rejete(tx.error ?? new Error("IndexedDB"));
    tx.onabort = () => rejete(tx.error ?? new Error("IndexedDB"));
  });
}

export function stockageDisponible(fabrique: IDBFactory | undefined = globalThis.indexedDB): boolean {
  return typeof fabrique !== "undefined" && fabrique !== null;
}

export async function ouvrirStockage(fabrique: IDBFactory | undefined = globalThis.indexedDB): Promise<Stockage> {
  if (!stockageDisponible(fabrique)) throw new Error("IndexedDB indisponible");
  const base = await new Promise<IDBDatabase>((resolu, rejete) => {
    const ouverture = (fabrique as IDBFactory).open(NOM_BASE, VERSION);
    ouverture.onupgradeneeded = () => {
      const db = ouverture.result;
      db.createObjectStore(MAGASIN_META, { keyPath: "cle" });
      db.createObjectStore(MAGASIN_LISTES, { keyPath: "evenementId" });
      const scans = db.createObjectStore(MAGASIN_SCANS, { keyPath: "id" });
      scans.createIndex("evenement", "evenementId", { unique: false });
      // Index unique : un Pass VALIDE par Événement. Les refus n'ont pas de clé et n'y entrent pas.
      scans.createIndex("doublon", "cleDoublon", { unique: true });
    };
    ouverture.onsuccess = () => resolu(ouverture.result);
    ouverture.onerror = () => rejete(ouverture.error ?? new Error("IndexedDB"));
    ouverture.onblocked = () => rejete(new Error("IndexedDB bloquée"));
  });

  return {
    async lireAppareil() {
      const lecture = base.transaction(MAGASIN_META, "readonly");
      const existant = (await promesse(lecture.objectStore(MAGASIN_META).get("appareil"))) as { valeur: string } | undefined;
      if (existant && /^[0-9a-f]{32}$/.test(existant.valeur)) return existant.valeur;
      const valeur = nouvelIdentifiantAppareil();
      const ecriture = base.transaction(MAGASIN_META, "readwrite");
      const magasin = ecriture.objectStore(MAGASIN_META);
      // Deux onglets : le premier arrivé gagne, l'autre relit.
      const deja = (await promesse(magasin.get("appareil"))) as { valeur: string } | undefined;
      if (deja && /^[0-9a-f]{32}$/.test(deja.valeur)) return deja.valeur;
      magasin.put({ cle: "appareil", valeur });
      await terminee(ecriture);
      return valeur;
    },
    async enregistrerListe(liste) {
      const tx = base.transaction(MAGASIN_LISTES, "readwrite");
      tx.objectStore(MAGASIN_LISTES).put(liste);
      await terminee(tx);
    },
    async lireListe(evenementId) {
      const tx = base.transaction(MAGASIN_LISTES, "readonly");
      const liste = (await promesse(tx.objectStore(MAGASIN_LISTES).get(evenementId))) as ListeLocale | undefined;
      return liste ?? null;
    },
    async enregistrerScan(scan) {
      const tx = base.transaction(MAGASIN_SCANS, "readwrite");
      const magasin = tx.objectStore(MAGASIN_SCANS);
      if (scan.resultat === "valide" && scan.cleDoublon) {
        const premier = (await promesse(magasin.index("doublon").get(scan.cleDoublon))) as ScanLocal | undefined;
        if (premier) {
          await terminee(tx);
          return { statut: "deja", scanneLe: premier.scanneLe };
        }
      }
      magasin.add(scan);
      await terminee(tx);
      return { statut: "enregistre" };
    },
    async scansASynchroniser(evenementId) {
      const tx = base.transaction(MAGASIN_SCANS, "readonly");
      const tous = (await promesse(tx.objectStore(MAGASIN_SCANS).index("evenement").getAll(evenementId))) as ScanLocal[];
      return tous.filter((s) => s.origine === "hors_ligne" && s.resultat === "valide" && s.synchronise === 0).sort((a, b) => a.scanneLe.localeCompare(b.scanneLe));
    },
    async marquerSynchronises(ids) {
      if (ids.length === 0) return;
      const tx = base.transaction(MAGASIN_SCANS, "readwrite");
      const magasin = tx.objectStore(MAGASIN_SCANS);
      for (const id of ids) {
        const scan = (await promesse(magasin.get(id))) as ScanLocal | undefined;
        if (scan) magasin.put({ ...scan, synchronise: 1 });
      }
      await terminee(tx);
    },
    async compterEnAttente(evenementId) {
      const tx = base.transaction(MAGASIN_SCANS, "readonly");
      const tous = (await promesse(tx.objectStore(MAGASIN_SCANS).index("evenement").getAll(evenementId))) as ScanLocal[];
      return tous.filter((s) => s.origine === "hors_ligne" && s.resultat === "valide" && s.synchronise === 0).length;
    },
    async effacerEvenement(evenementId) {
      const tx = base.transaction([MAGASIN_LISTES, MAGASIN_SCANS], "readwrite");
      tx.objectStore(MAGASIN_LISTES).delete(evenementId);
      const scans = tx.objectStore(MAGASIN_SCANS);
      const primaires = (await promesse(scans.index("evenement").getAll(evenementId))) as ScanLocal[];
      let gardes = 0;
      for (const s of primaires) {
        if (s.origine === "hors_ligne" && s.resultat === "valide" && s.synchronise === 0) gardes++;
        else scans.delete(s.id);
      }
      await terminee(tx);
      return gardes;
    },
    async changerDeCompte(compteId) {
      const tx = base.transaction([MAGASIN_META, MAGASIN_LISTES, MAGASIN_SCANS], "readwrite");
      const meta = tx.objectStore(MAGASIN_META);
      const precedent = (await promesse(meta.get("compte"))) as { valeur: string } | undefined;
      let purge = false;
      if (precedent && precedent.valeur !== compteId) {
        tx.objectStore(MAGASIN_LISTES).clear();
        const scans = tx.objectStore(MAGASIN_SCANS);
        for (const s of (await promesse(scans.getAll())) as ScanLocal[]) {
          if (!(s.origine === "hors_ligne" && s.resultat === "valide" && s.synchronise === 0)) scans.delete(s.id);
        }
        purge = true;
      }
      if (!precedent || purge) meta.put({ cle: "compte", valeur: compteId });
      await terminee(tx);
      return purge;
    },
    fermer() {
      base.close();
    },
  };
}

// Transforme la réponse du serveur en liste locale : la clé du HMAC devient une CryptoKey non extractible, ses octets ne sont pas gardés.
export function listeDepuisReponse(evenementId: string, liste: ListeTelechargee, cle: CryptoKey): ListeLocale {
  return {
    evenementId,
    verrouId: liste.verrouId,
    prisLe: liste.prisLe,
    expireLe: liste.expireLe,
    genereLe: liste.genereLe,
    evenementFr: liste.evenementFr,
    evenementEn: liste.evenementEn,
    cle,
    types: liste.types,
    pass: liste.pass,
  };
}
