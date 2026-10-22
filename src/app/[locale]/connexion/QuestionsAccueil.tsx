"use client";

import { useLocale, useTranslations } from "next-intl";
import { forwardRef, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { enregistrerQuestionsAccueil } from "@/modules/comptes/actions";
import type { UniversChoix } from "@/modules/catalogue/types";
import { ORIGINES, PREFERENCES_CREATION } from "@/modules/comptes/schemas";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
// Choix sélectionné : bordure rouge 2 px et coche (jamais la couleur seule).
const OPTION =
  "relative flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border-field bg-surface px-4 py-3 has-[:checked]:border-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

type Props = {
  retour?: string;
  // Univers à proposer (noms dans la langue de la route, lus par la page) ; vide : pas de question « univers ».
  univers?: readonly UniversChoix[];
  // Appelé avec l'adresse de retour déjà validée par le serveur, que l'on ait répondu ou passé.
  onTermine: (retour: string) => void;
  // Session perdue ou âge introuvable : retour à l'étape de l'email pour se reconnecter.
  onReprendre: () => void;
};

// Questions d'accueil facultatives, affichées une seule fois. « Passer » et « Continuer » marquent les questions comme vues
// et ramènent à la page quittée. La question « univers » n'apparaît que s'il existe au moins un univers.
export const QuestionsAccueil = forwardRef<HTMLHeadingElement, Props>(function QuestionsAccueil({ retour, univers = [], onTermine, onReprendre }, refTitre) {
  const t = useTranslations("Connexion.questions");
  const langue = useLocale() as "fr" | "en";
  const [origine, setOrigine] = useState("");
  const [preference, setPreference] = useState("");
  const [universChoisi, setUniversChoisi] = useState("");
  const [erreur, setErreur] = useState<"session" | "echec" | null>(null);
  // Un seul envoi à la fois (Entrée, double clic, « Passer » pendant « Continuer ») : l'état React arrive trop tard pour un double clic.
  const enVol = useRef(false);
  const [enCours, demarrer] = useTransition();
  const [action, setAction] = useState<"passer" | "continuer" | null>(null);
  const idOrigine = useId();
  const idAideOrigine = useId();
  const idAidePreference = useId();
  const idUnivers = useId();
  const idAideUnivers = useId();

  function envoyer(reponses: { origine: string; preference: string; univers: string }, quoi: "passer" | "continuer") {
    if (enVol.current) return;
    enVol.current = true;
    setErreur(null);
    setAction(quoi);
    demarrer(async () => {
      try {
        const resultat = await enregistrerQuestionsAccueil({ ...reponses, langue, retour });
        if (!resultat.ok) {
          setErreur(resultat.erreur === "non_connecte" ? "session" : "echec");
          return;
        }
        onTermine(resultat.retour);
      } catch {
        // Réseau coupé : l'appel est rejeté, le visiteur peut réessayer ou passer.
        setErreur("echec");
      } finally {
        enVol.current = false;
      }
    });
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    envoyer({ origine, preference, univers: universChoisi }, "continuer");
  }

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-md flex-col items-start gap-6">
      <div className="flex flex-col gap-2">
        <h2 ref={refTitre} tabIndex={-1} className="t-h2 outline-none">
          {t("titre")}
        </h2>
        <p>{t("texte")}</p>
      </div>
      {erreur ? <MessageEtat type="erreur">{erreur === "session" ? t("erreurSession") : t("erreur")}</MessageEtat> : null}
      {erreur === "session" ? (
        <Bouton variante="secondaire" onClick={onReprendre}>
          {t("reprendre")}
        </Bouton>
      ) : null}

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

      <fieldset className="flex w-full flex-col gap-2" aria-describedby={idAidePreference}>
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
        <p id={idAidePreference} className="t-small text-text-secondary">
          {t("facultatif")}
        </p>
      </fieldset>

      {univers.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={idUnivers} className="t-small font-semibold">
            {t("univers.libelle")}
          </label>
          <select
            id={idUnivers}
            name="univers"
            value={universChoisi}
            onChange={(e) => setUniversChoisi(e.target.value)}
            aria-describedby={idAideUnivers}
            className={CHAMP}
          >
            <option value="">{t("univers.aucune")}</option>
            {univers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nom}
              </option>
            ))}
          </select>
          <p id={idAideUnivers} className="t-small text-text-secondary">
            {t("facultatif")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="submit" enCours={enCours && action === "continuer"}>
          {enCours && action === "continuer" ? t("enCours") : t("continuer")}
        </Bouton>
        <Bouton variante="secondaire" enCours={enCours && action === "passer"} onClick={() => envoyer({ origine: "", preference: "", univers: "" }, "passer")}>
          {t("passer")}
        </Bouton>
      </div>
    </form>
  );
});
