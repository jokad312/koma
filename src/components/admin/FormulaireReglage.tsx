"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { formaterUsd, prixPourSaisie } from "@/lib/argent";
import { enregistrerReglage, type EtatReglage } from "@/modules/admin/actions";
import type { CleReglage, CodeErreurAdmin } from "@/modules/admin/types";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

type Props = {
  cle: CleReglage;
  // Valeur lue en base au chargement (texte, centimes pour un forfait) ; null = absente (« Valeur à fixer », jamais de valeur de repli).
  valeur: string | null;
};

// Par clé : textes d'interface, forme du champ et code d'erreur de champ.
const CONFIG: Record<CleReglage, { texte: string; champ: "texte" | "tel" | "usd" | "entier" | "multiligne"; erreur: CodeErreurAdmin }> = {
  nom_site: { texte: "nomSite", champ: "texte", erreur: "nom_invalide" },
  numero_whatsapp: { texte: "numeroWhatsapp", champ: "tel", erreur: "numero_invalide" },
  forfait_livraison_goma_cents: { texte: "forfaitGoma", champ: "usd", erreur: "forfait_goma_invalide" },
  forfait_livraison_bukavu_cents: { texte: "forfaitBukavu", champ: "usd", erreur: "forfait_bukavu_invalide" },
  retrait_goma_fr: { texte: "retraitFr", champ: "multiligne", erreur: "retrait_fr_invalide" },
  retrait_goma_en: { texte: "retraitEn", champ: "multiligne", erreur: "retrait_en_invalide" },
  plafond_fabrication: { texte: "plafond", champ: "entier", erreur: "plafond_invalide" },
};

// Un réglage = un formulaire. Le succès n'apparaît qu'après la réponse de l'action serveur ; la saisie est conservée après un échec.
export function FormulaireReglage({ cle, valeur }: Props) {
  const t = useTranslations("Admin.reglages");
  const locale = useLocale() === "en" ? "en" : "fr";
  const { texte, champ, erreur: erreurChamp } = CONFIG[cle];
  const estUsd = champ === "usd";
  // Un forfait est gardé en centimes : le champ le montre en USD, la valeur actuelle aussi.
  const versSaisie = (v: string) => (estUsd && /^[0-9]+$/.test(v) ? prixPourSaisie(Number(v)) : v);
  const versAffichage = (v: string) => (estUsd && /^[0-9]+$/.test(v) ? formaterUsd(Number(v), locale) : v);
  const [etat, action, enCours] = useActionState<EtatReglage | null, FormData>(enregistrerReglage, null);
  const refChamp = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // Champ contrôlé et jamais remonté : le focus reste en place. La saisie prend la valeur rendue par le serveur à chaque réponse.
  const [saisie, setSaisie] = useState(valeur === null ? "" : versSaisie(valeur));
  const [dernierEtat, setDernierEtat] = useState(etat);
  if (etat !== dernierEtat) {
    setDernierEtat(etat);
    if (etat) setSaisie(etat.statut === "succes" ? versSaisie(etat.valeur) : etat.valeur);
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
  const erreurDeChamp = erreur === erreurChamp;

  return (
    <section aria-labelledby={`${idChamp}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 id={`${idChamp}-titre`} className="t-h2">
        {t(`${texte}.titre`)}
      </h2>
      <p className="t-small text-text-secondary">{courante ? t("valeurActuelle", { valeur: versAffichage(courante) }) : t("valeurAFixer")}</p>
      <form action={action} className="flex flex-col items-start gap-3">
        <input type="hidden" name="cle" value={cle} />
        <label htmlFor={idChamp} className="t-label text-text-primary">
          {t(`${texte}.libelle`)}
        </label>
        <p id={idAide} className="t-small text-text-secondary">
          {t(`${texte}.aide`)}
        </p>
        {champ === "multiligne" ? (
          <textarea
            ref={refChamp}
            id={idChamp}
            name="valeur"
            rows={3}
            autoComplete="off"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            aria-invalid={erreurDeChamp || undefined}
            aria-describedby={erreurDeChamp ? `${idAide} ${idErreur}` : idAide}
            className={CHAMP}
          />
        ) : (
          <input
            ref={refChamp}
            id={idChamp}
            name="valeur"
            type={champ === "tel" ? "tel" : "text"}
            inputMode={champ === "tel" ? "tel" : estUsd ? "decimal" : champ === "entier" ? "numeric" : undefined}
            autoComplete="off"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            aria-invalid={erreurDeChamp || undefined}
            aria-describedby={erreurDeChamp ? `${idAide} ${idErreur}` : idAide}
            className={CHAMP}
          />
        )}
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
