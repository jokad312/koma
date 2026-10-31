"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";

export type PisteExtrait = { langue: string; src: string; libelle: string; parDefaut: boolean };

type Props = { playlist: string; vignette: string; titre: string; pistes: readonly PisteExtrait[] };

// Lecteur de l'extrait public d'un Kit : contrôles natifs du navigateur (lecture, piste, volume, sous-titres, plein écran au clavier),
// aucune lecture automatique, affiche thumbnail.jpg. HLS natif si le navigateur sait le lire (Safari, iOS), sinon hls.js chargé à la demande.
// Une piste <track> par langue des sous-titres de l'extrait ; la piste par défaut est celle de la langue de l'interface. Avec hls.js, rien
// n'est chargé avant la première lecture (autoStartLoad: false, puis startLoad au premier « play ») : preload="none" est respecté.
export function LecteurExtrait({ playlist, vignette, titre, pistes }: Props) {
  const t = useTranslations("Kit.extrait");
  const video = useRef<HTMLVideoElement>(null);
  const [etat, setEtat] = useState<"pret" | "erreur" | "nonPrisEnCharge">("pret");

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = playlist;
      return;
    }
    let detruit = false;
    let lecteur: { destroy(): void } | null = null;
    let retirerEcoute: (() => void) | null = null;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (detruit) return;
        if (!Hls.isSupported()) {
          setEtat("nonPrisEnCharge");
          return;
        }
        const hls = new Hls({ autoStartLoad: false });
        lecteur = hls;
        hls.on(Hls.Events.ERROR, (_evenement, donnees) => {
          if (donnees.fatal) setEtat("erreur");
        });
        hls.loadSource(playlist);
        hls.attachMedia(el);
        const demarrer = () => hls.startLoad();
        el.addEventListener("play", demarrer, { once: true });
        retirerEcoute = () => el.removeEventListener("play", demarrer);
      })
      .catch(() => {
        if (!detruit) setEtat("erreur");
      });
    return () => {
      detruit = true;
      retirerEcoute?.();
      lecteur?.destroy();
    };
  }, [playlist]);

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={video}
        controls
        playsInline
        preload="none"
        crossOrigin="anonymous"
        poster={vignette}
        aria-label={titre}
        onError={() => setEtat("erreur")}
        className="aspect-video w-full rounded-lg border border-border bg-background"
      >
        {pistes.map((p) => (
          <track key={p.langue} kind="subtitles" src={p.src} srcLang={p.langue} label={p.libelle} default={p.parDefaut} />
        ))}
      </video>
      {etat === "erreur" ? <MessageEtat type="erreur">{t("erreur")}</MessageEtat> : null}
      {etat === "nonPrisEnCharge" ? <MessageEtat type="erreur">{t("nonPrisEnCharge")}</MessageEtat> : null}
    </div>
  );
}
