"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { BUCKET_KITS } from "@/lib/supabase/stockage";
import { annulerEnvoiFichierKit, demanderEnvoiFichierKit, finaliserFichierKit } from "@/modules/catalogue/actions";
import {
  EXTENSION_FORMAT,
  EXTENSIONS_ACCEPTEES,
  formatDepuisNom,
  nomDepuisFichier,
  TAILLE_MAX_FICHIER_KIT,
  TAILLE_MAX_TRANSCRIPTION,
  tailleMaxFormat,
} from "@/modules/catalogue/fichiers-kit";
import type { FormatFichierKit } from "@/modules/catalogue/fichiers-kit";
import type { FichierKitAdmin } from "@/modules/catalogue/types";
import { ChampTexte, CLASSE_CHAMP } from "./ChampTexte";
import { OPTION_RADIO } from "./ChoixFamille";

type Phase = "repos" | "envoi" | "traitement";
type ErreurEnvoi = { code: string; champ: "fichier" | "nom_fr" | "nom_en" | null };

// Erreurs rattachées au champ du fichier.
const CODES_FICHIER = ["format_invalide", "fichier_trop_lourd", "contenu_actif", "entete_illisible", "fichier_deja_enregistre", "envoi_incomplet"];

const MO = 1024 * 1024;
const PARAMS_TAILLE = { max: TAILLE_MAX_FICHIER_KIT / MO, maxTranscription: TAILLE_MAX_TRANSCRIPTION / MO };

type Props = {
  produitId: string;
  // Présent : remplacement du contenu de ce fichier (même format, version + 1). Absent : ajout d'un nouveau fichier.
  fichier?: FichierKitAdmin;
  // Appelé seulement après la réponse réelle de la finalisation, avec le message de succès.
  onSucces?: (message: string) => void;
  // Fermeture du panneau de remplacement (bouton « Annuler »).
  onFermer?: () => void;
};

// Ajout ou remplacement d'un fichier de Kit : contrôles avant tout envoi (extension, format, taille, noms), autorisation signée par le
// serveur, envoi TUS direct du navigateur vers kits-private (progression en texte, reprise après coupure, annulation), puis vérification
// du contenu réel et enregistrement côté serveur. Le succès n'est affiché qu'après la réponse réelle de la finalisation.
export function EnvoiFichierKit({ produitId, fichier, onSucces, onFermer }: Props) {
  const t = useTranslations("Admin.kits.fichiers");
  const locale = useLocale();
  const router = useRouter();
  const base = useId();
  const remplacement = fichier !== undefined;
  const refFichier = useRef<HTMLInputElement>(null);
  const [formatPdf, setFormatPdf] = useState<"pdf_a4" | "pdf_letter">("pdf_a4");
  const [choisi, setChoisi] = useState<FormatFichierKit | null>(null);
  const [nomFr, setNomFr] = useState("");
  const [nomEn, setNomEn] = useState("");
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<ErreurEnvoi | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const envoi = useRef<EnvoiTus | null>(null);
  const objetEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);
  // Vrai dès que l'envoi est terminé : la vérification côté serveur ne s'annule plus.
  const envoiTermine = useRef(false);

  const code = (c: string) => (c in (t.raw("erreurs") as object) ? c : "generique");
  const texteErreur = (c: string) => t(`erreurs.${code(c)}`, PARAMS_TAILLE);
  const erreurDe = (champ: ErreurEnvoi["champ"]) => (erreur && erreur.champ === champ ? texteErreur(erreur.code) : null);

  // Format retenu : celui du fichier remplacé, sinon d'après l'extension (PDF : A4 ou US Letter au choix).
  function formatRetenu(nomFichier: string): FormatFichierKit | null {
    if (fichier) return fichier.format;
    const propose = formatDepuisNom(nomFichier);
    return propose === "pdf_a4" ? formatPdf : propose;
  }

  function surChoix(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setErreur(null);
    if (!f) {
      setChoisi(null);
      return;
    }
    setChoisi(formatDepuisNom(f.name));
    // Les noms affichés sont proposés d'après le nom du fichier, sans écraser une saisie.
    if (!remplacement) {
      const nom = nomDepuisFichier(f.name);
      setNomFr((avant) => (avant.trim() === "" ? nom : avant));
      setNomEn((avant) => (avant.trim() === "" ? nom : avant));
    }
  }

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);

    // Contrôles avant tout envoi.
    const f = refFichier.current?.files?.[0];
    if (!f) return setErreur({ code: "fichier_manquant", champ: "fichier" });
    const format = formatRetenu(f.name);
    if (!format || f.name.toLowerCase().slice(f.name.lastIndexOf(".") + 1) !== EXTENSION_FORMAT[format]) {
      return setErreur({ code: "format_invalide", champ: "fichier" });
    }
    if (f.size < 1) return setErreur({ code: "format_invalide", champ: "fichier" });
    if (f.size > tailleMaxFormat(format)) return setErreur({ code: "fichier_trop_lourd", champ: "fichier" });
    if (!remplacement) {
      if (nomFr.trim() === "" || nomFr.trim().length > 120) return setErreur({ code: "nom_invalide", champ: "nom_fr" });
      if (nomEn.trim() === "" || nomEn.trim().length > 120) return setErreur({ code: "nom_invalide", champ: "nom_en" });
    }

    enVol.current = true;
    annule.current = false;
    envoiTermine.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiFichierKit({ produitId, nomFichier: f.name, format, taille: f.size, fichierId: fichier?.id });
      if (autorisation.statut === "erreur") {
        const c = autorisation.erreur;
        setErreur({ code: c, champ: CODES_FICHIER.includes(c) ? "fichier" : null });
        return;
      }
      objetEnCours.current = autorisation.objet;
      // Annulation cliquée pendant l'autorisation : rien n'est envoyé, l'objet signé est effacé par précaution.
      if (annule.current) {
        await annulerEnvoiFichierKit({ produitId, objet: autorisation.objet });
        return;
      }
      const env = await envoyer(f, autorisation.objet, autorisation.jeton, autorisation.contentType);
      envoi.current = env;
      // Annulation cliquée pendant le démarrage de l'envoi : on l'arrête aussitôt.
      if (annule.current) {
        env.terminer.catch(() => {});
        await env.annuler();
        await annulerEnvoiFichierKit({ produitId, objet: autorisation.objet });
        return;
      }
      try {
        await env.terminer;
      } catch {
        if (!annule.current) setErreur({ code: "envoi_echec", champ: null });
        return;
      }
      if (annule.current) return;

      envoiTermine.current = true;
      setPhase("traitement");
      const fini = await finaliserFichierKit({
        produitId,
        objet: autorisation.objet,
        format,
        taille: f.size,
        nomFr,
        nomEn,
        fichierId: fichier?.id,
      });
      if (fini.statut === "erreur") {
        const c = fini.erreur;
        setErreur({ code: c, champ: CODES_FICHIER.includes(c) ? "fichier" : c === "nom_invalide" ? "nom_fr" : null });
        return;
      }
      // Réponse réelle reçue : le formulaire est vidé et la liste relue depuis la base.
      const succes = t(remplacement ? "remplacement.succes" : "ajout.succes");
      setMessage(succes);
      setNomFr("");
      setNomEn("");
      setChoisi(null);
      if (refFichier.current) refFichier.current.value = "";
      router.refresh();
      onSucces?.(succes);
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

  function envoyer(f: File, objet: string, jeton: string, contentType: string): Promise<EnvoiTus> {
    const env = lireEnvPublique();
    return demarrerEnvoiTus({
      fichier: f,
      contentType,
      objet,
      jeton,
      bucket: BUCKET_KITS,
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
    if (envoiTermine.current) return;
    annule.current = true;
    const objet = objetEnCours.current;
    await envoi.current?.annuler();
    if (objet) {
      try {
        await annulerEnvoiFichierKit({ produitId, objet });
      } catch {
        // L'effacement est de toute façon refait si l'objet n'est jamais finalisé ; l'envoi est arrêté.
      }
    }
    setMessage(t("ajout.annule"));
  }

  const occupe = phase !== "repos";
  const idFichier = `${base}-fichier`;
  const erreurFichier = erreurDe("fichier");
  const erreurGenerale = erreur && erreur.champ === null ? texteErreur(erreur.code) : null;
  const nomFormat = (f: FormatFichierKit) => t(`formats.${f}`);
  const nomAffiche = fichier ? (locale === "en" ? fichier.nomEn : fichier.nomFr) : "";
  const accept = fichier ? `.${EXTENSION_FORMAT[fichier.format]}` : EXTENSIONS_ACCEPTEES;
  const pdfChoisi = !remplacement && choisi === "pdf_a4";

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-2xl flex-col gap-4" aria-labelledby={`${base}-titre`}>
      <h3 id={`${base}-titre`} className="t-h2">
        {remplacement ? t("remplacement.titre", { nom: nomAffiche }) : t("ajout.titre")}
      </h3>
      {erreurGenerale ? <MessageEtat type="erreur">{erreurGenerale}</MessageEtat> : null}

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={idFichier} className="t-label text-text-primary">
          {remplacement ? t("remplacement.fichier.libelle") : t("ajout.fichier.libelle")}
        </label>
        <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
          {fichier ? t("remplacement.fichier.aide", { format: nomFormat(fichier.format) }) : t("ajout.fichier.aide", PARAMS_TAILLE)}
        </p>
        <input
          ref={refFichier}
          id={idFichier}
          name="fichier"
          type="file"
          accept={accept}
          disabled={occupe}
          onChange={surChoix}
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

      {pdfChoisi ? (
        <fieldset className="flex flex-col gap-2" disabled={occupe}>
          <legend className="t-label mb-2 text-text-primary">{t("ajout.format.libelle")}</legend>
          <p className="t-small text-text-secondary">{t("ajout.format.aide")}</p>
          {(["pdf_a4", "pdf_letter"] as const).map((valeur) => (
            <label key={valeur} className={OPTION_RADIO}>
              <input type="radio" name={`${base}-format`} value={valeur} checked={formatPdf === valeur} onChange={() => setFormatPdf(valeur)} className="peer sr-only" />
              <svg aria-hidden="true" viewBox="0 0 16 16" className="invisible size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:visible">
                <path d="M3 8.5 6.5 12 13 4.5" />
              </svg>
              {nomFormat(valeur)}
            </label>
          ))}
        </fieldset>
      ) : null}
      {!remplacement && choisi && choisi !== "pdf_a4" ? <p className="t-small text-text-secondary">{t("ajout.formatDetecte", { format: nomFormat(choisi) })}</p> : null}

      {remplacement ? null : (
        <>
          <ChampTexte id={`${base}-nom-fr`} name="nom_fr" libelle={t("ajout.nomFr.libelle")} aide={t("ajout.nomFr.aide")} valeur={nomFr} onChange={setNomFr} erreur={erreurDe("nom_fr")} />
          <ChampTexte id={`${base}-nom-en`} name="nom_en" libelle={t("ajout.nomEn.libelle")} aide={t("ajout.nomEn.aide")} valeur={nomEn} onChange={setNomEn} erreur={erreurDe("nom_en")} />
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="submit" enCours={occupe}>
          {remplacement ? t("remplacement.envoyer") : t("ajout.ajouter")}
        </Bouton>
        {occupe ? (
          phase === "traitement" ? (
            <Bouton variante="secondaire" desactive raison={t("ajout.annulerIndisponible")}>
              {t("ajout.annuler")}
            </Bouton>
          ) : (
            <Bouton variante="secondaire" onClick={annuler}>
              {t("ajout.annuler")}
            </Bouton>
          )
        ) : null}
        {remplacement && phase === "repos" && onFermer ? (
          <Bouton variante="secondaire" onClick={onFermer}>
            {t("remplacement.fermer")}
          </Bouton>
        ) : null}
      </div>

      {/* Progression : valeur en texte (jamais la barre seule) ; résultat réel annoncé en statut. */}
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
    </form>
  );
}
