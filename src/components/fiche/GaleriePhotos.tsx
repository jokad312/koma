"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialogue } from "@/components/ui/Dialogue";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import type { PhotoFiche } from "@/modules/catalogue/types";

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_PAS = 0.5;

const BOUTON_ICONE =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:text-text-secondary";

function Icone({ chemin }: { chemin: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d={chemin} />
    </svg>
  );
}

// Galerie d'une fiche (UX-DR22) : défilement natif à accrochage (balayage tactile), boutons Photo précédente / suivante, vignettes au clavier,
// position annoncée en statut, bouton Agrandir (boîte de dialogue avec + et −). Le zoom du navigateur n'est jamais bloqué.
// Une seule photo : ni boutons de défilement ni vignettes.
export function GaleriePhotos({ photos }: { photos: readonly PhotoFiche[] }) {
  const t = useTranslations("Fiche.galerie");
  const [index, setIndex] = useState(0);
  const [agrandi, setAgrandi] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const piste = useRef<HTMLUListElement>(null);
  const boutonAgrandir = useRef<HTMLButtonElement>(null);
  // Levé pendant un défilement lancé par un bouton : onScroll ne recalcule pas l'index (pas de clignotement). Baissé sur scrollend, avec repli par minuterie.
  const programmatique = useRef(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = photos.length;

  const finirProgrammatique = useCallback(() => {
    programmatique.current = false;
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
  }, []);
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);
  const plusieurs = total > 1;

  const aller = useCallback(
    (cible: number) => {
      const piste_ = piste.current;
      const suivant = (cible + total) % total;
      setIndex(suivant);
      if (!piste_) return;
      const reduit = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      programmatique.current = true;
      if (minuterie.current) clearTimeout(minuterie.current);
      minuterie.current = setTimeout(finirProgrammatique, 1000);
      piste_.scrollTo({ left: suivant * piste_.clientWidth, behavior: reduit ? "auto" : "smooth" });
    },
    [total, finirProgrammatique],
  );

  function surDefilement() {
    const piste_ = piste.current;
    if (programmatique.current || !piste_ || piste_.clientWidth === 0) return;
    const courant = Math.round(piste_.scrollLeft / piste_.clientWidth);
    setIndex(Math.min(Math.max(courant, 0), total - 1));
  }

  function ouvrir() {
    setZoom(ZOOM_MIN);
    setAgrandi(true);
  }

  const photo = photos[index];

  return (
    <section aria-label={t("titre")} className="flex flex-col gap-3">
      <div className="relative">
        <ul
          ref={piste}
          onScroll={surDefilement}
          onScrollEnd={finirProgrammatique}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-lg border border-border bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((p, i) => (
            <li key={p.url} className="relative aspect-[4/5] w-full shrink-0 snap-center">
              <Image src={p.url} alt={p.alt} fill priority={i === 0} sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="t-small text-text-secondary">
          {t("position", { n: index + 1, total })}
        </p>
        <div className="flex items-center gap-2">
          {plusieurs ? (
            <>
              <button type="button" onClick={() => aller(index - 1)} aria-label={t("precedente")} className={BOUTON_ICONE}>
                <Icone chemin="M15 5l-7 7 7 7" />
              </button>
              <button type="button" onClick={() => aller(index + 1)} aria-label={t("suivante")} className={BOUTON_ICONE}>
                <Icone chemin="M9 5l7 7-7 7" />
              </button>
            </>
          ) : null}
          <button ref={boutonAgrandir} type="button" onClick={ouvrir} className={CLASSES_SECONDAIRE}>
            {t("agrandir")}
          </button>
        </div>
      </div>

      {plusieurs ? (
        <ul className="flex gap-2 overflow-x-auto p-1">
          {photos.map((p, i) => (
            <li key={p.url} className="shrink-0">
              <button
                type="button"
                onClick={() => aller(i)}
                aria-label={t("voir", { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={`relative block size-16 min-h-touch min-w-touch overflow-hidden rounded-md bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 ${i === index ? "border-2 border-primary" : "border border-border-field"}`}
              >
                <Image src={p.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialogue ouvert={agrandi} onFermer={() => setAgrandi(false)} titre={t("agrandirTitre")} retourFocus={boutonAgrandir}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_PAS))}
              disabled={zoom <= ZOOM_MIN}
              aria-label={t("zoomArriere")}
              className={BOUTON_ICONE}
            >
              <Icone chemin="M5 12h14" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_PAS))}
              disabled={zoom >= ZOOM_MAX}
              aria-label={t("zoomAvant")}
              className={BOUTON_ICONE}
            >
              <Icone chemin="M5 12h14M12 5v14" />
            </button>
          </div>
          {/* Zone défilable au clavier (tabIndex 0) : l'image grandit dans sa zone, le zoom du navigateur reste libre. */}
          <div role="group" aria-label={t("zone")} tabIndex={0} className="max-h-[60dvh] overflow-auto rounded-md border border-border bg-background">
            <div style={{ width: `${zoom * 100}%` }}>
              <Image src={photo.url} alt={photo.alt} width={1200} height={1500} sizes="(min-width: 1024px) 60vw, 100vw" className="block h-auto w-full" />
            </div>
          </div>
        </div>
      </Dialogue>
    </section>
  );
}
