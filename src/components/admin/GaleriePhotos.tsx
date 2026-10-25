"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { deplacerPhoto } from "@/modules/catalogue/actions";
import { PHOTOS_MAX } from "@/modules/catalogue/types";
import type { PhotoAdmin } from "@/modules/catalogue/types";

const BOUTON =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface px-3 text-text-primary aria-disabled:cursor-not-allowed aria-disabled:text-text-secondary";

function Fleche({ haut }: { haut: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d={haut ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} />
    </svg>
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
          setErreur(t(`erreurs.${etat.erreur === "photo_introuvable" || etat.erreur === "non_autorise" ? etat.erreur : "generique"}`));
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
      {photos.length === 0 ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
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
                  <p className="t-label">{t("position", { numero: i + 1 })}</p>
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
                </div>
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
    </div>
  );
}
