"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { enregistrerProgression } from "@/modules/bibliotheque/actions";
import { INTERVALLE_PROGRESSION_SECONDES, indexChapitre } from "@/modules/bibliotheque/video";
import { formaterInstant } from "@/modules/catalogue/sous-titres";

export type ChapitreLecteur = { id: string; titre: string; debutSecondes: number };

type Props = {
  produitId: string;
  slug: string;
  titre: string;
  locale: "fr" | "en";
  dureeSecondes: number;
  chapitres: readonly ChapitreLecteur[];
  sousTitres: ReadonlyArray<"fr" | "en">;
};

type Lecture = { playlist: string; sousTitres: Array<{ langue: "fr" | "en"; src: string }>; positionSecondes: number };
type Etat = "chargement" | "pret" | "erreur" | "nonPrisEnCharge" | "refuse" | "connexion";

// Lecteur du tutoriel d'un Kit (story 3.7). Le jeton Bunny est demandé au serveur, qui vérifie l'accès (règle 1) ; aucune adresse n'est
// écrite dans la page. Commandes faites à la main (pas de contrôles natifs) pour qu'elles soient toutes au clavier et annoncées :
// lecture/pause, piste temporelle (slider ARIA avec valeur en texte), chapitres (boutons, aria-current), sous-titres, plein écran.
// Aucun bouton ni lien de téléchargement. Position enregistrée toutes les 15 secondes et à la pause ; reprise à la dernière position.
export function LecteurVideoKit({ produitId, slug, titre, locale, dureeSecondes, chapitres, sousTitres }: Props) {
  const t = useTranslations("Bibliotheque.video");
  const tk = useTranslations("Kit.sousTitres");
  const conteneur = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const dernierePosition = useRef(0);
  // Vrai dès qu'une lecture a commencé : avant cela, currentTime vaut 0 et ne doit jamais écraser la position reprise.
  const aJoue = useRef(false);
  const [etat, setEtat] = useState<Etat>("chargement");
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [essai, setEssai] = useState(0);
  const [enLecture, setEnLecture] = useState(false);
  const [temps, setTemps] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [piste, setPiste] = useState<"off" | "fr" | "en">(sousTitres.includes(locale) ? locale : sousTitres.includes("fr") ? "fr" : "off");

  const debuts = chapitres.map((c) => c.debutSecondes);
  const courant = chapitres.length > 0 ? indexChapitre(debuts, temps) : -1;
  const duree = (secondes: number) => t("duree", { minutes: Math.floor(secondes / 60), secondes: Math.floor(secondes % 60) });

  const sauver = useCallback(() => {
    if (!aJoue.current) return;
    const el = video.current;
    const position = Math.floor(el ? el.currentTime : dernierePosition.current);
    dernierePosition.current = position;
    void enregistrerProgression(produitId, position).catch(() => undefined);
  }, [produitId]);

  // Jeton : demandé au serveur à chaque chargement et à chaque « Réessayer » (la lecture reprend à la dernière position connue).
  useEffect(() => {
    let annule = false;
    fetch(`/api/kits/video/${encodeURIComponent(slug)}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (annule) return;
        if (r.status === 401) return setEtat("connexion");
        if (r.status === 403) return setEtat("refuse");
        const corps = (await r.json().catch(() => null)) as Lecture | null;
        if (!r.ok || !corps || typeof corps.playlist !== "string") return setEtat("erreur");
        // La position locale (plus récente) l'emporte sur celle du serveur quand on réessaie.
        // Une vidéo regardée jusqu'au bout repart du début ; sinon la position locale (plus récente) l'emporte sur celle du serveur.
        if (dernierePosition.current === 0 && !aJoue.current) dernierePosition.current = corps.positionSecondes >= dureeSecondes - 10 ? 0 : corps.positionSecondes;
        setLecture(corps);
      })
      .catch(() => {
        if (!annule) setEtat("erreur");
      });
    return () => {
      annule = true;
    };
  }, [slug, essai, dureeSecondes]);

  // Lecteur : HLS natif (Safari, iOS) sinon hls.js chargé à la demande. Qualité adaptative, départ prudent pour les connexions lentes.
  useEffect(() => {
    const el = video.current;
    if (!el || !lecture) return;
    const depart = dernierePosition.current;
    let detruit = false;
    let hls: { destroy(): void } | null = null;
    const reprendre = () => {
      if (depart > 0) el.currentTime = depart;
      setEtat("pret");
    };
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = lecture.playlist;
      el.addEventListener("loadedmetadata", reprendre, { once: true });
      return () => {
        detruit = true;
        el.removeEventListener("loadedmetadata", reprendre);
      };
    }
    import("hls.js")
      .then(({ default: Hls }) => {
        if (detruit) return;
        if (!Hls.isSupported()) return setEtat("nonPrisEnCharge");
        const lecteur = new Hls({ startPosition: depart > 0 ? depart : -1, abrEwmaDefaultEstimate: 500_000 });
        hls = lecteur;
        lecteur.on(Hls.Events.ERROR, (_e, donnees) => {
          if (donnees.fatal) {
            setEnLecture(false);
            setEtat("erreur");
          }
        });
        lecteur.on(Hls.Events.MANIFEST_PARSED, () => setEtat("pret"));
        lecteur.loadSource(lecture.playlist);
        lecteur.attachMedia(el);
      })
      .catch(() => {
        if (!detruit) setEtat("erreur");
      });
    return () => {
      detruit = true;
      hls?.destroy();
    };
  }, [lecture]);

  // Sous-titres : une seule piste affichée, choisie dans la liste (par défaut la langue de l'interface, sinon le français).
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    for (const p of Array.from(el.textTracks)) p.mode = p.language === piste ? "showing" : "disabled";
  }, [piste, lecture, etat]);

  // Enregistrement : toutes les 15 secondes pendant la lecture, à la pause, et quand la page est quittée.
  useEffect(() => {
    if (!enLecture) return;
    const minuteur = setInterval(sauver, INTERVALLE_PROGRESSION_SECONDES * 1000);
    return () => clearInterval(minuteur);
  }, [enLecture, sauver]);
  useEffect(() => {
    const quitter = () => {
      if (document.visibilityState === "hidden") sauver();
    };
    document.addEventListener("visibilitychange", quitter);
    window.addEventListener("pagehide", sauver);
    return () => {
      document.removeEventListener("visibilitychange", quitter);
      window.removeEventListener("pagehide", sauver);
      sauver();
    };
  }, [sauver]);
  useEffect(() => {
    const suivre = () => setPleinEcran(document.fullscreenElement === conteneur.current);
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);

  function basculer() {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setEtat("erreur"));
    else el.pause();
  }
  function aller(secondes: number, lire = false) {
    const el = video.current;
    if (!el) return;
    el.currentTime = secondes;
    setTemps(secondes);
    dernierePosition.current = secondes;
    if (lire) void el.play().catch(() => setEtat("erreur"));
  }
  function plein() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (conteneur.current?.requestFullscreen) void conteneur.current.requestFullscreen();
    // iPhone : seul l'élément vidéo peut passer en plein écran.
    else (video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.();
  }

  if (etat === "refuse" || etat === "connexion" || etat === "nonPrisEnCharge") {
    return <MessageEtat type="erreur">{t(etat)}</MessageEtat>;
  }

  return (
    <div ref={conteneur} className="flex flex-col gap-4 bg-background" aria-label={t("lecteur", { titre })} role="group">
      <video
        ref={video}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        aria-label={titre}
        onPlay={() => {
          aJoue.current = true;
          setEnLecture(true);
        }}
        onPause={() => {
          setEnLecture(false);
          sauver();
        }}
        onEnded={() => {
          setEnLecture(false);
          sauver();
        }}
        onTimeUpdate={(e) => {
          setTemps(Math.floor(e.currentTarget.currentTime));
          dernierePosition.current = Math.floor(e.currentTarget.currentTime);
        }}
        onError={() => {
          setEnLecture(false);
          setEtat("erreur");
        }}
        className="aspect-video w-full rounded-lg border border-border bg-background"
      >
        {lecture?.sousTitres.map((s) => (
          <track key={s.langue} kind="subtitles" src={s.src} srcLang={s.langue} label={t(`langues.${s.langue}`)} />
        ))}
      </video>

      {etat === "chargement" ? <p role="status">{t("chargement")}</p> : null}
      {etat === "erreur" ? (
        <div className="flex flex-col items-start gap-3">
          <MessageEtat type="erreur">{t("erreur")}</MessageEtat>
          <Bouton variante="secondaire" onClick={() => {
              setEtat("chargement");
              setEssai((n) => n + 1);
            }}>
            {t("reessayer")}
          </Bouton>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Bouton variante="secondaire" onClick={basculer} aria-pressed={enLecture}>
          {enLecture ? t("pause") : t("lecture")}
        </Bouton>
        <input
          type="range"
          min={0}
          max={dureeSecondes}
          step={1}
          value={Math.min(temps, dureeSecondes)}
          onChange={(e) => aller(Number(e.target.value))}
          aria-label={t("position")}
          aria-valuetext={t("valeur", { position: duree(temps), duree: duree(dureeSecondes) })}
          className="min-w-40 flex-1"
        />
        <span className="t-small" aria-hidden="true">
          {`${formaterInstant(temps)} / ${formaterInstant(dureeSecondes)}`}
        </span>
        <Bouton variante="secondaire" onClick={plein}>
          {pleinEcran ? t("quitterPleinEcran") : t("pleinEcran")}
        </Bouton>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`pistes-${produitId}`} className="t-small">
          {t("sousTitres")}
        </label>
        <select
          id={`pistes-${produitId}`}
          value={piste}
          onChange={(e) => setPiste(e.target.value as "off" | "fr" | "en")}
          className="min-h-touch rounded-md border border-border-field bg-surface px-3"
        >
          <option value="off">{t("sansSousTitres")}</option>
          {sousTitres.map((l) => (
            <option key={l} value={l}>
              {t(`langues.${l}`)}
            </option>
          ))}
        </select>
        {locale === "en" && !sousTitres.includes("en") ? <p className="t-small">{tk("sansAnglais")}</p> : null}
      </div>

      {chapitres.length > 0 ? (
        <nav aria-label={t("chapitres")}>
          <h3 className="t-h3">{t("chapitres")}</h3>
          <ol className="mt-2 flex flex-col gap-2">
            {chapitres.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => aller(c.debutSecondes, true)}
                  aria-current={i === courant ? "true" : undefined}
                  className="min-h-touch w-full rounded-md border border-border bg-surface px-3 text-left aria-[current=true]:border-primary aria-[current=true]:border-2"
                >
                  {t("chapitreLigne", { titre: c.titre, instant: formaterInstant(c.debutSecondes) })}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
