"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { extraireJeton } from "@/modules/evenements/pass-charge";
import { scannerPassAction } from "@/modules/scan/actions";
import { DELAI_SERVEUR_MS } from "@/modules/scan/hors-ligne-types";
import type { EvenementScannable, ResultatScan } from "@/modules/scan/types";
import { creerDetecteurQr, urlsAPrechauffer } from "./lecteur-qr";
import { PanneauHorsLigne } from "./PanneauHorsLigne";
import { ResultatPlein } from "./ResultatPlein";
import { enregistrerServiceWorkerScan } from "./service-worker";
import { useScanHorsLigne } from "./useScanHorsLigne";

type Phase = "ouverture" | "actif" | "refusee" | "indisponible" | "lecteur";

// Intervalle de lecture de l'image de la caméra, et temps mort après « Scanner le pass suivant » (le Pass qui vient d'être lu est encore dans le cadre).
const INTERVALLE_LECTURE_MS = 200;
const TEMPS_MORT_MS = 1200;
const PAUSE_ERREUR_MS = 2000;
const DELAI = Symbol("delai");

const BOUTON = "t-button inline-flex min-h-touch items-center justify-center rounded-full border border-border-field bg-surface px-5 py-3 text-text-primary";
const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

function vibrer(motif: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(motif);
  } catch {
    // Sans vibration, l'affichage suffit (E-14).
  }
}

// Écran de Scan en ligne (story 7.6). Le jeton du Code QR n'existe que le temps de l'appel au serveur : il n'est ni affiché, ni mis en état, ni écrit
// dans l'adresse ou le stockage du navigateur, ni journalisé. Le contenu d'un Code QR qui n'est pas « KOMA:PASS:<jeton> » n'est jamais envoyé.
// « benevole » (story 7.7) : l'écran d'un bénévole n'offre pas de choix quand son accès ne couvre qu'un Événement ; le serveur revérifie l'accès à chaque scan.
export function EcranScan({ evenements, benevole = false, compteId }: { evenements: EvenementScannable[]; benevole?: boolean; compteId?: string }) {
  const t = useTranslations("Scan");
  const locale = useLocale();
  const idEvenement = useId();
  const idCode = useId();
  const idAideCode = useId();
  const video = useRef<HTMLVideoElement>(null);
  const occupe = useRef(true);
  // Un envoi au serveur est en cours (la saisie à la main n'en lance pas un second).
  const envoiEnCours = useRef(false);
  const boutonManuel = useRef<HTMLButtonElement>(null);
  const [evenementId, setEvenementId] = useState(evenements.length === 1 ? evenements[0].id : "");
  const [phase, setPhase] = useState<Phase>("ouverture");
  const [essai, setEssai] = useState(0);
  const [resultat, setResultat] = useState<ResultatScan | null>(null);
  const [enVerification, setEnVerification] = useState(false);
  const [manuel, setManuel] = useState(false);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const horsLigne = useScanHorsLigne({ evenementId, langue: locale === "en" ? "en" : "fr", compteId });
  const { liste: listeLocale, etat: etatVerrou, appareil, scannerLocal, noterEnLigne, signalerAutre, attendreEtat } = horsLigne;
  const synchroEnCours = horsLigne.occupe === "synchro";
  // Un autre appareil tient le Verrou hors ligne : « Scan réservé à l'appareil hors ligne », ni caméra ni saisie.
  const reserve = etatVerrou === "autre" && !listeLocale;
  // La caméra n'est ouverte ni pour un appareil réservé, ni avant de savoir s'il l'est.
  const cameraBloquee = reserve || attendreEtat;

  const envoyer = useCallback(
    async (entree: { charge: string } | { code: string }) => {
      if (envoiEnCours.current) return;
      // Pendant l'envoi des scans au serveur, aucun scan n'est jugé : un Pass affiché VALIDE doit toujours être enregistré avant que la liste soit effacée.
      if (synchroEnCours) {
        occupe.current = true;
        setErreur(t("erreur.synchro_en_cours"));
        setTimeout(() => {
          occupe.current = false;
        }, PAUSE_ERREUR_MS);
        return;
      }
      envoiEnCours.current = true;
      occupe.current = true;
      setEnVerification(true);
      setErreur(null);
      let res: ResultatScan;
      // Un scan est jugé sur la liste locale seulement si l'appareil en a une ET que le réseau manque (coupure déclarée, ou serveur muet trop longtemps).
      let jugeLocalement = false;
      if (listeLocale && !navigator.onLine) {
        jugeLocalement = true;
        res = await scannerLocal(entree);
      } else {
        try {
          // L'appareil qui tient le Verrou se fait connaître : la base refuse tout autre appareil tant que le Verrou est tenu.
          const appel = scannerPassAction({ evenementId, ...entree, ...(listeLocale && appareil ? { appareil } : {}) });
          const r = listeLocale
            ? await Promise.race([appel, new Promise<typeof DELAI>((resolu) => setTimeout(() => resolu(DELAI), DELAI_SERVEUR_MS))])
            : await appel;
          if (r === DELAI) {
            jugeLocalement = true;
            res = await scannerLocal(entree);
          } else {
            res = r;
          }
        } catch {
          if (listeLocale) {
            jugeLocalement = true;
            res = await scannerLocal(entree);
          } else {
            res = { ok: false, erreur: "generique" };
          }
        }
        if (!jugeLocalement) {
          if (res.ok && res.resultat === "valide" && listeLocale) await noterEnLigne(entree);
          if (!res.ok && res.erreur === "verrouille") signalerAutre();
        }
      }
      envoiEnCours.current = false;
      setEnVerification(false);
      if (res.ok) {
        vibrer(res.resultat === "valide" ? 200 : [400, 150, 400]);
        setResultat(res);
        setCode("");
        return;
      }
      // Erreur de service : ce n'est ni un VALIDE ni un REFUSÉ. Message à l'écran, lecture reprise après une courte pause.
      setErreur(t(`erreur.${res.erreur}`));
      setTimeout(() => {
        occupe.current = false;
      }, PAUSE_ERREUR_MS);
    },
    [evenementId, t, listeLocale, appareil, scannerLocal, noterEnLigne, signalerAutre, synchroEnCours],
  );

  // Caméra et lecture : démarrées une fois l'Événement choisi, arrêtées au départ de l'écran (la caméra est toujours relâchée).
  useEffect(() => {
    if (!evenementId || cameraBloquee) return;
    let arret = false;
    let flux: MediaStream | null = null;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const element = video.current;
    const relacher = () => {
      occupe.current = true;
      if (minuterie) clearTimeout(minuterie);
      flux?.getTracks().forEach((piste) => piste.stop());
      flux = null;
      if (element) element.srcObject = null;
    };
    // Onglet en arrière-plan : la caméra est relâchée ; au retour, elle est rouverte.
    const surVisibilite = () => {
      if (document.visibilityState === "hidden") relacher();
      else if (!arret) setEssai((n) => n + 1);
    };
    document.addEventListener("visibilitychange", surVisibilite);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'état de la caméra est remis à zéro à chaque (re)démarrage
    setPhase("ouverture");

    async function demarrer() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("indisponible");
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        const nom = e instanceof DOMException ? e.name : "";
        setPhase(nom === "NotAllowedError" || nom === "SecurityError" ? "refusee" : "indisponible");
        return;
      }
      if (arret) {
        flux.getTracks().forEach((piste) => piste.stop());
        return;
      }
      if (element) {
        element.srcObject = flux;
        await element.play().catch(() => undefined);
      }
      let detecteur;
      try {
        detecteur = await creerDetecteurQr();
      } catch {
        // Le lecteur n'a pas démarré : la caméra ne sert à rien, on la relâche.
        relacher();
        if (!arret) setPhase("lecteur");
        return;
      }
      if (arret) return;
      setPhase("actif");
      occupe.current = false;

      const lire = async () => {
        if (arret) return;
        if (!occupe.current && element && element.readyState >= 2) {
          try {
            const brut = await detecteur.lire(element);
            if (brut && !arret && !occupe.current) {
              occupe.current = true;
              const jeton = extraireJeton(brut);
              if (jeton) {
                void envoyer({ charge: brut });
              } else {
                // Autre contenu : refusé ici, sans appel au serveur.
                vibrer([400, 150, 400]);
                setResultat({ ok: true, resultat: "refuse", raison: "qr_invalide", scanneLe: null });
              }
            }
          } catch {
            // Une image illisible ne casse pas la boucle.
          }
        }
        if (!arret) minuterie = setTimeout(lire, INTERVALLE_LECTURE_MS);
      };
      minuterie = setTimeout(lire, INTERVALLE_LECTURE_MS);
    }
    void demarrer();

    return () => {
      arret = true;
      document.removeEventListener("visibilitychange", surVisibilite);
      relacher();
    };
  }, [evenementId, essai, envoyer, cameraBloquee]);

  // Service worker du Scan : enregistré seulement ici (portée /fr/scan ou /en/scan), pour que la page s'ouvre sans réseau. Le module WebAssembly du lecteur de
  // Code QR est demandé une fois pour entrer dans le cache du service worker (seulement si le navigateur n'a pas la lecture native).
  useEffect(() => {
    let annule = false;
    async function preparer() {
      if ((await enregistrerServiceWorkerScan(locale)) !== "enregistre") return;
      try {
        await navigator.serviceWorker.ready;
        if (annule) return;
        for (const url of urlsAPrechauffer()) await fetch(url).then((r) => r.arrayBuffer());
      } catch {
        // Sans préchauffage, le module est mis en cache à sa première utilisation.
      }
    }
    void preparer();
    return () => {
      annule = true;
    };
  }, [locale]);

  function suivant() {
    setResultat(null);
    setErreur(null);
    setTimeout(() => {
      occupe.current = false;
    }, TEMPS_MORT_MS);
    // Le bouton du résultat disparaît : le focus revient à un élément stable de l'écran (le bouton de saisie à la main).
    // Seulement si rien n'a pris le focus entre-temps : sur un téléphone chargé, le rappel arrive tard et volerait les premiers caractères d'un code déjà en cours de saisie.
    requestAnimationFrame(() => {
      const actif = document.activeElement;
      if (!actif || actif === document.body) boutonManuel.current?.focus();
    });
  }

  function changerEvenement(valeur: string) {
    setEvenementId(valeur);
    setResultat(null);
    setErreur(null);
    setCode("");
  }

  function validerCode(e: React.FormEvent) {
    e.preventDefault();
    if (!evenementId || enVerification || envoiEnCours.current || resultat || code.trim() === "") return;
    void envoyer({ code });
  }

  const heure = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lubumbashi" }).format(new Date(iso)) : null;

  if (evenements.length === 0) {
    return <MessageEtat type="information">{t("evenement.aucun")}</MessageEtat>;
  }

  return (
    <>
    <div className="flex flex-col gap-5" inert={resultat?.ok === true}>
      {benevole && evenements.length === 1 ? (
        <div className="flex flex-col gap-1">
          <p className="t-label">{t("evenement.libelle")}</p>
          <p className="t-body font-bold">{evenements[0].titre}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={idEvenement} className="t-label">
            {t("evenement.libelle")}
          </label>
          <select id={idEvenement} value={evenementId} onChange={(e) => changerEvenement(e.target.value)} className={CHAMP}>
            {evenements.length > 1 ? <option value="">{t("evenement.choisir")}</option> : null}
            {evenements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titre}
              </option>
            ))}
          </select>
        </div>
      )}

      {evenementId ? <PanneauHorsLigne etat={horsLigne} /> : null}

      {evenementId && !reserve ? (
        <section className="flex flex-col gap-4" aria-label={t("titre")}>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg sm:aspect-video" style={{ backgroundColor: "#16130f" }}>
            <video ref={video} aria-label={t("camera.libelle")} muted playsInline className="size-full object-cover" />
            {phase === "actif" ? (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="aspect-square w-3/5 rounded-lg border-4 border-white" />
              </div>
            ) : null}
          </div>

          {phase === "ouverture" ? <p className="t-small text-text-secondary">{t("camera.ouverture")}</p> : null}
          {phase === "actif" && !enVerification ? <p className="t-small text-text-secondary">{t("camera.cadre")}</p> : null}
          {enVerification ? (
            <p role="status" className="t-small text-text-secondary">
              {t("camera.verification")}
            </p>
          ) : null}
          {phase === "refusee" ? (
            <div role="alert" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
              <p className="t-body font-bold">{t("camera.refusee")}</p>
              <p className="t-small text-text-secondary">{t("camera.refuseeAide")}</p>
            </div>
          ) : null}
          {phase === "indisponible" ? <MessageEtat type="attention">{t("camera.indisponible")}</MessageEtat> : null}
          {phase === "lecteur" ? <MessageEtat type="attention">{t("camera.lecteurIndisponible")}</MessageEtat> : null}
          {phase === "refusee" || phase === "indisponible" || phase === "lecteur" ? (
            <button type="button" className={BOUTON} onClick={() => setEssai((n) => n + 1)}>
              {t("camera.reessayer")}
            </button>
          ) : null}
          {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
        </section>
      ) : evenementId ? null : (
        <p className="t-body text-text-secondary">{t("aide")}</p>
      )}

      {reserve ? null : (
      <div className="flex flex-col gap-3">
        <button ref={boutonManuel} type="button" className={BOUTON} aria-expanded={manuel} onClick={() => setManuel((v) => !v)}>
          {manuel ? t("manuel.fermer") : t("manuel.ouvrir")}
        </button>
        {manuel ? (
          <form onSubmit={validerCode} className="flex flex-col gap-3">
            <label htmlFor={idCode} className="t-label">
              {t("manuel.libelle")}
            </label>
            <input
              id={idCode}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-describedby={idAideCode}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              className={`${CHAMP} font-mono tracking-widest uppercase`}
            />
            <p id={idAideCode} className="t-small text-text-secondary">
              {t("manuel.aide")}
            </p>
            <button type="submit" disabled={!evenementId || enVerification} className="t-button min-h-touch rounded-full bg-primary px-5 py-3 text-on-primary disabled:bg-surface disabled:text-text-secondary">
              {t("manuel.valider")}
            </button>
          </form>
        ) : null}
      </div>
      )}

    </div>
      {resultat?.ok && resultat.resultat === "valide" ? (
        <ResultatPlein type="valide" nom={resultat.nom} evenement={resultat.evenement} typePass={resultat.typePass} onSuivant={suivant} />
      ) : null}
      {resultat?.ok && resultat.resultat === "refuse" ? (
        <ResultatPlein type="refuse" raison={resultat.raison} heure={heure(resultat.scanneLe)} onSuivant={suivant} />
      ) : null}
    </>
  );
}
