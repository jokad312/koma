"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { demarrerEnvoiBunny } from "@/lib/bunny/envoi-tus-navigateur";
import { annulerEnvoiVideo, demanderEnvoiVideo, finaliserVideo, supprimerVideo, verifierVideo } from "@/modules/accueil/heros-actions";
import { TYPES_VIDEO_HEROS, VIDEO_HEROS_TAILLE_MAX } from "@/modules/accueil/heros-types";
import type { EnvoiTus } from "@/lib/supabase/envoi-tus";
import { CLASSE_CHAMP } from "../ChampTexte";

type Phase = "repos" | "envoi" | "finalisation";
// Vérification : l'état vient toujours de l'API de Bunny et du fichier réel, jamais d'une supposition.
type Verification = "aucune" | "en_cours" | "prete" | "erreur";

const INTERVALLE_MS = 5000;
// Au-delà, la vérification automatique s'arrête (le bouton « Vérifier maintenant » reste).
const ESSAIS_MAX = 120;

// Vidéo du héros : autorisation signée par le serveur, envoi TUS direct vers la bibliothèque Bunny publique (progression en texte, reprise,
// annulation), puis vérification de l'encodage et du fichier. La vidéo n'est montrée au public qu'une fois vérifiée.
export function VideoHerosAdmin({ videoId, prete, bunnyConfigure }: { videoId: string | null; prete: boolean; bunnyConfigure: boolean }) {
  const t = useTranslations("Admin.reglages.heros");
  const router = useRouter();
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [verification, setVerification] = useState<Verification>(prete ? "prete" : videoId ? "en_cours" : "aucune");
  const [encodage, setEncodage] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurVerif, setErreurVerif] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Incrémenté par « Vérifier maintenant » : relance la vérification automatique même si l'état n'a pas changé.
  const [relance, setRelance] = useState(0);
  const envoi = useRef<EnvoiTus | null>(null);
  const idVideoEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);
  const essais = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const texteErreur = useCallback((code: string) => (t.has(`erreurs.${code}`) ? t(`erreurs.${code}`) : t("erreurs.generique")), [t]);

  const verifier = useCallback(async () => {
    try {
      const r = await verifierVideo();
      if (r.statut === "erreur") {
        setErreurVerif(texteErreur(r.erreur));
        setVerification("erreur");
        return "fin" as const;
      }
      setErreurVerif(null);
      if (r.video.etat === "prete") {
        setVerification("prete");
        router.refresh();
        return "fin" as const;
      }
      setEncodage(r.video.progression);
      setVerification("en_cours");
      return "encore" as const;
    } catch {
      setErreurVerif(t("erreurs.generique"));
      setVerification("erreur");
      return "fin" as const;
    }
  }, [router, t, texteErreur]);

  // Vérification automatique tant que la vidéo enregistrée n'est pas prête.
  useEffect(() => {
    if (verification !== "en_cours") return;
    let actif = true;
    const boucle = async () => {
      essais.current += 1;
      const suite = await verifier();
      if (!actif || suite === "fin") return;
      if (essais.current >= ESSAIS_MAX) return;
      minuteur.current = setTimeout(boucle, INTERVALLE_MS);
    };
    minuteur.current = setTimeout(boucle, 0);
    return () => {
      actif = false;
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [verification, verifier, relance]);

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);
    const fichier = refFichier.current?.files?.[0];
    if (!fichier) return setErreur(texteErreur("fichier_manquant"));
    if (!(TYPES_VIDEO_HEROS as readonly string[]).includes(fichier.type)) return setErreur(texteErreur("type_invalide"));
    if (fichier.size > VIDEO_HEROS_TAILLE_MAX) return setErreur(texteErreur("fichier_trop_lourd"));

    enVol.current = true;
    annule.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiVideo({ type: fichier.type, taille: fichier.size });
      if (autorisation.statut === "erreur") return setErreur(texteErreur(autorisation.erreur));
      const { envoi: signe } = autorisation;
      idVideoEnCours.current = signe.videoId;
      if (annule.current) {
        await annulerEnvoiVideo({ videoId: signe.videoId });
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
        await annulerEnvoiVideo({ videoId: signe.videoId });
        return;
      }
      try {
        await env.terminer;
      } catch {
        if (!annule.current) {
          setErreur(texteErreur("envoi_echec"));
          await annulerEnvoiVideo({ videoId: signe.videoId });
        }
        return;
      }
      if (annule.current) return;

      setPhase("finalisation");
      const fini = await finaliserVideo({ videoId: signe.videoId });
      if (fini.statut === "erreur") {
        setErreur(texteErreur(fini.erreur));
        return;
      }
      setMessage(t("video.envoyee"));
      if (refFichier.current) refFichier.current.value = "";
      essais.current = 0;
      setEncodage(null);
      setErreurVerif(null);
      setVerification("en_cours");
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      envoi.current = null;
      idVideoEnCours.current = null;
      enVol.current = false;
      setPhase("repos");
      setReprise(false);
    }
  }

  async function annuler() {
    annule.current = true;
    const id = idVideoEnCours.current;
    await envoi.current?.annuler();
    if (id) {
      try {
        await annulerEnvoiVideo({ videoId: id });
      } catch {
        // La vidéo orpheline chez Bunny peut être effacée à la main dans sa bibliothèque ; l'envoi est de toute façon arrêté.
      }
    }
    setMessage(t("video.annule"));
  }

  async function retirer() {
    if (enVol.current) return;
    enVol.current = true;
    setErreur(null);
    setMessage(null);
    try {
      const r = await supprimerVideo();
      if (r.statut === "erreur") return setErreur(texteErreur(r.erreur));
      setVerification("aucune");
      setErreurVerif(null);
      setMessage(t("video.retiree"));
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      enVol.current = false;
    }
  }

  async function reverifier() {
    essais.current = 0;
    setErreurVerif(null);
    setVerification("en_cours");
    setRelance((n) => n + 1);
  }

  const occupe = phase !== "repos";
  const idFichier = `${base}-fichier`;
  const aVideo = videoId !== null || verification !== "aucune";

  return (
    <section aria-labelledby={`${base}-titre`} className="flex max-w-2xl flex-col gap-4">
      <h3 id={`${base}-titre`} className="t-h3">
        {t("video.titre")}
      </h3>
      <p className="t-small text-text-secondary">{t("video.intro")}</p>
      {!bunnyConfigure ? <MessageEtat type="erreur">{t("bunnyAbsent")}</MessageEtat> : null}

      <div role="status" className="flex flex-col gap-1 t-body text-text-primary">
        {verification === "prete" ? <p>{t("video.prete")}</p> : null}
        {verification === "en_cours" ? <p>{encodage === null ? t("video.verification") : t("video.encodage", { pourcentage: encodage })}</p> : null}
        {verification === "aucune" && !aVideo ? <p>{t("video.aucune")}</p> : null}
      </div>
      {verification === "erreur" && erreurVerif ? <MessageEtat type="erreur">{erreurVerif}</MessageEtat> : null}

      <div className="flex flex-wrap gap-3">
        {verification === "en_cours" || verification === "erreur" ? (
          <Bouton variante="secondaire" onClick={reverifier}>
            {t("video.verifier")}
          </Bouton>
        ) : null}
        {verification !== "aucune" ? (
          <Bouton variante="secondaire" onClick={retirer} desactive={occupe} raison={t("video.envoiEnCours")}>
            {t("video.retirer")}
          </Bouton>
        ) : null}
      </div>

      <form onSubmit={surEnvoi} noValidate className="flex flex-col gap-3">
        <label htmlFor={idFichier} className="t-label text-text-primary">
          {t("video.fichier.libelle")}
        </label>
        <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
          {t("video.fichier.aide")}
        </p>
        <input
          ref={refFichier}
          id={idFichier}
          name="video"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={occupe}
          aria-describedby={`${idFichier}-aide`}
          className={CLASSE_CHAMP}
        />
        {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="submit" enCours={occupe}>
            {videoId || verification !== "aucune" ? t("video.remplacer") : t("video.envoyer")}
          </Bouton>
          {phase === "envoi" ? (
            <Bouton variante="secondaire" onClick={annuler}>
              {t("video.annuler")}
            </Bouton>
          ) : null}
        </div>
        <div role="status" className="flex flex-col gap-2">
          {phase === "envoi" ? (
            <>
              <progress value={pourcentage} max={100} aria-label={t("video.progression", { pourcentage })} className="h-3 w-full" />
              <p className="t-small text-text-primary">{t("video.progression", { pourcentage })}</p>
              {reprise ? <p className="t-small text-text-secondary">{t("video.reprise")}</p> : null}
            </>
          ) : null}
          {phase === "finalisation" ? <p className="t-small text-text-primary">{t("video.finalisation")}</p> : null}
          {message ? <p className="t-small text-text-primary">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}
