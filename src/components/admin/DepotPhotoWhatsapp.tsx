"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { lireEnvPublique } from "@/lib/env";
import { demarrerEnvoiTus } from "@/lib/supabase/envoi-tus";
import { demanderEnvoiDepotAction, deposerPhotoWhatsappAction } from "@/modules/communaute/admin-actions";
import { FORMATS_PHOTO_CLIENT, PHOTO_CLIENT_TAILLE_MAX } from "@/modules/communaute/types";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

// Dépôt d'une photo reçue par WhatsApp (story 8.2) : Compte du client par son email s'il en a un, sinon pseudo et ville acceptés ;
// « Accord reçu par WhatsApp le [date] » et « 18 ans ou plus » obligatoires ; capture de l'accord facultative (stockage privé).
// La photo rejoint la file « À valider ». Le succès n'est affiché qu'après la réponse réelle du serveur.
export function DepotPhotoWhatsapp({ aujourdhui, ilYaUnAn }: { aujourdhui: string; ilYaUnAn: string }) {
  const t = useTranslations("Admin.galerie.depot");
  const te = useTranslations("Admin.galerie.erreurs");
  const router = useRouter();
  const id = useId();
  const refPhoto = useRef<HTMLInputElement>(null);
  const refCapture = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [afficherNom, setAfficherNom] = useState(false);
  const [nom, setNom] = useState("");
  const [afficherVille, setAfficherVille] = useState(false);
  const [ville, setVille] = useState("");
  const [accordRecu, setAccordRecu] = useState(false);
  const [accordLe, setAccordLe] = useState(aujourdhui);
  const [majeur, setMajeur] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [etat, setEtat] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);
  const enVol = useRef(false);

  const erreur = (code: string) => setEtat({ type: "erreur", texte: te.has(code) ? te(code) : te("generique") });

  async function envoyer(fichier: File): Promise<string | null> {
    const a = await demanderEnvoiDepotAction({ type: fichier.type, taille: fichier.size });
    if (!a.ok) {
      erreur(a.erreur);
      return null;
    }
    const env = lireEnvPublique();
    const tus = await demarrerEnvoiTus({
      fichier,
      contentType: fichier.type,
      objet: a.objet,
      jeton: a.jeton,
      adresseSupabase: env.NEXT_PUBLIC_SUPABASE_URL,
      clePublique: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      onProgression: () => {},
      onReprise: () => {},
    });
    try {
      await tus.terminer;
      return a.objet;
    } catch {
      erreur("envoi_echec");
      return null;
    }
  }

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setEtat(null);
    const photo = refPhoto.current?.files?.[0];
    const capture = refCapture.current?.files?.[0] ?? null;
    if (!photo) return erreur("fichier_manquant");
    for (const f of [photo, capture]) {
      if (f && !Object.hasOwn(FORMATS_PHOTO_CLIENT, f.type)) return erreur("format_invalide");
      if (f && f.size > PHOTO_CLIENT_TAILLE_MAX) return erreur("fichier_trop_lourd");
    }
    if (!accordRecu || accordLe === "" || accordLe > aujourdhui || accordLe < ilYaUnAn) return erreur("accord_manquant");
    if (!majeur) return erreur("majorite");
    enVol.current = true;
    setEnCours(true);
    try {
      const objetPhoto = await envoyer(photo);
      if (!objetPhoto) return;
      const objetCapture = capture ? await envoyer(capture) : null;
      if (capture && !objetCapture) return;
      const r = await deposerPhotoWhatsappAction({ objetPhoto, objetCapture, email, afficherNom, nom, afficherVille, ville, accordLe, accordRecu, majeur });
      if (!r.ok) return erreur(r.erreur);
      setEtat({ type: "succes", texte: t("succes") });
      // Formulaire remis entièrement à zéro : rien de la personne précédente (date, choix d'affichage) n'est réutilisé.
      setEmail("");
      setAfficherNom(false);
      setNom("");
      setAfficherVille(false);
      setVille("");
      setAccordRecu(false);
      setAccordLe(aujourdhui);
      setMajeur(false);
      if (refPhoto.current) refPhoto.current.value = "";
      if (refCapture.current) refCapture.current.value = "";
      router.refresh();
    } catch {
      erreur("generique");
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="t-h2">{t("titre")}</h2>
      <p className="t-small text-text-secondary">{t("intro")}</p>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-photo`} className="t-label text-text-primary">
          {t("photo")}
        </label>
        <input ref={refPhoto} id={`${id}-photo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={enCours} className={CHAMP} aria-describedby={`${id}-formats`} />
        <p id={`${id}-formats`} className="t-small text-text-secondary">
          {t("formats")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="t-label text-text-primary">
          {t("email")}
        </label>
        <input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enCours} className={CHAMP} aria-describedby={`${id}-email-aide`} />
        <p id={`${id}-email-aide`} className="t-small text-text-secondary">
          {t("emailAide")}
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="t-label mb-1 text-text-primary">{t("affichage")}</legend>
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input type="checkbox" checked={afficherNom} onChange={(e) => setAfficherNom(e.target.checked)} disabled={enCours} className="size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("afficherNom")}</span>
        </label>
        {afficherNom ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-nom`} className="t-small font-semibold text-text-primary">
              {t("nom")}
            </label>
            <input id={`${id}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} disabled={enCours} className={CHAMP} />
          </div>
        ) : null}
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input type="checkbox" checked={afficherVille} onChange={(e) => setAfficherVille(e.target.checked)} disabled={enCours} className="size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("afficherVille")}</span>
        </label>
        {afficherVille ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-ville`} className="t-small font-semibold text-text-primary">
              {t("ville")}
            </label>
            <input id={`${id}-ville`} value={ville} onChange={(e) => setVille(e.target.value)} maxLength={60} disabled={enCours} className={CHAMP} />
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input type="checkbox" checked={accordRecu} onChange={(e) => setAccordRecu(e.target.checked)} disabled={enCours} className="size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("accordRecu")}</span>
        </label>
        <label htmlFor={`${id}-date`} className="sr-only">
          {t("accordDate")}
        </label>
        <input id={`${id}-date`} type="date" value={accordLe} min={ilYaUnAn} max={aujourdhui} onChange={(e) => setAccordLe(e.target.value)} disabled={enCours} className="t-body min-h-touch rounded-md border border-border-field bg-surface px-3" />
      </div>

      <label className="flex min-h-touch cursor-pointer items-center gap-3">
        <input type="checkbox" checked={majeur} onChange={(e) => setMajeur(e.target.checked)} disabled={enCours} className="size-6 shrink-0" />
        <span className="t-body text-text-primary">{t("majeur")}</span>
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-capture`} className="t-label text-text-primary">
          {t("capture")}
        </label>
        <input ref={refCapture} id={`${id}-capture`} type="file" accept="image/jpeg,image/png,image/webp" disabled={enCours} className={CHAMP} aria-describedby={`${id}-capture-aide`} />
        <p id={`${id}-capture-aide`} className="t-small text-text-secondary">
          {t("captureAide")}
        </p>
      </div>

      <div>
        <Bouton type="submit" enCours={enCours}>
          {t("deposer")}
        </Bouton>
      </div>
      <div role="status">{etat ? <MessageEtat type={etat.type}>{etat.texte}</MessageEtat> : null}</div>
    </form>
  );
}
