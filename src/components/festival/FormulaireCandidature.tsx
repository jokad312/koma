"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { lireEnvPublique } from "@/lib/env";
import { BUCKET_CANDIDATURES_STAND } from "@/lib/supabase/stockage";
import { demarrerEnvoiTus, type EnvoiTus } from "@/lib/supabase/envoi-tus";
import { annulerEnvoiCandidatureAction, demanderEnvoiCandidatureAction, finaliserCandidatureAction } from "@/modules/evenements/candidature-actions";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  descriptionValable,
  FORMATS_PHOTO_CANDIDATURE,
  instagramValable,
  NOMBRE_PHOTOS_CANDIDATURE,
  PHOTO_CANDIDATURE_TAILLE_MAX,
} from "@/modules/evenements/candidature-types";

export type TypeStand = { id: string; nom: string; prixCents: number; inclus: string | null; complet: boolean };

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
type Phase = "repos" | "envoi" | "traitement";
type Champ = "type" | "description" | "instagram" | "photos" | "engagement" | null;

const CHAMP_DE: Record<string, Champ> = {
  type_introuvable: "type",
  description_invalide: "description",
  instagram_invalide: "instagram",
  format_invalide: "photos",
  fichier_trop_lourd: "photos",
  engagement_manquant: "engagement",
};

// Candidature Stand (story 7.11, FR-33b) : description, Instagram, exactement 3 photos et case d'engagement jamais pré-cochée. Contrôles avant tout
// envoi, autorisation signée par le serveur, envoi TUS direct vers le bucket privé, puis dépôt par le serveur. La candidature est acceptée
// immédiatement par la base : la page de paiement s'ouvre seulement après sa réponse réelle (règle 13).
export function FormulaireCandidature({ evenementId, slug, types }: { evenementId: string; slug: string; types: TypeStand[] }) {
  const t = useTranslations("Festival.candidature");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const base = useId();
  const resumeRef = useRef<HTMLDivElement>(null);
  const fichiers = useRef<(HTMLInputElement | null)[]>([]);
  const ouverts = types.filter((x) => !x.complet);
  const [typeId, setTypeId] = useState(ouverts.length === 1 ? ouverts[0].id : "");
  const [description, setDescription] = useState("");
  const [instagram, setInstagram] = useState("");
  const [engagement, setEngagement] = useState(false);
  const [phase, setPhase] = useState<Phase>("repos");
  const [progression, setProgression] = useState<number[]>([0, 0, 0]);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; champ: Champ } | null>(null);
  const envois = useRef<EnvoiTus[]>([]);
  const objets = useRef<string[]>([]);
  const annule = useRef(false);
  const enVol = useRef(false);

  const texteErreur = (code: string) => (code in t.raw("erreurs") ? t(`erreurs.${code}`) : t("erreurs.generique"));
  const echec = (code: string, champ?: Champ) => {
    setErreur({ code, champ: champ ?? CHAMP_DE[code] ?? null });
    resumeRef.current?.focus();
  };

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    const choisis = fichiers.current.map((f) => f?.files?.[0] ?? null);
    if (typeId === "") return echec("type_manquant", "type");
    if (!descriptionValable(description.trim())) return echec("description_invalide");
    if (!instagramValable(instagram)) return echec("instagram_invalide");
    if (choisis.length !== NOMBRE_PHOTOS_CANDIDATURE || choisis.some((f) => !f)) return echec("photos_manquantes", "photos");
    const prets = choisis as File[];
    if (prets.some((f) => !Object.hasOwn(FORMATS_PHOTO_CANDIDATURE, f.type))) return echec("format_invalide");
    if (prets.some((f) => f.size > PHOTO_CANDIDATURE_TAILLE_MAX)) return echec("fichier_trop_lourd");
    if (!engagement) return echec("engagement_manquant");

    enVol.current = true;
    annule.current = false;
    setProgression([0, 0, 0]);
    setReprise(false);
    setPhase("envoi");
    try {
      const autorisation = await demanderEnvoiCandidatureAction({ evenementId, typePassId: typeId, fichiers: prets.map((f) => ({ type: f.type, taille: f.size })) });
      if (!autorisation.ok) return echec(autorisation.erreur);
      objets.current = autorisation.objets.map((o) => o.objet);
      if (annule.current) {
        await annulerEnvoiCandidatureAction({ objets: objets.current });
        return;
      }
      const env = lireEnvPublique();
      envois.current = [];
      const termines: Promise<void>[] = [];
      for (const [i, fichier] of prets.entries()) {
        const tus = await demarrerEnvoiTus({
          fichier,
          contentType: fichier.type,
          objet: autorisation.objets[i].objet,
          jeton: autorisation.objets[i].jeton,
          bucket: BUCKET_CANDIDATURES_STAND,
          adresseSupabase: env.NEXT_PUBLIC_SUPABASE_URL,
          clePublique: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          onProgression: (envoyes, total) => {
            setReprise(false);
            setProgression((p) => p.map((v, j) => (j === i ? (total > 0 ? Math.floor((envoyes / total) * 100) : 0) : v)));
          },
          onReprise: () => setReprise(true),
        });
        envois.current.push(tus);
        termines.push(tus.terminer);
      }
      try {
        await Promise.all(termines);
      } catch {
        if (!annule.current) {
          await Promise.all(envois.current.map((x) => x.annuler().catch(() => {})));
          await annulerEnvoiCandidatureAction({ objets: objets.current });
          echec("envoi_echec");
        }
        return;
      }
      if (annule.current) return;

      setPhase("traitement");
      const fini = await finaliserCandidatureAction({ evenementId, typePassId: typeId, objets: objets.current, description, instagram, engagement });
      if (!fini.ok) return echec(fini.erreur);
      // Candidature réellement acceptée par la base : le lien de paiement s'ouvre tout de suite.
      router.push(`/festival/${slug}/stand/${fini.candidatureId}`);
    } catch {
      echec("generique");
    } finally {
      envois.current = [];
      objets.current = [];
      enVol.current = false;
      setPhase("repos");
      setReprise(false);
    }
  }

  async function annuler() {
    annule.current = true;
    const liste = objets.current;
    await Promise.all(envois.current.map((x) => x.annuler().catch(() => {})));
    if (liste.length > 0) await annulerEnvoiCandidatureAction({ objets: liste }).catch(() => {});
  }

  const enCours = phase !== "repos";
  const moyenne = Math.floor(progression.reduce((a, b) => a + b, 0) / NOMBRE_PHOTOS_CANDIDATURE);
  const invalide = (champ: Champ) => (erreur?.champ === champ ? true : undefined);

  if (ouverts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <MessageEtat type="information">{t("complet")}</MessageEtat>
        <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
          {t("retourEvenement")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={surEnvoi} noValidate aria-busy={enCours || undefined} className="flex flex-col gap-6">
      <div ref={resumeRef} tabIndex={-1} className="outline-none">
        {erreur ? <MessageEtat type="erreur">{texteErreur(erreur.code)}</MessageEtat> : null}
      </div>

      {ouverts.length > 1 ? (
        <fieldset className="flex flex-col gap-3" aria-invalid={invalide("type")} disabled={enCours}>
          <legend className="t-label text-text-primary">{t("type")}</legend>
          {ouverts.map((x) => (
            <label key={x.id} className="flex min-h-touch cursor-pointer items-center gap-3">
              <input type="radio" name={`${base}-type`} value={x.id} checked={typeId === x.id} onChange={() => setTypeId(x.id)} className="size-6 shrink-0" />
              <span className="t-body text-text-primary">{`${x.nom} · ${formaterUsd(x.prixCents, locale)}`}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="t-body text-text-primary">{`${ouverts[0].nom} · ${formaterUsd(ouverts[0].prixCents, locale)}`}</p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${base}-desc`} className="t-label text-text-primary">
          {t("description")}
        </label>
        <p id={`${base}-desc-aide`} className="t-small text-text-secondary">
          {t("descriptionAide", { min: DESCRIPTION_MIN, max: DESCRIPTION_MAX })}
        </p>
        <textarea
          id={`${base}-desc`}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={enCours}
          maxLength={DESCRIPTION_MAX + 200}
          aria-describedby={`${base}-desc-aide`}
          aria-invalid={invalide("description")}
          className={CHAMP}
        />
        <p className="t-small text-text-secondary" aria-live="polite">
          {t("compteur", { n: [...description.trim()].length, max: DESCRIPTION_MAX })}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${base}-insta`} className="t-label text-text-primary">
          {t("instagram")}
        </label>
        <p id={`${base}-insta-aide`} className="t-small text-text-secondary">
          {t("instagramAide")}
        </p>
        <input
          id={`${base}-insta`}
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={200}
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          disabled={enCours}
          aria-describedby={`${base}-insta-aide`}
          aria-invalid={invalide("instagram")}
          className={CHAMP}
        />
      </div>

      <fieldset className="flex flex-col gap-3" aria-invalid={invalide("photos")} disabled={enCours}>
        <legend className="t-label text-text-primary">{t("photos")}</legend>
        <p className="t-small text-text-secondary">{t("photosAide")}</p>
        {Array.from({ length: NOMBRE_PHOTOS_CANDIDATURE }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label htmlFor={`${base}-photo-${i}`} className="t-small text-text-primary">
              {t("photoN", { n: i + 1 })}
            </label>
            <input
              id={`${base}-photo-${i}`}
              ref={(el) => {
                fichiers.current[i] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="t-body"
            />
          </div>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" checked={engagement} onChange={(e) => setEngagement(e.target.checked)} disabled={enCours} aria-invalid={invalide("engagement")} className="mt-1 size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("engagement")}</span>
        </label>
        <p className="t-small text-text-secondary">{t("confidentialite")}</p>
      </div>

      <div className="flex flex-col items-start gap-3">
        <Bouton type="submit" enCours={enCours}>
          {phase === "envoi" ? t("envoiEnCours", { pct: moyenne }) : phase === "traitement" ? t("traitement") : t("envoyer")}
        </Bouton>
        {phase === "envoi" ? (
          <>
            <p role="status" className="t-small text-text-secondary">
              {reprise ? t("reprise") : t("progression", { pct: moyenne })}
            </p>
            <Bouton variante="secondaire" onClick={annuler}>
              {t("annuler")}
            </Bouton>
          </>
        ) : null}
        <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
          {t("retourEvenement")}
        </Link>
      </div>
    </form>
  );
}
