"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { enregistrerReglage, type EtatReglage } from "@/modules/admin/actions";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

type Props = {
  cle: "nom_site" | "numero_whatsapp";
  // Valeur lue en base au chargement ; null = absente (« Valeur à fixer », jamais de valeur de repli).
  valeur: string | null;
};

const TEXTES = {
  nom_site: "nomSite",
  numero_whatsapp: "numeroWhatsapp",
} as const;

// Un réglage = un formulaire. Le succès n'apparaît qu'après la réponse de l'action serveur ; la saisie est conservée après un échec.
export function FormulaireReglage({ cle, valeur }: Props) {
  const t = useTranslations("Admin.reglages");
  const texte = TEXTES[cle];
  const [etat, action, enCours] = useActionState<EtatReglage | null, FormData>(enregistrerReglage, null);
  const refChamp = useRef<HTMLInputElement>(null);
  // Champ contrôlé et jamais remonté : le focus reste en place. La saisie prend la valeur rendue par le serveur à chaque réponse.
  const [saisie, setSaisie] = useState(valeur ?? "");
  const [dernierEtat, setDernierEtat] = useState(etat);
  if (etat !== dernierEtat) {
    setDernierEtat(etat);
    if (etat) setSaisie(etat.valeur);
  }
  const idChamp = useId();
  const idAide = useId();
  const idErreur = useId();

  // Après un échec, le focus revient sur le champ.
  useEffect(() => {
    if (etat?.statut === "erreur") refChamp.current?.focus();
  }, [etat]);

  const courante = etat?.statut === "succes" ? etat.valeur || null : valeur;
  const erreur = etat?.statut === "erreur" ? etat.erreur : null;
  const erreurDeChamp = erreur === "nom_invalide" || erreur === "numero_invalide";

  return (
    <section aria-labelledby={`${idChamp}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 id={`${idChamp}-titre`} className="t-h2">
        {t(`${texte}.titre`)}
      </h2>
      <p className="t-small text-text-secondary">{courante ? t("valeurActuelle", { valeur: courante }) : t("valeurAFixer")}</p>
      <form action={action} className="flex flex-col items-start gap-3">
        <input type="hidden" name="cle" value={cle} />
        <label htmlFor={idChamp} className="t-label text-text-primary">
          {t(`${texte}.libelle`)}
        </label>
        <p id={idAide} className="t-small text-text-secondary">
          {t(`${texte}.aide`)}
        </p>
        <input
          ref={refChamp}
          id={idChamp}
          name="valeur"
          type={cle === "numero_whatsapp" ? "tel" : "text"}
          inputMode={cle === "numero_whatsapp" ? "tel" : undefined}
          autoComplete="off"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-invalid={erreurDeChamp || undefined}
          aria-describedby={erreurDeChamp ? `${idAide} ${idErreur}` : idAide}
          className={CHAMP}
        />
        {erreurDeChamp && erreur ? (
          <p id={idErreur} role="alert" className="t-small text-danger">
            {t(`erreurs.${erreur}`)}
          </p>
        ) : null}
        <Bouton type="submit" enCours={enCours}>
          {enCours ? t("enCours") : t("enregistrer")}
        </Bouton>
      </form>
      {erreur && !erreurDeChamp ? <MessageEtat type="erreur">{t(`erreurs.${erreur === "non_autorise" ? "non_autorise" : "generique"}`)}</MessageEtat> : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}
    </section>
  );
}
