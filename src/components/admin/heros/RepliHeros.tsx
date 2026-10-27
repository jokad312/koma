"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { annulerEnvoiRepli, demanderEnvoiRepli, finaliserRepli, modifierAltRepli } from "@/modules/accueil/heros-actions";
import { FORMATS_PHOTO, PHOTO_TAILLE_MAX } from "@/modules/catalogue/types";
import { ChampTexte, CLASSE_CHAMP } from "../ChampTexte";

type Phase = "repos" | "envoi" | "traitement";
type ErreurRepli = { code: string; champ: "fichier" | "alt_fr" | "alt_en" | null };

type Props = { url: string | null; altFr: string | null; altEn: string | null };

// Photo de repli du héros : même passage que les photos de produit (contrôles avant envoi, autorisation signée, envoi TUS direct, ré-encodage
// sans métadonnée par le serveur). Les deux textes alternatifs sont obligatoires et corrigeables sans renvoyer la photo.
export function RepliHeros({ url, altFr: altFrActuel, altEn: altEnActuel }: Props) {
  const t = useTranslations("Admin.reglages.heros");
  const router = useRouter();
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [altFr, setAltFr] = useState(altFrActuel ?? "");
  const [altEn, setAltEn] = useState(altEnActuel ?? "");
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<ErreurRepli | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enregistrementAlt, setEnregistrementAlt] = useState(false);
  const envoi = useRef<EnvoiTus | null>(null);
  const objetEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);

  const code = (c: string) => (t.has(`erreurs.${c}`) ? c : "generique");
  const erreurDe = (champ: ErreurRepli["champ"]) => (erreur && erreur.champ === champ ? t(`erreurs.${code(erreur.code)}`) : null);
  const champDe = (c: string): ErreurRepli["champ"] => (c === "alt_invalide" ? "alt_fr" : c === "format_invalide" || c === "fichier_trop_lourd" ? "fichier" : null);

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);
    const fichier = refFichier.current?.files?.[0];
    if (!fichier) return setErreur({ code: "fichier_manquant", champ: "fichier" });
    if (!Object.hasOwn(FORMATS_PHOTO, fichier.type)) return setErreur({ code: "format_invalide", champ: "fichier" });
    if (fichier.size > PHOTO_TAILLE_MAX) return setErreur({ code: "fichier_trop_lourd", champ: "fichier" });
    if (altFr.trim() === "" || altFr.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "alt_fr" });
    if (altEn.trim() === "" || altEn.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "alt_en" });

    enVol.current = true;
    annule.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiRepli({ type: fichier.type, taille: fichier.size, altFr, altEn });
      if (autorisation.statut === "erreur") return setErreur({ code: autorisation.erreur, champ: champDe(autorisation.erreur) });
      objetEnCours.current = autorisation.objet;
      if (annule.current) {
        await annulerEnvoiRepli({ objet: autorisation.objet });
        return;
      }
      const env = lireEnvPublique();
      const tus = await demarrerEnvoiTus({
        fichier,
        contentType: fichier.type,
        objet: autorisation.objet,
        jeton: autorisation.jeton,
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
        await annulerEnvoiRepli({ objet: autorisation.objet });
        return;
      }
      try {
        await tus.terminer;
      } catch {
        if (!annule.current) setErreur({ code: "envoi_echec", champ: null });
        return;
      }
      if (annule.current) return;

      setPhase("traitement");
      const fini = await finaliserRepli({ objet: autorisation.objet, altFr, altEn });
      if (fini.statut === "erreur") return setErreur({ code: fini.erreur, champ: champDe(fini.erreur) });
      setMessage(t("repli.succes"));
      if (refFichier.current) refFichier.current.value = "";
      router.refresh();
    } catch {
      setErreur({ code: "generique", champ: null });
    } finally {
      envoi.current = null;
      objetEnCours.current = null;
      enVol.current = false;
      setPhase("repos");
      setReprise(false);
    }
  }

  async function annuler() {
    annule.current = true;
    const objet = objetEnCours.current;
    await envoi.current?.annuler();
    if (objet) {
      try {
        await annulerEnvoiRepli({ objet });
      } catch {
        // Le nettoyage est refait par la purge de galerie-attente ; l'envoi est de toute façon arrêté.
      }
    }
    setMessage(t("repli.annule"));
  }

  async function corrigerTextes() {
    if (enVol.current) return;
    enVol.current = true;
    setEnregistrementAlt(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await modifierAltRepli({ altFr, altEn });
      if (r.statut === "erreur") return setErreur({ code: r.erreur, champ: champDe(r.erreur) });
      setMessage(t("repli.altSucces"));
      router.refresh();
    } catch {
      setErreur({ code: "generique", champ: null });
    } finally {
      enVol.current = false;
      setEnregistrementAlt(false);
    }
  }

  const occupe = phase !== "repos" || enregistrementAlt;
  const idFichier = `${base}-fichier`;
  const erreurFichier = erreurDe("fichier");
  const erreurGenerale = erreur && erreur.champ === null ? t(`erreurs.${code(erreur.code)}`) : null;

  return (
    <section aria-labelledby={`${base}-titre`} className="flex max-w-2xl flex-col gap-4">
      <h3 id={`${base}-titre`} className="t-h3">
        {t("repli.titre")}
      </h3>
      <p className="t-small text-text-secondary">{t("repli.intro")}</p>
      {url && altFrActuel ? (
        <figure className="flex flex-col gap-2">
          <Image src={url} alt={altFrActuel} width={320} height={200} className="h-auto max-w-xs rounded-md border border-border object-cover" />
          <figcaption className="t-small text-text-secondary">{t("repli.actuelle")}</figcaption>
        </figure>
      ) : (
        <p className="t-body text-text-primary">{t("repli.aucune")}</p>
      )}

      <form onSubmit={surEnvoi} noValidate className="flex flex-col gap-4">
        {erreurGenerale ? <MessageEtat type="erreur">{erreurGenerale}</MessageEtat> : null}
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={idFichier} className="t-label text-text-primary">
            {t("repli.fichier.libelle")}
          </label>
          <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
            {t("repli.fichier.aide")}
          </p>
          <input
            ref={refFichier}
            id={idFichier}
            name="fichier"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={occupe}
            aria-invalid={erreurFichier ? true : undefined}
            aria-describedby={`${idFichier}-aide${erreurFichier ? ` ${idFichier}-erreur` : ""}`}
            className={CLASSE_CHAMP}
          />
          {erreurFichier ? (
            <p id={`${idFichier}-erreur`} className="t-small text-danger">
              {erreurFichier}
            </p>
          ) : null}
        </div>
        <ChampTexte id={`${base}-alt-fr`} name="alt_fr" libelle={t("repli.altFr.libelle")} aide={t("repli.altFr.aide")} valeur={altFr} onChange={setAltFr} erreur={erreurDe("alt_fr")} />
        <ChampTexte id={`${base}-alt-en`} name="alt_en" libelle={t("repli.altEn.libelle")} aide={t("repli.altEn.aide")} valeur={altEn} onChange={setAltEn} erreur={erreurDe("alt_en")} />
        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="submit" enCours={phase !== "repos"}>
            {url ? t("repli.remplacer") : t("repli.envoyer")}
          </Bouton>
          {url ? (
            <Bouton variante="secondaire" onClick={corrigerTextes} enCours={enregistrementAlt}>
              {t("repli.corrigerTextes")}
            </Bouton>
          ) : null}
          {phase === "envoi" ? (
            <Bouton variante="secondaire" onClick={annuler}>
              {t("repli.annuler")}
            </Bouton>
          ) : null}
        </div>
        <div role="status" className="flex flex-col gap-2">
          {phase === "envoi" ? (
            <>
              <progress value={pourcentage} max={100} aria-label={t("repli.progression", { pourcentage })} className="h-3 w-full" />
              <p className="t-small text-text-primary">{t("repli.progression", { pourcentage })}</p>
              {reprise ? <p className="t-small text-text-secondary">{t("repli.reprise")}</p> : null}
            </>
          ) : null}
          {phase === "traitement" ? <p className="t-small text-text-primary">{t("repli.traitement")}</p> : null}
          {message ? <p className="t-small text-text-primary">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}
