"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { estPremierePage, mesurer } from "@/modules/mesure/client";

type Props = {
  // Adresse du MP4 public validé par le serveur ; null : photo seule.
  videoUrl: string | null;
  // detoure : photo détourée (fond transparent), posée en pied du cadre sans rognage ; sinon photo rectangulaire, remplissant un cadre arrondi.
  repli: { url: string; alt: string; detoure: boolean } | null;
};

const CLE_PAUSE = "ks-heros-pause";
const EVENEMENT_PAUSE = "ks-heros-pause";
// Parallaxe légère de la vidéo : elle suit le défilement à 8 % de sa vitesse, jusqu'à 600 px de défilement.
const FACTEUR_PARALLAXE = 0.08;
const DEFILEMENT_MAX = 600;

// Mouvement réduit : lu dans le navigateur ; côté serveur, la photo est toujours rendue (jamais de vidéo avant l'hydratation).
function suivreMouvement(rappel: () => void) {
  const requete = window.matchMedia("(prefers-reduced-motion: reduce)");
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}
const mouvementReduit = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Choix de pause mémorisé dans le navigateur : toute lecture ou écriture peut échouer (navigation privée), le héros marche alors sans mémoire.
function suivrePause(rappel: () => void) {
  window.addEventListener("storage", rappel);
  window.addEventListener(EVENEMENT_PAUSE, rappel);
  return () => {
    window.removeEventListener("storage", rappel);
    window.removeEventListener(EVENEMENT_PAUSE, rappel);
  };
}
function pauseMemorisee(): boolean {
  try {
    return window.localStorage.getItem(CLE_PAUSE) === "1";
  } catch {
    return false;
  }
}
function memoriserPause(valeur: boolean) {
  try {
    window.localStorage.setItem(CLE_PAUSE, valeur ? "1" : "0");
  } catch {
    // Pas de mémoire : le choix vaut pour cette page seulement (l'événement ci-dessous suffit).
  }
  window.dispatchEvent(new Event(EVENEMENT_PAUSE));
}

// Média du héros. La photo de repli est toujours rendue d'abord (aucun média inventé : sans photo ni vidéo, rien). La vidéo n'est montée qu'après
// l'hydratation et jamais sous « mouvement réduit » (elle n'est alors pas chargée) ; elle remplace la photo seulement quand sa première image est
// prête. Une vidéo en erreur ou non prise en charge laisse la photo. Vidéo muette, en boucle, sans information indispensable (aria-hidden).
export function MediaHeros({ videoUrl, repli }: Props) {
  const t = useTranslations("Accueil.heros");
  const reduit = useSyncExternalStore(suivreMouvement, mouvementReduit, () => true);
  const pause = useSyncExternalStore(suivrePause, pauseMemorisee, () => false);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState(false);
  const refVideo = useRef<HTMLVideoElement>(null);
  const refMedia = useRef<HTMLDivElement>(null);
  const refImage = useRef<HTMLImageElement>(null);
  // Durée de chargement du héros (FR-54) : mesurée du début de la navigation jusqu'au premier média prêt, une seule fois.
  // Aucun autre renseignement ne part ; l'envoi reste silencieux.
  const mesureFaite = useRef(false);
  const signalerCharge = useCallback(() => {
    if (mesureFaite.current) return;
    mesureFaite.current = true;
    // Héros affiché après une navigation interne : performance.now() ne mesurerait pas son chargement, rien n'est envoyé.
    if (!estPremierePage()) return;
    mesurer("chargement_heros", { dureeMs: performance.now() });
  }, []);

  const avecVideo = videoUrl !== null && !reduit && !erreur;

  // Image déjà chargée avant l'hydratation : l'événement onLoad ne viendrait jamais, complete le dit.
  useEffect(() => {
    if (refImage.current?.complete) signalerCharge();
  }, [signalerCharge]);

  // Lecture ou pause selon le choix mémorisé.
  useEffect(() => {
    const video = refVideo.current;
    if (!video || !avecVideo) return;
    if (pause) video.pause();
    else video.play().catch(() => {
      // Lecture automatique refusée par le navigateur : la vidéo reste sur sa première image, le bouton permet de la lancer.
    });
  }, [pause, avecVideo, pret]);

  // Parallaxe : coupée en mouvement réduit et quand la vidéo est en pause.
  useEffect(() => {
    const cible = refMedia.current;
    if (!cible) return;
    if (reduit || pause || !avecVideo) {
      cible.style.setProperty("--decalage", "0px");
      return;
    }
    let image = 0;
    const appliquer = () => {
      image = 0;
      cible.style.setProperty("--decalage", `${Math.min(window.scrollY, DEFILEMENT_MAX) * FACTEUR_PARALLAXE}px`);
    };
    const surDefilement = () => {
      if (!image) image = requestAnimationFrame(appliquer);
    };
    appliquer();
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      window.removeEventListener("scroll", surDefilement);
      if (image) cancelAnimationFrame(image);
      cible.style.setProperty("--decalage", "0px");
    };
  }, [reduit, pause, avecVideo]);

  if (!repli && !videoUrl) return null;
  const afficheVideo = avecVideo && pret;

  return (
    <>
      <div
        ref={refMedia}
        className={`absolute inset-0 ${repli?.detoure && !afficheVideo ? "" : "overflow-hidden rounded-xl"}`}
        data-media-heros={afficheVideo ? "video" : "photo"}
      >
        <div className={`absolute inset-0 ${afficheVideo ? "origin-center [transform:translate3d(0,var(--decalage,0px),0)_scale(1.1)] motion-reduce:[transform:none]" : ""}`}>
          {repli ? (
            <Image
              ref={refImage}
              src={repli.url}
              alt={repli.alt}
              fill
              priority
              sizes="(min-width: 1280px) 40vw, 100vw"
              className={repli.detoure ? "object-contain object-bottom" : "object-cover"}
              onLoad={signalerCharge}
            />
          ) : null}
          {avecVideo ? (
            <video
              ref={refVideo}
              src={videoUrl}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
              onLoadedData={() => {
                setPret(true);
                signalerCharge();
              }}
              onError={() => setErreur(true)}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${pret ? "opacity-100" : "opacity-0"}`}
            />
          ) : null}
        </div>
      </div>
      {afficheVideo ? (
        <button
          type="button"
          aria-pressed={pause}
          aria-label={pause ? t("lecture") : t("pause")}
          onClick={() => memoriserPause(!pause)}
          className="absolute right-3 top-3 z-10 inline-flex size-touch items-center justify-center rounded-full border border-border-field bg-surface text-text-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
            {pause ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
          </svg>
        </button>
      ) : null}
    </>
  );
}
