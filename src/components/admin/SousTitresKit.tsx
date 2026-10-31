"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { BUCKET_KITS } from "@/lib/supabase/stockage";
import { annulerEnvoiSousTitres, demanderEnvoiSousTitres, finaliserSousTitres, supprimerSousTitres } from "@/modules/catalogue/actions";
import { tailleLisible } from "@/modules/catalogue/fichiers-kit";
import { LANGUES_SOUS_TITRES, SOUS_TITRES_TAILLE_MAX } from "@/modules/catalogue/types";
import type { LangueSousTitres, SousTitreAdmin } from "@/modules/catalogue/types";
import { CLASSE_CHAMP } from "./ChampTexte";

type Phase = "repos" | "envoi" | "traitement";

// Sous-titres d'une langue : état (version, taille), envoi signé vers kits-private (progression, reprise, « Annuler l'envoi »), vérification
// du contenu WebVTT côté serveur, suppression avec confirmation. Le succès n'est affiché qu'après la réponse réelle du serveur.
function SousTitresLangue({ produitId, langue, sousTitre }: { produitId: string; langue: LangueSousTitres; sousTitre: SousTitreAdmin | null }) {
  const t = useTranslations("Admin.kits.sousTitres");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const envoi = useRef<EnvoiTus | null>(null);
  const objetEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);
  const envoiTermine = useRef(false);

  const nomLangue = t(`nomsLangues.${langue}`);
  const texteErreur = (code: string) => t(`erreurs.${t.has(`erreurs.${code}`) ? code : "generique"}`);
  const taille = (octets: number) => {
    const { valeur, unite } = tailleLisible(octets, locale);
    return t(`taille.${unite}`, { valeur });
  };

  // Quitter la page pendant un envoi ou une vérification : le navigateur demande confirmation.
  const phaseCourante = useRef<Phase>("repos");
  useEffect(() => {
    phaseCourante.current = phase;
    if (phase === "repos") return;
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [phase]);

  // Démontage pendant l'envoi : l'envoi TUS est arrêté et l'objet non enregistré effacé.
  useEffect(
    () => () => {
      if (phaseCourante.current !== "envoi") return;
      annule.current = true;
      const objet = objetEnCours.current;
      void envoi.current?.annuler().catch(() => {});
      if (objet) void annulerEnvoiSousTitres({ produitId, objet }).catch(() => {});
    },
    [produitId],
  );

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);
    const f = refFichier.current?.files?.[0];
    if (!f) return setErreur(texteErreur("fichier_manquant"));
    if (!/[.]vtt$/i.test(f.name) || f.size < 1) return setErreur(texteErreur("format_invalide"));
    if (f.size > SOUS_TITRES_TAILLE_MAX) return setErreur(texteErreur("fichier_trop_lourd"));

    enVol.current = true;
    annule.current = false;
    envoiTermine.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiSousTitres({ produitId, langue, nomFichier: f.name, taille: f.size });
      if (autorisation.statut === "erreur") return setErreur(texteErreur(autorisation.erreur));
      objetEnCours.current = autorisation.objet;
      if (annule.current) {
        await annulerEnvoiSousTitres({ produitId, objet: autorisation.objet });
        return;
      }
      const env = lireEnvPublique();
      const tus = await demarrerEnvoiTus({
        fichier: f,
        contentType: autorisation.contentType,
        objet: autorisation.objet,
        jeton: autorisation.jeton,
        bucket: BUCKET_KITS,
        adresseSupabase: env.NEXT_PUBLIC_SUPABASE_URL,
        clePublique: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        onProgression: (envoyes, total) => {
          setReprise(false);
          setPourcentage(total > 0 ? Math.floor((envoyes / total) * 100) : 0);
        },
        onReprise: () => setReprise(true),
      });
      envoi.current = tus;
      if (annule.current) {
        tus.terminer.catch(() => {});
        await tus.annuler();
        await annulerEnvoiSousTitres({ produitId, objet: autorisation.objet });
        return;
      }
      try {
        await tus.terminer;
      } catch {
        if (!annule.current) {
          setErreur(texteErreur("envoi_echec"));
          await annulerEnvoiSousTitres({ produitId, objet: autorisation.objet });
        }
        return;
      }
      if (annule.current) return;
      envoiTermine.current = true;
      setPhase("traitement");
      const fini = await finaliserSousTitres({ produitId, langue, objet: autorisation.objet, taille: f.size });
      if (fini.statut === "erreur") return setErreur(texteErreur(fini.erreur));
      setMessage(t("envoyes"));
      if (refFichier.current) refFichier.current.value = "";
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      envoi.current = null;
      objetEnCours.current = null;
      enVol.current = false;
      setPhase("repos");
      setReprise(false);
    }
  }

  async function annuler() {
    if (envoiTermine.current) return;
    annule.current = true;
    const objet = objetEnCours.current;
    await envoi.current?.annuler();
    if (objet) {
      try {
        await annulerEnvoiSousTitres({ produitId, objet });
      } catch {
        // L'objet non enregistré n'est jamais lu ; l'envoi est de toute façon arrêté.
      }
    }
    setMessage(t("annule"));
  }

  async function supprimer() {
    if (enVol.current) return;
    enVol.current = true;
    setSuppressionEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await supprimerSousTitres({ produitId, langue });
      if (r.statut === "erreur") return setErreur(texteErreur(r.erreur));
      setMessage(t("supprimes"));
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      enVol.current = false;
      setSuppressionEnCours(false);
      setConfirmer(false);
    }
  }

  const occupe = phase !== "repos";
  const idFichier = `${base}-fichier`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="t-h3">{t(`langues.${langue}`)}</h3>
      <p className="t-small text-text-secondary">{t(langue === "fr" ? "obligatoire" : "facultatif")}</p>
      <p className="t-body text-text-primary">{sousTitre ? t("presents", { version: sousTitre.version, taille: taille(sousTitre.tailleOctets) }) : t("absents")}</p>
      {sousTitre ? (
        <div>
          <Bouton variante="secondaire" onClick={() => setConfirmer(true)} desactive={occupe} raison={t("envoiEnCours")}>
            {t("supprimer", { langue: nomLangue })}
          </Bouton>
        </div>
      ) : null}
      <form onSubmit={surEnvoi} noValidate className="flex flex-col gap-3">
        <label htmlFor={idFichier} className="t-label text-text-primary">
          {t("fichier.libelle", { langue: nomLangue })}
        </label>
        <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
          {t("fichier.aide")}
        </p>
        <input
          ref={refFichier}
          id={idFichier}
          name={`sous-titres-${langue}`}
          type="file"
          accept=".vtt,text/vtt"
          disabled={occupe}
          aria-describedby={`${idFichier}-aide`}
          className={CLASSE_CHAMP}
        />
        {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="submit" enCours={occupe}>
            {sousTitre ? t("remplacer", { langue: nomLangue }) : t("envoyer", { langue: nomLangue })}
          </Bouton>
          {phase === "envoi" ? (
            <Bouton variante="secondaire" onClick={annuler}>
              {t("annuler")}
            </Bouton>
          ) : null}
        </div>
        {phase === "envoi" ? (
          <div className="flex flex-col gap-2" aria-live="off">
            <progress value={pourcentage} max={100} aria-label={t("progression", { pourcentage })} className="h-3 w-full" />
            <p className="t-small text-text-primary">{t("progression", { pourcentage })}</p>
            {reprise ? <p className="t-small text-text-secondary">{t("reprise")}</p> : null}
          </div>
        ) : null}
        <div role="status" className="flex flex-col gap-2">
          {phase === "traitement" ? <p className="t-small text-text-primary">{t("traitement")}</p> : null}
          {message ? <p className="t-small text-text-primary">{message}</p> : null}
        </div>
      </form>
      <Dialogue
        ouvert={confirmer}
        onFermer={() => {
          if (!enVol.current) setConfirmer(false);
        }}
        titre={t("suppression.titre", { langue: nomLangue })}
      >
        <p className="t-body">{t("suppression.texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={suppressionEnCours} onClick={() => setConfirmer(false)}>
            {t("suppression.annuler")}
          </button>
          <Bouton enCours={suppressionEnCours} onClick={supprimer}>
            {suppressionEnCours ? t("suppression.enCours") : t("suppression.confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </div>
  );
}

// Section « Sous-titres » d'un Kit : français (obligatoire pour publier) puis anglais (facultatif).
export function SousTitresKit({ produitId, sousTitres }: { produitId: string; sousTitres: readonly SousTitreAdmin[] }) {
  const t = useTranslations("Admin.kits.sousTitres");
  const base = useId();
  return (
    <section aria-labelledby={`${base}-titre`} className="flex max-w-2xl flex-col gap-4">
      <h2 id={`${base}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-body text-text-secondary">{t("intro")}</p>
      {LANGUES_SOUS_TITRES.map((langue) => (
        <SousTitresLangue key={langue} produitId={produitId} langue={langue} sousTitre={sousTitres.find((s) => s.langue === langue) ?? null} />
      ))}
    </section>
  );
}
