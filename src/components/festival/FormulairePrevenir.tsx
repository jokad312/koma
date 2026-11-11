"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { inscrireAlerteAction, type EtatAlerte } from "@/modules/alertes/actions";
import type { CanalAlerte } from "@/modules/alertes/types";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
const VIDE = { canal: "", email: "", whatsapp: "", consentement: false };

type Props = {
  evenementId: string;
  // Le choix « Avec mon compte » n'est proposé qu'à un visiteur connecté (Compte complet).
  connecte: boolean;
};

// Formulaire « Me prévenir » (story 7.3, FR-32). Un choix de canal, puis seul le champ correspondant s'affiche. La case de consentement
// est obligatoire et jamais pré-cochée. La confirmation n'apparaît qu'après la réponse réelle du serveur (règle 13) ; la saisie reste après
// un échec (champs contrôlés : React 19 vide les champs non contrôlés après une action).
export function FormulairePrevenir({ evenementId, connecte }: Props) {
  const t = useTranslations("Festival.prevenir");
  const langue = useLocale();
  const [etat, action, enCours] = useActionState<EtatAlerte | null, FormData>(inscrireAlerteAction, null);
  const [saisie, setSaisie] = useState(VIDE);
  const [dernierEtat, setDernierEtat] = useState(etat);
  if (etat !== dernierEtat) {
    setDernierEtat(etat);
    if (etat?.statut === "erreur") setSaisie(etat.valeurs);
  }
  const id = useId();
  // Focus : au succès sur la confirmation, après une erreur sur le résumé des erreurs (ou le message d'erreur).
  const confirmation = useRef<HTMLDivElement>(null);
  const resume = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (etat?.statut === "succes") confirmation.current?.focus();
    else if (etat?.statut === "erreur") resume.current?.focus();
  }, [etat]);

  if (etat?.statut === "succes") {
    return (
      <div ref={confirmation} tabIndex={-1} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <MessageEtat type="succes">{t("succes")}</MessageEtat>
      </div>
    );
  }

  const champs = etat?.statut === "erreur" ? etat.champs : {};
  const erreur = etat?.statut === "erreur" ? etat.erreur : null;
  const canal = saisie.canal as CanalAlerte | "";
  const canaux: CanalAlerte[] = connecte ? ["email", "compte", "whatsapp"] : ["email", "whatsapp"];
  const consentementCle = canal === "whatsapp" ? "whatsapp" : "email";
  const idErreur = (nom: string) => `${id}-${nom}-erreur`;

  return (
    <form action={action} noValidate className="flex flex-col items-start gap-4">
      <input type="hidden" name="evenementId" value={evenementId} />
      <input type="hidden" name="langue" value={langue} />
      {Object.keys(champs).length > 0 ? (
        <div ref={resume} tabIndex={-1} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <p role="alert" className="t-small text-danger">
            {t("erreurs.resume")}
          </p>
        </div>
      ) : null}

      <fieldset role="radiogroup" aria-required="true" aria-describedby={champs.canal ? idErreur("canal") : undefined} className="flex w-full flex-col gap-1">
        <legend className="t-label mb-1 text-text-primary">{t("legende")}</legend>
        {canaux.map((c) => (
          <label key={c} className="t-body flex min-h-touch cursor-pointer items-center gap-3 text-text-primary">
            <input
              type="radio"
              name="canal"
              value={c}
              checked={canal === c}
              onChange={() => setSaisie({ ...saisie, canal: c })}
              className="size-5 shrink-0 accent-primary"
            />
            {t(`canaux.${c}`)}
          </label>
        ))}
        {champs.canal ? (
          <p id={idErreur("canal")} className="t-small text-danger">
            {t(`erreurs.${champs.canal}`)}
          </p>
        ) : null}
      </fieldset>

      {canal === "email" ? (
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={`${id}-email`} className="t-label text-text-primary">
            {t("email.libelle")}
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            aria-required="true"
            aria-invalid={champs.email ? true : undefined}
            aria-describedby={champs.email ? idErreur("email") : undefined}
            value={saisie.email}
            onChange={(e) => setSaisie({ ...saisie, email: e.target.value })}
            className={CHAMP}
          />
          {champs.email ? (
            <p id={idErreur("email")} className="t-small text-danger">
              {t(`erreurs.${champs.email}`)}
            </p>
          ) : null}
        </div>
      ) : null}

      {canal === "whatsapp" ? (
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={`${id}-whatsapp`} className="t-label text-text-primary">
            {t("whatsapp.libelle")}
          </label>
          <p id={`${id}-whatsapp-aide`} className="t-small text-text-secondary">
            {t("whatsapp.aide")}
          </p>
          <input
            id={`${id}-whatsapp`}
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            aria-required="true"
            aria-invalid={champs.whatsapp ? true : undefined}
            aria-describedby={[`${id}-whatsapp-aide`, champs.whatsapp ? idErreur("whatsapp") : null].filter(Boolean).join(" ")}
            value={saisie.whatsapp}
            onChange={(e) => setSaisie({ ...saisie, whatsapp: e.target.value })}
            className={CHAMP}
          />
          {champs.whatsapp ? (
            <p id={idErreur("whatsapp")} className="t-small text-danger">
              {t(`erreurs.${champs.whatsapp}`)}
            </p>
          ) : null}
        </div>
      ) : null}

      {canal === "compte" ? <p className="t-small text-text-secondary">{t("compte.aide")}</p> : null}

      <div className="flex w-full flex-col gap-1">
        <label className="t-body flex min-h-touch cursor-pointer items-start gap-3 text-text-primary">
          <input
            type="checkbox"
            name="consentement"
            checked={saisie.consentement}
            onChange={(e) => setSaisie({ ...saisie, consentement: e.target.checked })}
            aria-required="true"
            aria-invalid={champs.consentement ? true : undefined}
            aria-describedby={[canal === "whatsapp" ? `${id}-consentement-aide` : null, champs.consentement ? idErreur("consentement") : null].filter(Boolean).join(" ") || undefined}
            className="mt-1 size-5 shrink-0 accent-primary"
          />
          <span>{t(`consentement.${consentementCle}`)}</span>
        </label>
        {canal === "whatsapp" ? (
          <p id={`${id}-consentement-aide`} className="t-small text-text-secondary">
            {t("consentement.whatsappAide")}
          </p>
        ) : null}
        {champs.consentement ? (
          <p id={idErreur("consentement")} className="t-small text-danger">
            {t(`erreurs.${champs.consentement}`)}
          </p>
        ) : null}
      </div>

      <Bouton type="submit" enCours={enCours}>
        {enCours ? t("enCours") : t("bouton")}
      </Bouton>

      {erreur && erreur !== "champs" ? (
        <div ref={resume} tabIndex={-1} className="flex flex-col items-start gap-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <MessageEtat type="erreur">{t(`erreurs.${erreur}`)}</MessageEtat>
          {erreur === "non_connecte" || erreur === "compte_incomplet" ? (
            <Link href="/connexion" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
              {t("erreurs.lienConnexion")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
