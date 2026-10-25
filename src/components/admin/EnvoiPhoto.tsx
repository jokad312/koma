"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { annulerEnvoiPhoto, demanderEnvoiPhoto, finaliserPhoto } from "@/modules/catalogue/actions";
import { FORMATS_PHOTO, PHOTO_TAILLE_MAX } from "@/modules/catalogue/types";
import { ChampTexte, CLASSE_CHAMP } from "./ChampTexte";

type Phase = "repos" | "envoi" | "traitement";
type ErreurEnvoi = { code: string; champ: "fichier" | "alt_fr" | "alt_en" | null };

// Ajout d'une photo : contrôles avant tout envoi (type, taille, textes alternatifs), autorisation signée par le serveur, envoi TUS direct
// du navigateur (progression en texte, reprise après coupure, annulation), puis finalisation côté serveur. Le succès n'est affiché qu'après
// la réponse réelle de la finalisation.
export function EnvoiPhoto({ produitId }: { produitId: string }) {
  const t = useTranslations("Admin.produits.photos");
  const router = useRouter();
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
    if (altEn.trim() === "" || altEn.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "alt_en" });

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
  const idFichier = `${base}-fichier`;
  const erreurFichier = erreurDe("fichier");
  const erreurGenerale = erreur && erreur.champ === null ? t(`erreurs.${code(erreur.code)}`) : null;

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-2xl flex-col gap-4">
      <h3 className="t-h2">{t("ajout.titre")}</h3>
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
