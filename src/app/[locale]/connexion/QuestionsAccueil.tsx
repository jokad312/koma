"use client";

import { useLocale, useTranslations } from "next-intl";
import { forwardRef, useId, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { enregistrerQuestionsAccueil } from "@/modules/comptes/actions";
import { ORIGINES, PREFERENCES_CREATION } from "@/modules/comptes/schemas";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
// Choix sélectionné : bordure rouge 2 px et coche (jamais la couleur seule).
const OPTION =
  "relative flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border-field bg-surface px-4 py-3 has-[:checked]:border-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

type Props = {
  retour?: string;
  // Appelé avec l'adresse de retour déjà validée par le serveur, que l'on ait répondu ou passé.
  onTermine: (retour: string) => void;
};

// Questions d'accueil facultatives, affichées une seule fois. « Passer » et « Continuer » marquent les questions comme vues
// et ramènent à la page quittée ; la question « univers » viendra avec les univers (epic 2).
export const QuestionsAccueil = forwardRef<HTMLHeadingElement, Props>(function QuestionsAccueil({ retour, onTermine }, refTitre) {
  const t = useTranslations("Connexion.questions");
  const langue = useLocale() as "fr" | "en";
  const [origine, setOrigine] = useState("");
  const [preference, setPreference] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [action, setAction] = useState<"passer" | "continuer" | null>(null);
  const idOrigine = useId();
  const idAideOrigine = useId();

  function envoyer(reponses: { origine: string; preference: string }, quoi: "passer" | "continuer") {
    setErreur(null);
    setAction(quoi);
    demarrer(async () => {
      const resultat = await enregistrerQuestionsAccueil({ ...reponses, langue, retour });
      if (!resultat.ok) {
        setErreur(resultat.erreur === "non_connecte" ? t("erreurSession") : t("erreur"));
        return;
      }
      onTermine(resultat.retour);
    });
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    envoyer({ origine, preference }, "continuer");
  }

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-md flex-col items-start gap-6">
      <div className="flex flex-col gap-2">
        <h2 ref={refTitre} tabIndex={-1} className="t-h2 outline-none">
          {t("titre")}
        </h2>
        <p>{t("texte")}</p>
      </div>
      {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={idOrigine} className="t-small font-semibold">
          {t("origine.libelle")}
        </label>
        <select
          id={idOrigine}
          name="origine"
          value={origine}
          onChange={(e) => setOrigine(e.target.value)}
          aria-describedby={idAideOrigine}
          className={CHAMP}
        >
          <option value="">{t("origine.aucune")}</option>
          {ORIGINES.map((valeur) => (
            <option key={valeur} value={valeur}>
              {t(`origine.options.${valeur}`)}
            </option>
          ))}
        </select>
        <p id={idAideOrigine} className="t-small text-text-secondary">
          {t("facultatif")}
        </p>
      </div>

      <fieldset className="flex w-full flex-col gap-2">
        <legend className="t-small mb-2 font-semibold">{t("preference.libelle")}</legend>
        {PREFERENCES_CREATION.map((valeur) => (
          <label key={valeur} className={OPTION}>
            <input
              type="radio"
              name="preference"
              value={valeur}
              checked={preference === valeur}
              onChange={() => setPreference(valeur)}
              className="peer sr-only"
            />
            <svg aria-hidden="true" viewBox="0 0 16 16" className="invisible size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:visible">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            {t(`preference.options.${valeur}`)}
          </label>
        ))}
        <p className="t-small text-text-secondary">{t("facultatif")}</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="submit" enCours={enCours && action === "continuer"}>
          {enCours && action === "continuer" ? t("enCours") : t("continuer")}
        </Bouton>
        <Bouton variante="secondaire" enCours={enCours && action === "passer"} onClick={() => envoyer({ origine: "", preference: "" }, "passer")}>
          {t("passer")}
        </Bouton>
      </div>
    </form>
  );
});
