"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

const INTERVALLE_MS = 3000;
const REQUETE_MOUVEMENT = "(prefers-reduced-motion: reduce)";
// Le panneau est masqué sous 768 px (Q32) : le défilement s'y arrête aussi (aucun minuteur pour une image invisible).
const REQUETE_PANNEAU = "(min-width: 768px)";

function sAbonner(requete: string) {
  return (rappel: () => void) => {
    const m = window.matchMedia(requete);
    m.addEventListener("change", rappel);
    return () => m.removeEventListener("change", rappel);
  };
}
const sAbonnerMouvement = sAbonner(REQUETE_MOUVEMENT);
const sAbonnerPanneau = sAbonner(REQUETE_PANNEAU);

// Panneau d'images de la connexion (story 9.17, maquette connexion.mp4, F2 et F3) : fondu d'une image à l'autre toutes les 3 s. « Réduire les
// animations » : la première image reste fixe (côté serveur aussi, aucune animation avant l'hydratation). Un bouton Pause / Lecture arrête le
// défilement (contenu qui bouge plus de 5 s : WCAG 2.2.2). Seule l'image visible est exposée aux lecteurs d'écran (texte alternatif « Illustration »).
export function DiaporamaConnexion({ images }: { images: readonly string[] }) {
  const t = useTranslations("Connexion.panneau");
  const reduit = useSyncExternalStore(
    sAbonnerMouvement,
    () => window.matchMedia(REQUETE_MOUVEMENT).matches,
    () => true,
  );
  const panneauVisible = useSyncExternalStore(
    sAbonnerPanneau,
    () => window.matchMedia(REQUETE_PANNEAU).matches,
    () => false,
  );
  const [index, setIndex] = useState(0);
  const [pause, setPause] = useState(false);
  const anime = !reduit && !pause && panneauVisible && images.length > 1;

  useEffect(() => {
    if (!anime) return;
    const minuteur = window.setInterval(() => setIndex((i) => (i + 1) % images.length), INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [anime, images.length]);

  // Modulo : la liste d'images peut raccourcir (nouveau déploiement) sans laisser le panneau vide.
  const courant = reduit || images.length === 0 ? 0 : index % images.length;
  return (
    <>
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={i === courant ? t("alt") : ""}
          aria-hidden={i === courant ? undefined : true}
          data-diapo={i}
          data-visible={i === courant ? "" : undefined}
          fill
          // Première image : le plus grand élément à l'écran sur ordinateur, chargée sans attendre.
          priority={i === 0}
          sizes="(min-width: 768px) 46.3vw, 1px"
          className={`object-cover transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${i === courant ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {images.length > 1 && !reduit ? (
        <button
          type="button"
          onClick={() => setPause((p) => !p)}
          aria-label={t("pause")}
          aria-pressed={pause}
          title={pause ? t("lecture") : t("pause")}
          className="absolute bottom-3 right-3 inline-flex size-touch items-center justify-center rounded-full border border-border bg-background text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        >
          {pause ? <Play aria-hidden="true" className="size-5" /> : <Pause aria-hidden="true" className="size-5" />}
        </button>
      ) : null}
    </>
  );
}
