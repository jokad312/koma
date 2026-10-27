"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { supprimerFichierKit } from "@/modules/catalogue/actions";
import { TAILLE_MAX_FICHIER_KIT, TAILLE_MAX_TRANSCRIPTION, tailleLisible } from "@/modules/catalogue/fichiers-kit";
import type { FichierKitAdmin } from "@/modules/catalogue/types";
import { EnvoiFichierKit } from "./EnvoiFichierKit";

const BOUTON =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface px-3 text-text-primary aria-disabled:cursor-not-allowed aria-disabled:text-text-secondary";

const MO = 1024 * 1024;
const PARAMS_TAILLE = { max: TAILLE_MAX_FICHIER_KIT / MO, maxTranscription: TAILLE_MAX_TRANSCRIPTION / MO };

// Section « Fichiers » d'un Kit : liste (format, taille lisible, version), envoi avec progression et annulation, « Remplacer » et
// « Supprimer » (avec confirmation). L'état affiché vient de la base (router.refresh) ; le résultat réel est annoncé en statut.
export function FichiersKit({ produitId, fichiers }: { produitId: string; fichiers: readonly FichierKitAdmin[] }) {
  const t = useTranslations("Admin.kits.fichiers");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [remplacement, setRemplacement] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<FichierKitAdmin | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const enVol = useRef(false);

  const nomDe = (f: FichierKitAdmin) => (locale === "en" ? f.nomEn : f.nomFr);
  const taille = (octets: number) => {
    const { valeur, unite } = tailleLisible(octets, locale);
    return t(`taille.${unite}`, { valeur });
  };
  const messageErreur = (code: string) => t(`erreurs.${code in (t.raw("erreurs") as object) ? code : "generique"}`, PARAMS_TAILLE);

  async function confirmerSuppression() {
    const fichier = aSupprimer;
    if (!fichier || enVol.current) return;
    enVol.current = true;
    setSuppressionEnCours(true);
    setAnnonce(null);
    setErreur(null);
    try {
      const etat = await supprimerFichierKit({ fichierId: fichier.id });
      if (etat.statut === "succes") {
        setAnnonce(t("supprime"));
        router.refresh();
      } else {
        setErreur(messageErreur(etat.erreur));
      }
    } catch {
      setErreur(messageErreur("generique"));
    } finally {
      enVol.current = false;
      setSuppressionEnCours(false);
      setASupprimer(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="t-body text-text-secondary">{t("intro", PARAMS_TAILLE)}</p>
      <p className="t-small text-text-secondary">{t("nombre", { nombre: fichiers.length })}</p>
      {fichiers.length === 0 ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
      {fichiers.length > 0 ? (
        <ol aria-label={t("legende")} className="flex flex-col gap-3">
          {fichiers.map((f) => (
            <li key={f.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="t-label break-words">{nomDe(f)}</p>
                  <p className="t-small break-words text-text-secondary">{t("nomFr", { nom: f.nomFr })}</p>
                  <p className="t-small break-words text-text-secondary">{t("nomEn", { nom: f.nomEn })}</p>
                  <p className="t-small text-text-secondary">{t("details", { format: t(`formats.${f.format}`), taille: taille(f.tailleOctets), version: f.version })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BOUTON}
                    aria-expanded={remplacement === f.id}
                    onClick={() => {
                      setAnnonce(null);
                      setRemplacement(remplacement === f.id ? null : f.id);
                    }}
                  >
                    {t("remplacer", { nom: nomDe(f) })}
                  </button>
                  <button type="button" className={`${BOUTON} text-danger`} onClick={() => setASupprimer(f)}>
                    {t("supprimer", { nom: nomDe(f) })}
                  </button>
                </div>
              </div>
              {remplacement === f.id ? (
                <div className="border-t border-border pt-3">
                  <EnvoiFichierKit
                    produitId={produitId}
                    fichier={f}
                    onSucces={(message) => {
                      setRemplacement(null);
                      setAnnonce(message);
                    }}
                    onFermer={() => setRemplacement(null)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      <div role="status" className="t-small text-text-primary">
        {annonce}
      </div>
      {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}

      <EnvoiFichierKit produitId={produitId} />

      <Dialogue
        ouvert={aSupprimer !== null}
        onFermer={() => {
          if (!enVol.current) setASupprimer(null);
        }}
        titre={aSupprimer ? t("suppression.titre", { nom: nomDe(aSupprimer) }) : ""}
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
