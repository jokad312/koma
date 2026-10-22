"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { envoyerMessageContact, type EtatContact } from "@/modules/contact/actions";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
const VIDE = { nom: "", email: "", message: "" };

// Formulaire de contact. « Message envoyé » n'apparaît qu'après la réponse réelle du serveur ; la saisie reste après un échec
// (champs contrôlés : React 19 vide les champs non contrôlés après une action).
export function FormulaireContact() {
  const t = useTranslations("Contact");
  const langue = useLocale();
  const [etat, action, enCours] = useActionState<EtatContact | null, FormData>(envoyerMessageContact, null);
  const [saisie, setSaisie] = useState(VIDE);
  const [dernierEtat, setDernierEtat] = useState(etat);
  if (etat !== dernierEtat) {
    setDernierEtat(etat);
    if (etat) setSaisie(etat.statut === "succes" ? VIDE : etat.valeurs);
  }
  const id = useId();
  const champs = etat?.statut === "erreur" ? etat.champs : {};
  const erreur = etat?.statut === "erreur" ? etat.erreur : null;
  const nbErreursChamps = Object.keys(champs).length;

  function champ(nom: "nom" | "email" | "message") {
    const code = champs[nom];
    const idErreur = `${id}-${nom}-erreur`;
    const idAide = `${id}-${nom}-aide`;
    return { code, idErreur, idAide, describedby: [nom === "message" ? idAide : null, code ? idErreur : null].filter(Boolean).join(" ") || undefined };
  }
  const nom = champ("nom");
  const email = champ("email");
  const message = champ("message");

  return (
    <form action={action} noValidate className="flex flex-col items-start gap-4">
      <input type="hidden" name="langue" value={langue} />
      {nbErreursChamps > 0 ? (
        <p role="alert" className="t-small text-danger">
          {t("erreurs.resume")}
        </p>
      ) : null}

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${id}-nom`} className="t-label text-text-primary">
          {t("nom.libelle")}
        </label>
        <input
          id={`${id}-nom`}
          name="nom"
          type="text"
          autoComplete="name"
          maxLength={80}
          aria-required="true"
          aria-invalid={nom.code ? true : undefined}
          aria-describedby={nom.describedby}
          value={saisie.nom}
          onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
          className={CHAMP}
        />
        {nom.code ? (
          <p id={nom.idErreur} className="t-small text-danger">
            {t(`erreurs.${nom.code}`)}
          </p>
        ) : null}
      </div>

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
          aria-invalid={email.code ? true : undefined}
          aria-describedby={email.describedby}
          value={saisie.email}
          onChange={(e) => setSaisie({ ...saisie, email: e.target.value })}
          className={CHAMP}
        />
        {email.code ? (
          <p id={email.idErreur} className="t-small text-danger">
            {t(`erreurs.${email.code}`)}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${id}-message`} className="t-label text-text-primary">
          {t("message.libelle")}
        </label>
        <p id={message.idAide} className="t-small text-text-secondary">
          {t("message.aide")}
        </p>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={6}
          maxLength={2000}
          aria-required="true"
          aria-invalid={message.code ? true : undefined}
          aria-describedby={message.describedby}
          value={saisie.message}
          onChange={(e) => setSaisie({ ...saisie, message: e.target.value })}
          className={CHAMP}
        />
        {message.code ? (
          <p id={message.idErreur} className="t-small text-danger">
            {t(`erreurs.${message.code}`)}
          </p>
        ) : null}
      </div>

      <Bouton type="submit" enCours={enCours}>
        {enCours ? t("enCours") : t("envoyer")}
      </Bouton>

      {erreur === "trop_d_essais" ? <MessageEtat type="erreur">{t("erreurs.trop_d_essais")}</MessageEtat> : null}
      {erreur === "generique" ? <MessageEtat type="erreur">{t("erreurs.generique")}</MessageEtat> : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}
    </form>
  );
}
