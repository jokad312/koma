"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { demarrerEnvoiBunny } from "@/lib/bunny/envoi-tus-navigateur";
import type { EnvoiTus } from "@/lib/supabase/envoi-tus";
import { annulerEnvoiVideoKit, demanderEnvoiVideoKit, retirerExtraitKit, supprimerVideoKit, verifierVideoKit } from "@/modules/catalogue/actions";
import { formaterInstant } from "@/modules/catalogue/sous-titres";
import { EXTRAIT_KIT_TAILLE_MAX, TYPES_VIDEO_KIT, VIDEO_KIT_TAILLE_MAX } from "@/modules/catalogue/types";
import type { GenreVideoKit } from "@/modules/catalogue/types";
import { CLASSE_CHAMP } from "./ChampTexte";

type Phase = "repos" | "envoi" | "encodage";

const INTERVALLE_MS = 5000;
// Au-delà, la vérification automatique s'arrête (le bouton « Vérifier maintenant » reste).
const ESSAIS_MAX = 240;
const MO = 1024 * 1024;
// Erreurs passagères de la vérification : la vidéo envoyée n'est ni enregistrée ni effacée, le suivi continue.
const ERREURS_PASSAGERES = ["bunny_indisponible", "duree_invalide"];
const TYPE_PAR_EXTENSION: Readonly<Record<string, (typeof TYPES_VIDEO_KIT)[number]>> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

// Type de la vidéo : celui du navigateur s'il est accepté, sinon déduit de l'extension (MOV sous Windows ou Android : type vide ou autre).
export function typeVideo(fichier: File): string {
  if ((TYPES_VIDEO_KIT as readonly string[]).includes(fichier.type)) return fichier.type;
  const point = fichier.name.lastIndexOf(".");
  return (point >= 0 && TYPE_PAR_EXTENSION[fichier.name.slice(point + 1).toLowerCase()]) || fichier.type;
}

type Props = {
  produitId: string;
  genre: GenreVideoKit;
  // Vidéo complète enregistrée : durée lue chez Bunny (jamais un identifiant). null : aucune.
  dureeSecondes: number | null;
  // Extrait enregistré (genre « extrait » seulement).
  extraitPresent: boolean;
  bunnyConfigure: boolean;
};

// Vidéo complète (bibliothèque Bunny privée) ou extrait public (bibliothèque Bunny publique) d'un Kit : autorisation signée par le serveur,
// envoi TUS direct (progression en texte, reprise, « Annuler l'envoi »), puis vérification de l'encodage chez Bunny par le serveur. La vidéo
// n'est enregistrée qu'à l'encodage terminé : l'état affiché vient toujours de la réponse réelle du serveur, jamais d'une supposition.
export function VideoKit({ produitId, genre, dureeSecondes, extraitPresent, bunnyConfigure }: Props) {
  const t = useTranslations(genre === "complete" ? "Admin.kits.video" : "Admin.kits.extrait");
  const te = useTranslations("Admin.kits.videoErreurs");
  const router = useRouter();
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [encodage, setEncodage] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verificationArretee, setVerificationArretee] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [retraitEnCours, setRetraitEnCours] = useState(false);
  const [relance, setRelance] = useState(0);
  const envoi = useRef<EnvoiTus | null>(null);
  // Vidéo en cours d'envoi ou d'encodage : gardée en mémoire du navigateur seulement, le temps de la vérifier.
  const videoEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);
  const essais = useRef(0);

  const max = (genre === "complete" ? VIDEO_KIT_TAILLE_MAX : EXTRAIT_KIT_TAILLE_MAX) / MO;
  const texteErreur = useCallback((code: string) => te(te.has(code) ? code : "generique"), [te]);

  const presente = genre === "complete" ? dureeSecondes !== null : extraitPresent;
  const indisponible = genre === "extrait" && dureeSecondes === null;

  // Vérification de l'encodage chez Bunny, toutes les 5 secondes, tant que la vidéo envoyée n'est pas prête.
  useEffect(() => {
    if (phase !== "encodage") return;
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | null = null;
    const boucle = async () => {
      const videoId = videoEnCours.current;
      if (!videoId) return;
      essais.current += 1;
      try {
        const r = await verifierVideoKit({ produitId, genre, videoId });
        if (!actif) return;
        if (r.statut === "erreur") {
          setErreur(texteErreur(r.erreur));
          // Erreur définitive : le suivi s'arrête. Erreur passagère : la vidéo est gardée et vérifiée de nouveau.
          if (!ERREURS_PASSAGERES.includes(r.erreur)) {
            videoEnCours.current = null;
            setPhase("repos");
            return;
          }
        } else if (r.video.etat === "prete") {
          setMessage(t("enregistree"));
          videoEnCours.current = null;
          setEncodage(null);
          setPhase("repos");
          if (refFichier.current) refFichier.current.value = "";
          router.refresh();
          return;
        } else {
          setErreur(null);
          setEncodage(r.video.progression);
        }
      } catch {
        if (!actif) return;
        setErreur(texteErreur("generique"));
      }
      if (essais.current >= ESSAIS_MAX) {
        setVerificationArretee(true);
        return;
      }
      minuteur = setTimeout(boucle, INTERVALLE_MS);
    };
    minuteur = setTimeout(boucle, 0);
    return () => {
      actif = false;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [phase, relance, produitId, genre, router, t, texteErreur]);

  // Quitter la page pendant un envoi ou un encodage : le navigateur demande confirmation (la vidéo ne serait jamais enregistrée).
  const phaseCourante = useRef<Phase>("repos");
  useEffect(() => {
    phaseCourante.current = phase;
    if (phase === "repos") return;
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [phase]);

  // Démontage pendant l'envoi (navigation dans l'application) : l'envoi TUS est arrêté et la vidéo créée effacée chez Bunny.
  useEffect(
    () => () => {
      if (phaseCourante.current !== "envoi") return;
      annule.current = true;
      const id = videoEnCours.current;
      void envoi.current?.annuler().catch(() => {});
      if (id) void annulerEnvoiVideoKit({ produitId, genre, videoId: id }).catch(() => {});
    },
    [produitId, genre],
  );

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current || phase !== "repos") return;
    setErreur(null);
    setMessage(null);
    const fichier = refFichier.current?.files?.[0];
    if (!fichier) return setErreur(texteErreur("fichier_manquant"));
    const type = typeVideo(fichier);
    if (!(TYPES_VIDEO_KIT as readonly string[]).includes(type)) return setErreur(texteErreur("format_invalide"));
    if (fichier.size > max * MO) return setErreur(texteErreur("fichier_trop_lourd"));

    enVol.current = true;
    annule.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    let suite: Phase = "repos";
    try {
      const autorisation = await demanderEnvoiVideoKit({ produitId, genre, type, taille: fichier.size });
      if (autorisation.statut === "erreur") return setErreur(texteErreur(autorisation.erreur));
      const { envoi: signe } = autorisation;
      videoEnCours.current = signe.videoId;
      if (annule.current) {
        await annulerEnvoiVideoKit({ produitId, genre, videoId: signe.videoId });
        return;
      }
      const env = await demarrerEnvoiBunny({
        fichier,
        autorisation: signe,
        onProgression: (envoyes, total) => {
          setReprise(false);
          setPourcentage(total > 0 ? Math.floor((envoyes / total) * 100) : 0);
        },
        onReprise: () => setReprise(true),
      });
      envoi.current = env;
      if (annule.current) {
        env.terminer.catch(() => {});
        await env.annuler();
        await annulerEnvoiVideoKit({ produitId, genre, videoId: signe.videoId });
        return;
      }
      try {
        await env.terminer;
      } catch {
        if (!annule.current) {
          setErreur(texteErreur("envoi_echec"));
          await annulerEnvoiVideoKit({ produitId, genre, videoId: signe.videoId });
        }
        return;
      }
      if (annule.current) return;
      // Envoi terminé : l'encodage commence chez Bunny ; la vidéo n'est enregistrée qu'une fois prête.
      setMessage(t("envoyee"));
      essais.current = 0;
      setEncodage(null);
      setVerificationArretee(false);
      suite = "encodage";
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      envoi.current = null;
      enVol.current = false;
      setReprise(false);
      if (suite === "repos") videoEnCours.current = null;
      setPhase(suite);
    }
  }

  async function annuler() {
    annule.current = true;
    const id = videoEnCours.current;
    await envoi.current?.annuler();
    if (id) {
      try {
        await annulerEnvoiVideoKit({ produitId, genre, videoId: id });
      } catch {
        // La vidéo orpheline peut être effacée à la main dans la bibliothèque Bunny ; l'envoi est de toute façon arrêté.
      }
    }
    setMessage(t("annule"));
  }

  async function retirer() {
    if (enVol.current) return;
    enVol.current = true;
    setRetraitEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = genre === "complete" ? await supprimerVideoKit({ produitId }) : await retirerExtraitKit({ produitId });
      if (r.statut === "erreur") return setErreur(texteErreur(r.erreur));
      setMessage(t("retiree"));
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      enVol.current = false;
      setRetraitEnCours(false);
      setConfirmer(false);
    }
  }

  const idFichier = `${base}-fichier`;
  const occupe = phase !== "repos";

  return (
    <section aria-labelledby={`${base}-titre`} className="flex max-w-2xl flex-col gap-4">
      <h2 id={`${base}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-body text-text-secondary">{t("intro")}</p>
      {!bunnyConfigure ? <MessageEtat type="erreur">{t("bunnyAbsent")}</MessageEtat> : null}

      <div role="status" className="t-body text-text-primary">
        {phase === "repos" && presente ? (
          <p>{genre === "complete" && dureeSecondes !== null ? t("prete", { duree: formaterInstant(dureeSecondes) }) : t("prete")}</p>
        ) : null}
        {phase === "repos" && !presente ? <p>{indisponible ? t("sansVideo") : t("aucune")}</p> : null}
      </div>

      {presente && phase === "repos" ? (
        <div>
          <Bouton variante="secondaire" onClick={() => setConfirmer(true)}>
            {t("retirer")}
          </Bouton>
        </div>
      ) : null}

      {indisponible ? null : (
        <form onSubmit={surEnvoi} noValidate className="flex flex-col gap-3">
          <label htmlFor={idFichier} className="t-label text-text-primary">
            {t("fichier.libelle")}
          </label>
          <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
            {t("fichier.aide")}
          </p>
          <input
            ref={refFichier}
            id={idFichier}
            name={`video-${genre}`}
            type="file"
            accept={TYPES_VIDEO_KIT.join(",")}
            disabled={occupe}
            aria-describedby={`${idFichier}-aide`}
            className={CLASSE_CHAMP}
          />
          {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="submit" enCours={occupe} desactive={!bunnyConfigure} raison={t("bunnyAbsent")}>
              {presente ? t("remplacer") : t("envoyer")}
            </Bouton>
            {phase === "envoi" ? (
              <Bouton variante="secondaire" onClick={annuler}>
                {t("annuler")}
              </Bouton>
            ) : null}
            {phase === "encodage" && verificationArretee ? (
              <Bouton
                variante="secondaire"
                onClick={() => {
                  essais.current = 0;
                  setVerificationArretee(false);
                  setRelance((n) => n + 1);
                }}
              >
                {t("verifier")}
              </Bouton>
            ) : null}
          </div>
          {/* Progression : valeur en texte, jamais la barre seule. */}
          {phase === "envoi" ? (
            <div className="flex flex-col gap-2" aria-live="off">
              <progress value={pourcentage} max={100} aria-label={t("progression", { pourcentage })} className="h-3 w-full" />
              <p className="t-small text-text-primary">{t("progression", { pourcentage })}</p>
              {reprise ? <p className="t-small text-text-secondary">{t("reprise")}</p> : null}
            </div>
          ) : null}
          <div role="status" className="flex flex-col gap-2">
            {phase === "encodage" ? (
              <>
                <p className="t-small text-text-primary">{encodage === null ? t("verification") : t("encodage", { pourcentage: encodage })}</p>
                <p className="t-small text-text-secondary">{t("resteSurPage")}</p>
              </>
            ) : null}
            {message ? <p className="t-small text-text-primary">{message}</p> : null}
          </div>
        </form>
      )}
      {indisponible && erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}

      <Dialogue
        ouvert={confirmer}
        onFermer={() => {
          if (!enVol.current) setConfirmer(false);
        }}
        titre={t("suppression.titre")}
      >
        <p className="t-body">{t("suppression.texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={retraitEnCours} onClick={() => setConfirmer(false)}>
            {t("suppression.annuler")}
          </button>
          <Bouton enCours={retraitEnCours} onClick={retirer}>
            {retraitEnCours ? t("suppression.enCours") : t("suppression.confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </section>
  );
}
