"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importerCleCodeCourt } from "@/modules/scan/empreintes";
import { indexerListe, creerLimiteurEssais, noterScanEnLigne, scannerLocalement, type EntreeLocale, type ListeIndexee } from "@/modules/scan/comparaison-locale";
import { libererVerrouAction, lireEtatVerrouAction, prendreVerrouAction, synchroniserScansAction } from "@/modules/scan/hors-ligne-actions";
import { DELAI_SERVEUR_MS, SONDAGE_ETAT_MS, type BilanSynchro, type ErreurHorsLigne } from "@/modules/scan/hors-ligne-types";
import { listeDepuisReponse, ouvrirStockage, stockageDisponible, type Stockage } from "@/modules/scan/stockage-hors-ligne";
import { synchroniserEtLiberer, type ResultatSynchro } from "@/modules/scan/synchronisation";
import type { ResultatScan } from "@/modules/scan/types";
import { purgerCachePagesScan } from "./service-worker";

export type EtatVerrouLocal = "inconnu" | "libre" | "moi" | "autre";

// Message d'état du panneau (clé de traduction + valeurs), annoncé en zone « polie ».
export type InfoHorsLigne =
  | { type: "prise" }
  | { type: "erreurPrise"; erreur: ErreurHorsLigne | "hors_ligne" }
  | { type: "synchro"; bilan: BilanSynchro }
  | { type: "synchroEchec" }
  | { type: "synchroPerdue"; restants: number }
  | { type: "efface" };

export type DependancesHorsLigneEcran = {
  ouvrir: () => Promise<Stockage>;
  maintenant: () => Date;
};

const PAR_DEFAUT: DependancesHorsLigneEcran = { ouvrir: () => ouvrirStockage(), maintenant: () => new Date() };

// État et actions du Scan hors ligne pour UN Événement choisi (story 7.8). Tout ce qui est gardé l'est dans IndexedDB (jamais un jeton ni un code court).
export function useScanHorsLigne({ evenementId, langue, compteId, deps = PAR_DEFAUT }: { evenementId: string; langue: "fr" | "en"; compteId?: string; deps?: DependancesHorsLigneEcran }) {
  // null : stockage en cours d'ouverture ; false : indisponible sur ce navigateur.
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [appareil, setAppareil] = useState<string | null>(null);
  const [enLigne, setEnLigne] = useState(true);
  const [etat, setEtat] = useState<EtatVerrouLocal>("inconnu");
  const [liste, setListe] = useState<ListeIndexee | null>(null);
  const [enAttente, setEnAttente] = useState(0);
  const [occupe, setOccupe] = useState<"aucun" | "prise" | "synchro">("aucun");
  const [info, setInfo] = useState<InfoHorsLigne | null>(null);
  // La lecture de l'état du Verrou a été tentée (réussie ou non) : la caméra n'attend pas plus longtemps.
  const [etatTente, setEtatTente] = useState(false);
  const stockage = useRef<Stockage | null>(null);
  const limiteur = useRef(creerLimiteurEssais());
  const occupeRef = useRef(false);
  // La synchronisation automatique n'est tentée qu'une fois par retour du réseau.
  const autoEssayee = useRef(false);

  // Ouverture du stockage et de l'identifiant d'appareil, une fois.
  useEffect(() => {
    let annule = false;
    async function ouvrir() {
      if (!stockageDisponible()) {
        setDisponible(false);
        return;
      }
      try {
        const s = await deps.ouvrir();
        const id = await s.lireAppareil();
        // Un autre Compte sur le même appareil : les listes (noms) et la copie de la page de l'ancien Compte sont effacées.
        if (compteId && (await s.changerDeCompte(compteId))) await purgerCachePagesScan();
        if (annule) {
          s.fermer();
          return;
        }
        stockage.current = s;
        setAppareil(id);
        setDisponible(true);
      } catch {
        if (!annule) setDisponible(false);
      }
    }
    void ouvrir();
    return () => {
      annule = true;
      stockage.current?.fermer();
      stockage.current = null;
    };
  }, [deps, compteId]);

  // Réseau : l'état suit les événements du navigateur.
  useEffect(() => {
    const maj = () => {
      const en = navigator.onLine;
      if (!en) autoEssayee.current = false;
      setEnLigne(en);
    };
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);

  const rafraichirLocal = useCallback(async () => {
    const s = stockage.current;
    if (!s || !evenementId) return;
    try {
      const l = await s.lireListe(evenementId);
      setListe(l ? indexerListe(l) : null);
      setEnAttente(await s.compterEnAttente(evenementId));
    } catch {
      setListe(null);
    }
  }, [evenementId]);

  // Changement d'Événement ou stockage prêt : relit la liste locale de CET Événement.
  useEffect(() => {
    if (disponible !== true) return;
    void rafraichirLocal();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'état du Verrou est remis à « inconnu » à chaque changement d'Événement
    setEtat("inconnu");
    setEtatTente(false);
    setInfo(null);
  }, [disponible, evenementId, rafraichirLocal]);

  // État du Verrou côté serveur (avec réseau). Une panne de réseau laisse l'état tel quel.
  const rafraichirEtat = useCallback(async () => {
    if (!evenementId || !appareil || !navigator.onLine) return;
    try {
      const r = await lireEtatVerrouAction({ evenementId, appareil });
      if (r.ok) setEtat(r.etat.etat);
    } catch {
      // Hors ligne ou serveur injoignable : on garde l'état connu.
    } finally {
      setEtatTente(true);
    }
  }, [evenementId, appareil]);

  useEffect(() => {
    if (disponible !== true || !appareil || !enLigne) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture asynchrone de l'état du serveur (le setState suit la réponse)
    void rafraichirEtat();
    const surVisibilite = () => {
      if (document.visibilityState === "visible") void rafraichirEtat();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => document.removeEventListener("visibilitychange", surVisibilite);
  }, [disponible, appareil, enLigne, rafraichirEtat]);

  // Le serveur peut ne jamais répondre (wifi sans Internet) : au bout du même délai que pour un scan, la caméra et le mode local démarrent sans l'état du Verrou.
  useEffect(() => {
    if (disponible !== true || !enLigne || etatTente) return;
    const minuterie = setTimeout(() => setEtatTente(true), DELAI_SERVEUR_MS);
    return () => clearTimeout(minuterie);
  }, [disponible, enLigne, etatTente, evenementId]);

  // « Scan réservé » : l'état est relu régulièrement tant que l'écran est visible et en ligne (le Verrou a pu être rendu ou libéré), sans action du bénévole.
  useEffect(() => {
    if (etat !== "autre" || !enLigne) return;
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") void rafraichirEtat();
    }, SONDAGE_ETAT_MS);
    return () => clearInterval(minuterie);
  }, [etat, enLigne, rafraichirEtat]);

  const prendre = useCallback(async () => {
    const s = stockage.current;
    if (!s || !appareil || !evenementId || occupeRef.current) return;
    occupeRef.current = true;
    setOccupe("prise");
    setInfo(null);
    try {
      const r = await prendreVerrouAction({ evenementId, appareil });
      if (!r.ok) {
        setInfo({ type: "erreurPrise", erreur: r.erreur });
        if (r.erreur === "verrou_pris") setEtat("autre");
        return;
      }
      const cle = await importerCleCodeCourt(r.liste.cleCodeCourt);
      await s.enregistrerListe(listeDepuisReponse(evenementId, r.liste, cle));
      await rafraichirLocal();
      setEtat("moi");
      setInfo({ type: "prise" });
    } catch {
      setInfo({ type: "erreurPrise", erreur: navigator.onLine ? "generique" : "hors_ligne" });
    } finally {
      occupeRef.current = false;
      setOccupe("aucun");
    }
  }, [appareil, evenementId, rafraichirLocal]);

  const synchroniser = useCallback(async () => {
    const s = stockage.current;
    if (!s || !appareil || !evenementId || occupeRef.current) return;
    occupeRef.current = true;
    setOccupe("synchro");
    setInfo(null);
    let r: ResultatSynchro;
    try {
      r = await synchroniserEtLiberer(
        {
          stockage: s,
          synchroniser: (e) => synchroniserScansAction(e),
          liberer: (e) => libererVerrouAction(e),
        },
        evenementId,
        appareil,
      );
    } finally {
      occupeRef.current = false;
      setOccupe("aucun");
    }
    if (r.statut === "libere") {
      setInfo({ type: "synchro", bilan: r.bilan });
      setEtat("libre");
    } else if (r.statut === "perdu") {
      setInfo({ type: "synchroPerdue", restants: r.restants });
      await rafraichirEtat();
    } else {
      setInfo({ type: "synchroEchec" });
    }
    await rafraichirLocal();
  }, [appareil, evenementId, rafraichirLocal, rafraichirEtat]);

  // Retour du réseau avec des scans faits hors ligne en attente : synchronisation automatique, puis Verrou rendu et liste effacée. Sans scan en attente,
  // le Verrou n'est PAS rendu tout seul (une coupure brève ne doit pas faire perdre la liste) : le bouton reste là.
  useEffect(() => {
    if (!enLigne || !liste || enAttente === 0 || occupe !== "aucun" || autoEssayee.current) return;
    autoEssayee.current = true;
    void synchroniser();
  }, [enLigne, liste, enAttente, occupe, synchroniser]);

  const effacer = useCallback(async () => {
    const s = stockage.current;
    if (!s || !evenementId) return;
    try {
      await s.effacerEvenement(evenementId);
    } catch {
      // La liste reste ; l'écran la montre encore.
    }
    await rafraichirLocal();
    setInfo({ type: "efface" });
  }, [evenementId, rafraichirLocal]);

  const dependancesLocales = useMemo(
    () => ({ stockage: { enregistrerScan: (scan: Parameters<Stockage["enregistrerScan"]>[0]) => (stockage.current as Stockage).enregistrerScan(scan) }, maintenant: deps.maintenant, langue }),
    [deps.maintenant, langue],
  );

  // Un scan contre la liste de cet appareil. La saisie à la main est freinée (10 essais par 10 minutes).
  const scannerLocal = useCallback(
    async (entree: EntreeLocale): Promise<ResultatScan> => {
      if (!liste || !stockage.current) return { ok: false, erreur: "stockage" };
      if ("code" in entree && !limiteur.current.autoriser(deps.maintenant().getTime())) return { ok: false, erreur: "trop_d_essais" };
      const resultat = await scannerLocalement(dependancesLocales, liste, entree);
      if (resultat.ok && resultat.resultat === "valide") setEnAttente((n) => n + 1);
      return resultat;
    },
    [liste, dependancesLocales, deps],
  );

  const noterEnLigne = useCallback(
    async (entree: EntreeLocale) => {
      if (liste && stockage.current) await noterScanEnLigne(dependancesLocales, liste, entree);
    },
    [liste, dependancesLocales],
  );

  // Identité stable : l'écran la met dans les dépendances de la boucle de caméra.
  const signalerAutre = useCallback(() => setEtat("autre"), []);

  // Avec du réseau et un stockage prêt, la caméra attend de savoir si un autre appareil tient le Verrou (sinon elle s'ouvrirait pour rien).
  const attendreEtat = disponible === null || (disponible === true && enLigne && !etatTente);

  return {
    attendreEtat,
    disponible,
    appareil,
    enLigne,
    etat,
    liste,
    enAttente,
    occupe,
    info,
    prendre,
    synchroniser,
    reessayer: rafraichirEtat,
    effacer,
    scannerLocal,
    noterEnLigne,
    signalerAutre,
  };
}
