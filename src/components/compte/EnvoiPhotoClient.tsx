"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { annulerEnvoiPhotoAction, demanderEnvoiPhotoAction, finaliserPhotoAction } from "@/modules/communaute/actions";
import { FORMATS_PHOTO_CLIENT, PHOTO_CLIENT_TAILLE_MAX, type KitPaye } from "@/modules/communaute/types";
import { mesurer } from "@/modules/mesure/client";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
type Phase = "repos" | "envoi" | "traitement";
type Champ = "fichier" | "kit" | "nom" | "ville" | "accord" | null;

const CHAMP_DE: Record<string, Champ> = {
  fichier_manquant: "fichier",
  format_invalide: "fichier",
  fichier_trop_lourd: "fichier",
  accord_manquant: "accord",
  kit_manquant: "kit",
  kit_non_paye: "kit",
};

// « Mon compte › Envoyer une photo » (story 8.1, UX-DR30) : contrôles avant tout envoi, autorisation signée par le serveur, envoi TUS
// direct (progression en texte, reprise après coupure, « Annuler l'envoi »), puis vérification et nettoyage par le serveur. Le succès
// n'est affiché qu'après la réponse réelle de la finalisation (règle 13).
// Formats limités à JPEG, PNG et WebP : Safari sur iPhone convertit alors une photo HEIC en JPEG au moment du choix.
// kits (story 8.4) : formulaire « Envoyer une Réalisation » ; le Kit utilisé, parmi ceux qui ont été payés, est alors obligatoire.
export function EnvoiPhotoClient({ kits }: { kits?: KitPaye[] } = {}) {
  const t = useTranslations("Communaute");
  const langue = useLocale();
  const [kitId, setKitId] = useState("");
  const router = useRouter();
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [afficherNom, setAfficherNom] = useState(false);
  const [nom, setNom] = useState("");
  const [afficherVille, setAfficherVille] = useState(false);
  const [ville, setVille] = useState("");
  const [accord, setAccord] = useState(false);
  const [phase, setPhase] = useState<Phase>("repos");
  const [pourcentage, setPourcentage] = useState(0);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; champ: Champ } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const envoi = useRef<EnvoiTus | null>(null);
  const objetEnCours = useRef<string | null>(null);
  const annule = useRef(false);
  const enVol = useRef(false);

  const texteErreur = (code: string) => (code in t.raw("erreurs") ? t(`erreurs.${code}`) : t("erreurs.generique"));
  const echec = (code: string) => setErreur({ code, champ: CHAMP_DE[code] ?? null });

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);
    const fichier = refFichier.current?.files?.[0];
    if (!fichier) return echec("fichier_manquant");
    if (!Object.hasOwn(FORMATS_PHOTO_CLIENT, fichier.type)) return echec("format_invalide");
    if (fichier.size > PHOTO_CLIENT_TAILLE_MAX) return echec("fichier_trop_lourd");
    if ((afficherNom && (nom.trim() === "" || [...nom.trim()].length > 40)) || (afficherVille && (ville.trim() === "" || [...ville.trim()].length > 60))) {
      return setErreur({ code: "affichage_invalide", champ: afficherNom && (nom.trim() === "" || [...nom.trim()].length > 40) ? "nom" : "ville" });
    }
    if (kits && kitId === "") return echec("kit_manquant");
    if (!accord) return echec("accord_manquant");

    enVol.current = true;
    annule.current = false;
    setPourcentage(0);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiPhotoAction({ type: fichier.type, taille: fichier.size, ...(kits ? { kitId } : {}) });
      if (!autorisation.ok) return echec(autorisation.erreur);
      objetEnCours.current = autorisation.objet;
      if (annule.current) {
        await annulerEnvoiPhotoAction({ objet: autorisation.objet });
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
        await annulerEnvoiPhotoAction({ objet: autorisation.objet });
        return;
      }
      try {
        await tus.terminer;
      } catch {
        if (!annule.current) echec("envoi_echec");
        return;
      }
      if (annule.current) return;

      setPhase("traitement");
      const fini = await finaliserPhotoAction({ objet: autorisation.objet, accord, afficherNom, nom, afficherVille, ville, ...(kits ? { kitId } : {}) });
      if (!fini.ok) return echec(fini.erreur);
      // Envoi réellement accepté par le serveur (règle 13) ; la page est enregistrée « /compte », jamais le sous-chemin.
      mesurer(kits ? "realisation_envoyee" : "photo_envoyee");
      setMessage(t("succes"));
      setAccord(false);
      setKitId("");
      if (refFichier.current) refFichier.current.value = "";
      router.refresh();
    } catch {
      echec("generique");
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
        await annulerEnvoiPhotoAction({ objet });
      } catch {
        // L'envoi est arrêté ; l'objet abandonné est de toute façon purgé après 24 h.
      }
    }
    setMessage(t("annule"));
  }

  const occupe = phase !== "repos";
  const ids = { kit: `${base}-kit`, fichier: `${base}-fichier`, nom: `${base}-nom`, ville: `${base}-ville`, accord: `${base}-accord` };
  const erreurDe = (champ: Champ) => (erreur && erreur.champ === champ ? texteErreur(erreur.code) : null);
  const decrit = (id: string, aide: string | null, champ: Champ) => [aide, erreurDe(champ) ? `${id}-erreur` : null].filter(Boolean).join(" ") || undefined;
  const erreurChamp = (id: string, champ: Champ) =>
    erreurDe(champ) ? (
      <p id={`${id}-erreur`} className="t-small text-danger">
        {erreurDe(champ)}
      </p>
    ) : null;

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-2xl flex-col gap-4">
      {erreur && erreur.champ === null ? <MessageEtat type="erreur">{texteErreur(erreur.code)}</MessageEtat> : null}

      {kits ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.kit} className="t-label text-text-primary">
            {t("realisation.kit")}
          </label>
          <select
            id={ids.kit}
            value={kitId}
            onChange={(e) => setKitId(e.target.value)}
            disabled={occupe}
            aria-invalid={erreurDe("kit") ? true : undefined}
            aria-describedby={decrit(ids.kit, null, "kit")}
            className={CHAMP}
          >
            <option value="">{t("realisation.choisir")}</option>
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {langue === "en" && k.titreEn ? k.titreEn : k.titreFr}
              </option>
            ))}
          </select>
          {erreurChamp(ids.kit, "kit")}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.fichier} className="t-label text-text-primary">
          {t("fichier.libelle")}
        </label>
        <p id={`${ids.fichier}-aide`} className="t-small text-text-secondary">
          {t("fichier.aide")}
        </p>
        <input
          ref={refFichier}
          id={ids.fichier}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={occupe}
          aria-invalid={erreurDe("fichier") ? true : undefined}
          aria-describedby={decrit(ids.fichier, `${ids.fichier}-aide`, "fichier")}
          className={CHAMP}
        />
        {erreurChamp(ids.fichier, "fichier")}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="t-label mb-1 text-text-primary">{t("affichage.titre")}</legend>
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input type="checkbox" checked={afficherNom} onChange={(e) => setAfficherNom(e.target.checked)} disabled={occupe} className="size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("affichage.afficherNom")}</span>
        </label>
        {afficherNom ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.nom} className="t-small font-semibold text-text-primary">
              {t("affichage.nom")}
            </label>
            <input
              id={ids.nom}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
              disabled={occupe}
              aria-invalid={erreurDe("nom") ? true : undefined}
              aria-describedby={decrit(ids.nom, null, "nom")}
              className={CHAMP}
            />
            {erreurChamp(ids.nom, "nom")}
          </div>
        ) : null}
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input type="checkbox" checked={afficherVille} onChange={(e) => setAfficherVille(e.target.checked)} disabled={occupe} className="size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("affichage.afficherVille")}</span>
        </label>
        {afficherVille ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.ville} className="t-small font-semibold text-text-primary">
              {t("affichage.ville")}
            </label>
            <input
              id={ids.ville}
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              maxLength={60}
              autoComplete="address-level2"
              disabled={occupe}
              aria-invalid={erreurDe("ville") ? true : undefined}
              aria-describedby={decrit(ids.ville, null, "ville")}
              className={CHAMP}
            />
            {erreurChamp(ids.ville, "ville")}
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            id={ids.accord}
            type="checkbox"
            checked={accord}
            onChange={(e) => setAccord(e.target.checked)}
            disabled={occupe}
            aria-invalid={erreurDe("accord") ? true : undefined}
            aria-describedby={decrit(ids.accord, null, "accord")}
            className="mt-0.5 size-6 shrink-0"
          />
          <span className="t-body text-text-primary">{t("accord")}</span>
        </label>
        {erreurChamp(ids.accord, "accord")}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="submit" enCours={occupe}>
          {t("envoyer")}
        </Bouton>
        {phase === "envoi" ? (
          <Bouton variante="secondaire" onClick={annuler}>
            {t("annuler")}
          </Bouton>
        ) : null}
      </div>

      {/* Progression écrite en texte (jamais la barre seule) ; résultat réel annoncé. */}
      <div role="status" className="flex flex-col gap-2">
        {phase === "envoi" ? (
          <>
            <progress value={pourcentage} max={100} aria-label={t("progression", { pourcentage })} className="h-3 w-full" />
            <p className="t-small text-text-primary">{t("progression", { pourcentage })}</p>
            {reprise ? <p className="t-small text-text-secondary">{t("reprise")}</p> : null}
          </>
        ) : null}
        {phase === "traitement" ? <p className="t-small text-text-primary">{t("traitement")}</p> : null}
        {message ? <p className="t-small text-text-primary">{message}</p> : null}
      </div>
    </form>
  );
}
