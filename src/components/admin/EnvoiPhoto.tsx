"use client";

import { ImageIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { nb } from "@/components/ui/Nombre";
import Image from "next/image";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { useDansFenetre, useEnregistrementFenetre } from "./ui/FenetreFormulaire";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { annulerEnvoiPhoto, demanderEnvoiPhoto, finaliserPhoto } from "@/modules/catalogue/actions";
import { FORMATS_PHOTO, PHOTO_TAILLE_MAX } from "@/modules/catalogue/types";
import type { PhotoAdmin } from "@/modules/catalogue/types";
import { ChampTexte } from "./ChampTexte";

type Phase = "repos" | "envoi" | "traitement";
type ErreurEnvoi = { code: string; champ: "fichier" | "alt_fr" | "alt_en" | null };

// Ajout d'une photo : contrôles avant tout envoi (type, taille, textes alternatifs), autorisation signée par le serveur, envoi TUS direct
// du navigateur (progression en texte, reprise après coupure, annulation), puis finalisation côté serveur. Le succès n'est affiché qu'après
// la réponse réelle de la finalisation.
// Story 9.16 f (maquette D13) : vignette (photo principale, sinon une icône : jamais une image inventée), « Choisir une image » et la limite réelle (Q25).
export function EnvoiPhoto({ produitId, vignette = null }: { produitId: string; vignette?: PhotoAdmin | null }) {
  const t = useTranslations("Admin.produits.photos");
  const locale = useLocale();
  const [nomChoisi, setNomChoisi] = useState<string | null>(null);
  const router = useRouter();
  // Dans la fenêtre (9.16 f), un titre plus petit sous l'étiquette de la zone.
  const dansFenetre = useDansFenetre();
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

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);

    // Contrôles avant tout envoi.
    const fichier = refFichier.current?.files?.[0];
    if (!fichier) return setErreur({ code: "fichier_manquant", champ: "fichier" });
    if (!Object.hasOwn(FORMATS_PHOTO, fichier.type)) return setErreur({ code: "format_invalide", champ: "fichier" });
    if (fichier.size > PHOTO_TAILLE_MAX) return setErreur({ code: "fichier_trop_lourd", champ: "fichier" });
    if (altFr.trim() === "" || altFr.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "alt_fr" });

    enVol.current = true;
    annule.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiPhoto({ produitId, type: fichier.type, taille: fichier.size, altFr, altEn });
      if (autorisation.statut === "erreur") {
        setErreur({ code: autorisation.erreur, champ: autorisation.erreur === "alt_invalide" ? "alt_fr" : autorisation.erreur === "format_invalide" || autorisation.erreur === "fichier_trop_lourd" ? "fichier" : null });
        return;
      }
      objetEnCours.current = autorisation.objet;
      // Annulation cliquée pendant l'autorisation : rien n'est envoyé, l'objet signé est effacé par précaution.
      if (annule.current) {
        await annulerEnvoiPhoto({ produitId, objet: autorisation.objet });
        return;
      }
      const env = await envoyer(fichier, autorisation.objet, autorisation.jeton);
      envoi.current = env;
      // Annulation cliquée pendant le démarrage de l'envoi : on l'arrête aussitôt.
      if (annule.current) {
        env.terminer.catch(() => {});
        await env.annuler();
        await annulerEnvoiPhoto({ produitId, objet: autorisation.objet });
        return;
      }
      try {
        await env.terminer;
      } catch {
        if (!annule.current) setErreur({ code: "envoi_echec", champ: null });
        return;
      }
      if (annule.current) return;

      setPhase("traitement");
      const fini = await finaliserPhoto({ produitId, objet: autorisation.objet, altFr, altEn });
      if (fini.statut === "erreur") {
        setErreur({ code: fini.erreur, champ: fini.erreur === "format_invalide" || fini.erreur === "fichier_trop_lourd" ? "fichier" : fini.erreur === "alt_invalide" ? "alt_fr" : null });
        return;
      }
      // Réponse réelle reçue : le formulaire est vidé et la liste relue depuis la base.
      setMessage(t("ajout.succes"));
      setAltFr("");
      setAltEn("");
      if (refFichier.current) refFichier.current.value = "";
      setNomChoisi(null);
      enregistre();
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
        await annulerEnvoiPhoto({ produitId, objet });
      } catch {
        // Le nettoyage est refait à la prochaine tentative ; l'envoi est de toute façon arrêté.
      }
    }
    setMessage(t("ajout.annule"));
  }

  const occupe = phase !== "repos";
  // Dans la fenêtre (9.16 f) : un envoi en cours empêche de quitter ; un envoi réussi rend sa saisie « enregistrée ».
  const { enregistre, source } = useEnregistrementFenetre(occupe);
  const idFichier = `${base}-fichier`;
  const erreurFichier = erreurDe("fichier");
  const erreurGenerale = erreur && erreur.champ === null ? t(`erreurs.${code(erreur.code)}`) : null;

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-2xl flex-col gap-4" {...source}>
      <h3 className={dansFenetre ? "t-h3" : "t-h2"}>{t("ajout.titre")}</h3>
      {erreurGenerale ? <MessageEtat type="erreur">{erreurGenerale}</MessageEtat> : null}

      <div className="flex w-full flex-wrap items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-admin-champ text-text-secondary">
          {vignette ? (
            <Image
              src={urlPhotoPublique(vignette.fichier)}
              alt={locale === "en" ? vignette.altEn : vignette.altFr}
              width={80}
              height={80}
              sizes="80px"
              className="size-20 object-cover"
            />
          ) : (
            <ImageIcon aria-hidden="true" className="size-10" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          {/* Le libellé est le bouton visible « Choisir une image » ; le champ natif reste au clavier (focus montré sur la pastille). */}
          <div className="relative rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
            <label
              htmlFor={idFichier}
              className="t-button inline-flex min-h-touch cursor-pointer items-center justify-center rounded-full bg-admin-filtre px-5 py-3 uppercase text-admin-sur-filtre"
            >
              {t("ajout.fichier.libelle")}
            </label>
            <input
              ref={refFichier}
              id={idFichier}
              name="fichier"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={occupe}
              onChange={(e) => setNomChoisi(e.target.files?.[0]?.name ?? null)}
              aria-invalid={erreurFichier ? true : undefined}
              aria-describedby={`${idFichier}-aide${nomChoisi ? ` ${idFichier}-choisi` : ""}${erreurFichier ? ` ${idFichier}-erreur` : ""}`}
              className="sr-only"
            />
          </div>
          <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
            {t("ajout.fichier.aide", { max: PHOTO_TAILLE_MAX / (1024 * 1024) })}
          </p>
          {nomChoisi ? (
            <p id={`${idFichier}-choisi`} className="t-small break-all text-text-primary">
              {t("ajout.fichier.choisi", { nom: nomChoisi })}
            </p>
          ) : null}
        </div>
        {erreurFichier ? (
          <p id={`${idFichier}-erreur`} className="t-small w-full text-danger">
            {erreurFichier}
          </p>
        ) : null}
      </div>

      <ChampTexte id={`${base}-alt-fr`} name="alt_fr" libelle={t("ajout.altFr.libelle")} aide={t("ajout.altFr.aide")} valeur={altFr} onChange={setAltFr} erreur={erreurDe("alt_fr") ?? erreurDe("alt_en")} />

      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="submit" enCours={occupe}>
          {t("ajout.ajouter")}
        </Bouton>
        {phase === "envoi" ? (
          <Bouton variante="secondaire" onClick={annuler}>
            {t("ajout.annuler")}
          </Bouton>
        ) : null}
      </div>

      {/* Progression : valeur en texte (jamais la barre seule) ; résultat réel annoncé en statut. */}
      <div role="status" className="flex flex-col gap-2">
        {phase === "envoi" ? (
          <>
            <progress value={pourcentage} max={100} aria-label={t.markup("ajout.progression", { pourcentage, nb: (m) => m })} className="h-3 w-full" />
            <p className="t-small text-text-primary">{t.rich("ajout.progression", { pourcentage, nb })}</p>
            {reprise ? <p className="t-small text-text-secondary">{t("ajout.reprise")}</p> : null}
          </>
        ) : null}
        {phase === "traitement" ? <p className="t-small text-text-primary">{t("ajout.traitement")}</p> : null}
        {message ? <p className="t-small text-text-primary">{message}</p> : null}
      </div>
    </form>
  );
}
