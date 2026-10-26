"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { deplacerPhoto, modifierAltPhoto, supprimerPhoto } from "@/modules/catalogue/actions";
import { PHOTOS_MAX } from "@/modules/catalogue/types";
import type { PhotoAdmin } from "@/modules/catalogue/types";
import { ChampTexte } from "./ChampTexte";

const BOUTON =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface px-3 text-text-primary aria-disabled:cursor-not-allowed aria-disabled:text-text-secondary";

function Fleche({ haut }: { haut: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d={haut ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} />
    </svg>
  );
}

// Correction des textes alternatifs d'une photo : libellés visibles, erreur sous le champ, saisie conservée après un échec,
// succès annoncé (dans la zone de statut de la galerie) seulement après la réponse réelle de la base.
function FormulaireAlt({ photo, numero, onSucces }: { photo: PhotoAdmin; numero: number; onSucces: (message: string) => void }) {
  const t = useTranslations("Admin.produits.photos");
  const router = useRouter();
  const base = useId();
  const [altFr, setAltFr] = useState(photo.altFr);
  const [altEn, setAltEn] = useState(photo.altEn);
  const [erreur, setErreur] = useState<{ code: string; champ: "fr" | "en" | "tous" | null } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const enVol = useRef(false);

  const code = (c: string) => (c in t.raw("erreurs") ? c : "generique");
  const erreurDe = (champ: "fr" | "en") => (erreur && (erreur.champ === champ || erreur.champ === "tous") ? t(`erreurs.${code(erreur.code)}`) : null);
  const erreurGenerale = erreur && erreur.champ === null ? t(`erreurs.${code(erreur.code)}`) : null;

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    if (altFr.trim() === "" || altFr.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "fr" });
    if (altEn.trim() === "" || altEn.trim().length > 200) return setErreur({ code: "alt_invalide", champ: "en" });
    enVol.current = true;
    setEnCours(true);
    try {
      const etat = await modifierAltPhoto({ photoId: photo.id, altFr, altEn });
      if (etat.statut === "erreur") {
        // Refus alt_invalide du serveur alors que le client a validé : le champ fautif est inconnu, le message va sous les deux.
        setErreur({ code: etat.erreur, champ: etat.erreur === "alt_invalide" ? "tous" : null });
        return;
      }
      onSucces(t("alt.succes", { numero }));
      router.refresh();
    } catch {
      setErreur({ code: "generique", champ: null });
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={surEnvoi} noValidate aria-labelledby={`${base}-titre`} className="flex basis-full flex-col gap-3 border-t border-border pt-3">
      <h4 id={`${base}-titre`} className="t-label">
        {t("alt.titre", { numero })}
      </h4>
      {erreurGenerale ? <MessageEtat type="erreur">{erreurGenerale}</MessageEtat> : null}
      <ChampTexte id={`${base}-fr`} name="alt_fr" libelle={t("alt.altFr")} aide={t("alt.aide")} valeur={altFr} onChange={setAltFr} erreur={erreurDe("fr")} />
      <ChampTexte id={`${base}-en`} name="alt_en" libelle={t("alt.altEn")} valeur={altEn} onChange={setAltEn} erreur={erreurDe("en")} />
      <div>
        <Bouton type="submit" variante="secondaire" enCours={enCours}>
          {enCours ? t("alt.enCours") : t("alt.enregistrer")}
        </Bouton>
      </div>
    </form>
  );
}

// Liste ordonnée des photos : miniature, textes alternatifs, Monter / Descendre (44 px, nom complet, aria-disabled en bout de liste).
// L'ordre affiché vient de la base (router.refresh) ; le résultat réel est annoncé en statut.
export function GaleriePhotos({ photos }: { photos: readonly PhotoAdmin[] }) {
  const t = useTranslations("Admin.produits.photos");
  const locale = useLocale();
  const router = useRouter();
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const enVol = useRef(false);
  const [aSupprimer, setASupprimer] = useState<PhotoAdmin | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  // Rang (0 = première) de l'élément qui reçoit le focus quand la liste relue arrive ; -1 : plus aucune photo.
  const focusApres = useRef<number | null>(null);
  const reperes = useRef<Array<HTMLElement | null>>([]);
  const repereVide = useRef<HTMLParagraphElement>(null);

  // Après une suppression, la liste relue arrive : le focus va sur la photo voisine, ou sur le message « aucune photo » (juste au-dessus
  // du formulaire d'ajout) s'il n'en reste plus. Le bouton qui avait le focus a disparu avec sa photo.
  useEffect(() => {
    const rang = focusApres.current;
    if (rang === null) return;
    focusApres.current = null;
    if (photos.length === 0) repereVide.current?.focus();
    else reperes.current[Math.min(rang, photos.length - 1)]?.focus();
  }, [photos]);

  const messageErreur = (code: string) => t(`erreurs.${code in (t.raw("erreurs") as object) ? code : "generique"}`);

  async function confirmerSuppression() {
    const photo = aSupprimer;
    if (!photo || enVol.current) return;
    enVol.current = true;
    setSuppressionEnCours(true);
    setAnnonce(null);
    setErreur(null);
    try {
      const etat = await supprimerPhoto({ photoId: photo.id });
      if (etat.statut === "succes") {
        const rang = photos.findIndex((p) => p.id === photo.id);
        focusApres.current = photos.length <= 1 ? -1 : Math.max(rang, 0);
        setAnnonce(t("supprimee", { numero: rang + 1 }));
        router.refresh();
      } else {
        setErreur(messageErreur(etat.erreur));
      }
    } catch {
      setErreur(t("erreurs.generique"));
    } finally {
      enVol.current = false;
      setSuppressionEnCours(false);
      setASupprimer(null);
    }
  }

  function deplacer(photo: PhotoAdmin, sens: "haut" | "bas") {
    if (enVol.current) return;
    enVol.current = true;
    setAnnonce(null);
    setErreur(null);
    demarrer(async () => {
      try {
        const etat = await deplacerPhoto({ photoId: photo.id, sens });
        if (etat.statut === "succes") {
          setAnnonce(t("deplacee", { numero: photo.position + (sens === "haut" ? -1 : 1) }));
          router.refresh();
        } else {
          setErreur(messageErreur(etat.erreur === "photo_introuvable" || etat.erreur === "non_autorise" ? etat.erreur : "generique"));
        }
      } catch {
        setErreur(t("erreurs.generique"));
      } finally {
        enVol.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="t-small text-text-secondary">{t("nombre", { nombre: photos.length })}</p>
      {photos.length === 0 ? (
        <p ref={repereVide} tabIndex={-1} className="t-body text-text-secondary">
          {t("vide")}
        </p>
      ) : null}
      {photos.length > 0 ? (
        <ol aria-label={t("legende")} className="flex flex-col gap-3">
          {photos.map((p, i) => {
            const texte = locale === "en" ? p.altEn : p.altFr;
            const premiere = i === 0;
            const derniere = i === photos.length - 1;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-3">
                <Image src={urlPhotoPublique(p.fichier)} alt={texte} width={96} height={96} sizes="96px" className="size-24 shrink-0 rounded-md object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p
                    ref={(el) => {
                      reperes.current[i] = el;
                    }}
                    tabIndex={-1}
                    className="t-label"
                  >
                    {t("position", { numero: i + 1 })}
                  </p>
                  <p className="t-small break-words text-text-secondary">{t("texteFr", { texte: p.altFr })}</p>
                  <p className="t-small break-words text-text-secondary">{t("texteEn", { texte: p.altEn })}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={BOUTON}
                    aria-disabled={premiere || undefined}
                    aria-label={t("monter", { numero: i + 1, texte })}
                    onClick={premiere ? undefined : () => deplacer(p, "haut")}
                  >
                    <Fleche haut />
                  </button>
                  <button
                    type="button"
                    className={BOUTON}
                    aria-disabled={derniere || undefined}
                    aria-label={t("descendre", { numero: i + 1, texte })}
                    onClick={derniere ? undefined : () => deplacer(p, "bas")}
                  >
                    <Fleche haut={false} />
                  </button>
                  <button type="button" className={`${BOUTON} text-danger`} onClick={() => setASupprimer(p)}>
                    {t("supprimer", { numero: i + 1 })}
                  </button>
                </div>
                <FormulaireAlt key={`${p.id}-${p.altFr}-${p.altEn}`} photo={p} numero={i + 1} onSucces={(m) => { setErreur(null); setAnnonce(m); }} />
              </li>
            );
          })}
        </ol>
      ) : null}
      <div role="status" className="t-small text-text-primary">
        {annonce}
      </div>
      {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
      {photos.length >= PHOTOS_MAX ? <p className="t-small text-text-secondary">{t("erreurs.photos_limite")}</p> : null}
      <Dialogue
        ouvert={aSupprimer !== null}
        onFermer={() => {
          if (!enVol.current) setASupprimer(null);
        }}
        titre={aSupprimer ? t("suppression.titre", { numero: photos.findIndex((p) => p.id === aSupprimer.id) + 1 }) : ""}
      >
        <p className="t-body">{t("suppression.texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={suppressionEnCours} onClick={() => setASupprimer(null)}>
            {t("suppression.annuler")}
          </button>
          <Bouton enCours={suppressionEnCours} onClick={confirmerSuppression}>
            {suppressionEnCours ? t("suppression.enCours") : t("suppression.confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </div>
  );
}
