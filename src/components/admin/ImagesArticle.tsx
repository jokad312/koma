"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { annulerEnvoiImageArticle, demanderEnvoiImageArticle, finaliserImageArticle } from "@/modules/blog/actions";
import { FORMATS_IMAGE_ARTICLE, IMAGE_ARTICLE_TAILLE_MAX, IMAGES_ARTICLE_MAX, type ArticleImage, type CodeErreurBlog } from "@/modules/blog/types";
import { ChampTexte, CLASSE_CHAMP } from "./ChampTexte";

type Phase = "repos" | "envoi" | "traitement";
type ErreurEnvoi = { code: CodeErreurBlog; champ: "fichier" | "alt_fr" | "alt_en" | null };

// Images de l'article : mêmes règles que les photos de produit (type, taille, textes alternatifs FR et EN obligatoires,
// envoi TUS direct, contenu nettoyé côté serveur). La liste vit dans le formulaire et n'est enregistrée qu'à la sauvegarde ;
// un retrait retire l'entrée de la liste, le fichier public est effacé par le serveur après la sauvegarde si plus personne ne le cite.
export function ImagesArticle({
  images,
  onChange,
  desactive = false,
}: {
  images: ArticleImage[];
  onChange: (images: ArticleImage[]) => void;
  desactive?: boolean;
}) {
  const t = useTranslations("Admin.blog.images");
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [altFr, setAltFr] = useState("");
  const [altEn, setAltEn] = useState("");
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<ErreurEnvoi | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const envoi = useRef<EnvoiTus | null>(null);
  const objetEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);

  const code = (c: string) => (c in t.raw("erreurs") ? c : "generique");
  const erreurDe = (champ: ErreurEnvoi["champ"]) => (erreur && erreur.champ === champ ? t(`erreurs.${code(erreur.code)}`) : null);

  const complet = images.length >= IMAGES_ARTICLE_MAX;

  // Cette zone vit DANS le formulaire de l'article : pas de <form> imbriqué (invalide en HTML, hydratation fragile, risque d'envoyer
  // le mauvais formulaire). L'ajout est un bouton type="button" ; Entrée dans un champ de l'ajout lance l'ajout, jamais l'enregistrement.
  async function surEnvoi() {
    if (enVol.current || desactive) return;
    setErreur(null);
    setMessage(null);

    const fichier = refFichier.current?.files?.[0];
    if (!fichier) return setErreur({ code: "format_invalide", champ: "fichier" });
    if (!Object.hasOwn(FORMATS_IMAGE_ARTICLE, fichier.type)) return setErreur({ code: "format_invalide", champ: "fichier" });
    if (fichier.size > IMAGE_ARTICLE_TAILLE_MAX) return setErreur({ code: "fichier_trop_lourd", champ: "fichier" });
    if (altFr.trim() === "" || altFr.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "alt_fr" });
    if (altEn.trim() === "" || altEn.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "alt_en" });

    enVol.current = true;
    annule.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiImageArticle({ type: fichier.type, taille: fichier.size });
      if (autorisation.statut === "erreur") {
        setErreur({ code: autorisation.erreur, champ: autorisation.erreur === "format_invalide" || autorisation.erreur === "fichier_trop_lourd" ? "fichier" : null });
        return;
      }
      objetEnCours.current = autorisation.objet;
      if (annule.current) {
        await annulerEnvoiImageArticle({ objet: autorisation.objet });
        return;
      }
      const env = await envoyer(fichier, autorisation.objet, autorisation.jeton);
      envoi.current = env;
      if (annule.current) {
        env.terminer.catch(() => {});
        await env.annuler();
        await annulerEnvoiImageArticle({ objet: autorisation.objet });
        return;
      }
      try {
        await env.terminer;
      } catch {
        if (!annule.current) setErreur({ code: "generique", champ: null });
        return;
      }
      if (annule.current) return;

      setPhase("traitement");
      const fini = await finaliserImageArticle({ objet: autorisation.objet, altFr, altEn });
      if (fini.statut === "erreur") {
        setErreur({ code: fini.erreur, champ: fini.erreur === "format_invalide" || fini.erreur === "fichier_trop_lourd" ? "fichier" : fini.erreur === "alt_invalide" ? "alt_fr" : null });
        return;
      }
      // Réponse réelle reçue : l'image entre dans la liste du formulaire (pas encore en base).
      onChange([...images, fini.image]);
      setMessage(t("ajout.succes"));
      setAltFr("");
      setAltEn("");
      if (refFichier.current) refFichier.current.value = "";
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

  function envoyer(fichier: File, objet: string, jeton: string): Promise<EnvoiTus> {
    const env = lireEnvPublique();
    return demarrerEnvoiTus({
      fichier,
      contentType: fichier.type,
      objet,
      jeton,
      adresseSupabase: env.NEXT_PUBLIC_SUPABASE_URL,
      clePublique: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      onProgression: (envoyes, total) => {
        setReprise(false);
        setPourcentage(total > 0 ? Math.floor((envoyes / total) * 100) : 0);
      },
      onReprise: () => setReprise(true),
    });
  }

  async function annuler() {
    annule.current = true;
    const objet = objetEnCours.current;
    await envoi.current?.annuler();
    if (objet) {
      try {
        await annulerEnvoiImageArticle({ objet });
      } catch {
        // Le nettoyage du bucket d'attente est refait par la tâche de purge ; l'envoi est de toute façon arrêté.
      }
    }
    setMessage(t("ajout.annule"));
  }

  const occupe = phase !== "repos" || desactive;
  const idFichier = `${base}-fichier`;
  const erreurFichier = erreurDe("fichier");
  const erreurGenerale = erreur && erreur.champ === null ? t(`erreurs.${code(erreur.code)}`) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="t-small text-text-secondary">{t("nombre", { nombre: images.length, max: IMAGES_ARTICLE_MAX })}</p>
      {images.length === 0 ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
      {images.length > 0 ? (
        <ol aria-label={t("legende")} className="flex flex-col gap-3">
          {images.map((image, i) => (
            <li key={image.fichier} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-3">
              <Image
                src={urlPhotoPublique(image.fichier)}
                alt={image.altFr}
                width={96}
                height={96}
                sizes="96px"
                className="size-24 shrink-0 rounded-md object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="t-label">{t("image", { numero: i + 1 })}</p>
                <p className="t-small break-words text-text-secondary">{t("texteFr", { texte: image.altFr })}</p>
                <p className="t-small break-words text-text-secondary">{t("texteEn", { texte: image.altEn })}</p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-3 text-danger"
                onClick={() => onChange(images.filter((autre) => autre.fichier !== image.fichier))}
                disabled={desactive || phase !== "repos"}
              >
                {t("retirer", { numero: i + 1 })}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {complet ? (
        <p className="t-small text-text-secondary">{t("erreurs.images_limite")}</p>
      ) : (
        <div
          role="group"
          aria-labelledby={`${base}-ajout-titre`}
          onKeyDown={(e) => {
            // Seulement Entrée dans un champ texte : pas sur un bouton, ni sur le champ fichier (Entrée y ouvre le sélecteur), ni pendant une composition IME.
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            if (!(e.target instanceof HTMLInputElement) || e.target.type !== "text") return;
            e.preventDefault();
            void surEnvoi();
          }}
          className="flex flex-col gap-4"
        >
          <h3 id={`${base}-ajout-titre`} className="t-h3">
            {t("ajout.titre")}
          </h3>
          {erreurGenerale ? <MessageEtat type="erreur">{erreurGenerale}</MessageEtat> : null}
          <div className="flex w-full flex-col gap-2">
            <label htmlFor={idFichier} className="t-label text-text-primary">
              {t("ajout.fichier.libelle")}
            </label>
            <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
              {t("ajout.fichier.aide")}
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

          <ChampTexte id={`${base}-alt-fr`} name="alt_fr" libelle={t("ajout.altFr.libelle")} aide={t("ajout.altFr.aide")} valeur={altFr} onChange={setAltFr} erreur={erreurDe("alt_fr")} />
          <ChampTexte id={`${base}-alt-en`} name="alt_en" libelle={t("ajout.altEn.libelle")} aide={t("ajout.altEn.aide")} valeur={altEn} onChange={setAltEn} erreur={erreurDe("alt_en")} />

          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="button" onClick={() => void surEnvoi()} enCours={occupe}>
              {t("ajout.ajouter")}
            </Bouton>
            {phase === "envoi" ? (
              <Bouton variante="secondaire" onClick={annuler}>
                {t("ajout.annuler")}
              </Bouton>
            ) : null}
          </div>

          <div role="status" className="flex flex-col gap-2">
            {phase === "envoi" ? (
              <>
                <progress value={pourcentage} max={100} aria-label={t("ajout.progression", { pourcentage })} className="h-3 w-full" />
                <p className="t-small text-text-primary">{t("ajout.progression", { pourcentage })}</p>
                {reprise ? <p className="t-small text-text-secondary">{t("ajout.reprise")}</p> : null}
              </>
            ) : null}
            {phase === "traitement" ? <p className="t-small text-text-primary">{t("ajout.traitement")}</p> : null}
            {message ? <p className="t-small text-text-primary">{message}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
