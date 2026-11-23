"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { COULEUR_HEX_REGEX, TAILLES_STANDARD, type CodeErreurCatalogue, type CouleurVariante, type Taille } from "@/modules/catalogue/types";
import { ChampTexte, useClassesChamp } from "./ChampTexte";
import { EditeurVariantes, type EtatVariante, type EtatVariantes } from "./EditeurVariantes";

// Une couleur du Vêtement en cours de saisie : cle locale (stable pendant la saisie), noms FR et EN, pastille, et ses tailles.
export type EtatCouleur = { cle: string; fr: string; en: string; hex: string; variantes: EtatVariantes };

// Erreur relevée avant l'envoi : couleur sans nom français, ou sans aucune taille cochée (elle serait sinon perdue en silence).
export type ErreurCouleurLocale = "nomVide" | "sansTaille";

export function erreursDesCouleurs(couleurs: readonly EtatCouleur[]): Record<string, ErreurCouleurLocale> {
  const erreurs: Record<string, ErreurCouleurLocale> = {};
  for (const c of couleurs) {
    if (c.fr.trim() === "") erreurs[c.cle] = "nomVide";
    else if (!TAILLES_STANDARD.some((t) => c.variantes[t].actif)) erreurs[c.cle] = "sansTaille";
  }
  return erreurs;
}

type Props = {
  couleurs: readonly EtatCouleur[];
  // Couleurs déjà utilisées par les variantes existantes (autocomplétion du nom français, décision 2 de la story 9.15).
  suggestions: readonly CouleurVariante[];
  onAjouter: () => void;
  onRetirer: (cle: string) => void;
  onChangerCouleur: (cle: string, partiel: Partial<Pick<EtatCouleur, "fr" | "en" | "hex">>) => void;
  onChangerVariante: (cle: string, taille: Taille, partiel: Partial<EtatVariante>) => void;
  // Erreur de variante renvoyée par le serveur : rattachée à la couleur (nom français) quand elle est connue.
  erreur: { code: CodeErreurCatalogue; taille?: Taille; couleur?: string } | null;
  // Erreurs relevées avant l'envoi, par clé locale de couleur.
  erreursLocales?: Readonly<Record<string, ErreurCouleurLocale>>;
};

// Grille tailles × couleurs d'un Vêtement : chaque couleur a son nom français et anglais, une pastille facultative et ses tailles XS à XXL
// (stock, fabrication sur commande et délai par case). Ajouter ou retirer une couleur ne change rien tant que « Enregistrer » n'est pas
// touché. La pastille n'est qu'un repère : le nom de la couleur est toujours écrit.
export function EditeurCouleurs({ couleurs, suggestions, onAjouter, onRetirer, onChangerCouleur, onChangerVariante, erreur, erreursLocales = {} }: Props) {
  const classes = useClassesChamp();
  const t = useTranslations("Admin.produits.formulaire");
  const base = useId();
  const idListe = `${base}-suggestions`;
  // Toute erreur de variantes qui ne vise aucune couleur s'affiche ici (la liste des tailles sans couleur est masquée).
  const erreurGlobale = erreur && !erreur.couleur ? erreur.code : null;

  // Une couleur déjà utilisée reprend son nom anglais et sa pastille, seulement si l'admin ne les a pas encore saisis.
  function changerNomFr(c: EtatCouleur, fr: string) {
    const connue = suggestions.find((s) => s.fr.toLowerCase() === fr.trim().toLowerCase());
    onChangerCouleur(c.cle, {
      fr,
      ...(connue && c.en.trim() === "" && connue.en ? { en: connue.en } : {}),
      ...(connue && c.hex.trim() === "" && connue.hex ? { hex: connue.hex } : {}),
    });
  }

  return (
    <fieldset className="flex flex-col gap-4" aria-describedby={`${base}-aide`}>
      <legend className="t-h2 mb-2">{t("couleurs.titre")}</legend>
      <p id={`${base}-aide`} className="t-small text-text-secondary">
        {t("couleurs.aide")}
      </p>
      {erreurGlobale ? <p className="t-small text-danger">{t(`erreurs.${erreurGlobale}`)}</p> : null}
      <datalist id={idListe}>
        {suggestions.map((s) => (
          <option key={s.fr} value={s.fr} />
        ))}
      </datalist>
      {couleurs.map((c, i) => {
        const nom = c.fr.trim() || t("couleurs.sansNom");
        const concernee = erreur?.couleur !== undefined && erreur.couleur.toLowerCase() === c.fr.trim().toLowerCase();
        const locale = erreursLocales[c.cle];
        const erreurCouleur = locale === "nomVide" ? t("couleurs.nomVide") : concernee && erreur?.code === "couleur_invalide" && !erreur.taille ? t("erreurs.couleur_invalide") : null;
        const hexValide = COULEUR_HEX_REGEX.test(c.hex.trim());
        return (
          <section key={c.cle} aria-labelledby={`${base}-${c.cle}-titre`} className={`flex flex-col gap-4 ${classes.bloc} p-4`}>
            <h3 id={`${base}-${c.cle}-titre`} className="t-h3 flex items-center gap-2">
              {hexValide ? <span aria-hidden="true" className="inline-block size-5 shrink-0 rounded-full border border-border-field" style={{ backgroundColor: c.hex.trim() }} /> : null}
              {nom}
            </h3>
            <ChampTexte
              id={`${base}-${c.cle}-fr`}
              name={`couleur_fr_${i}`}
              libelle={t("couleurs.nomFr")}
              aide={t("couleurs.nomFrAide")}
              valeur={c.fr}
              liste={idListe}
              erreur={erreurCouleur}
              onChange={(v) => changerNomFr(c, v)}
            />
            <ChampTexte id={`${base}-${c.cle}-hex`} name={`couleur_hex_${i}`} libelle={t("couleurs.hex")} aide={t("couleurs.hexAide")} valeur={c.hex} onChange={(v) => onChangerCouleur(c.cle, { hex: v })} />
            {locale === "sansTaille" ? (
              <p role="alert" className="t-small text-danger">
                {t("couleurs.sansTaille")}
              </p>
            ) : null}
            <EditeurVariantes
              famille="vetement"
              valeur={c.variantes}
              onChange={(taille, partiel) => onChangerVariante(c.cle, taille, partiel)}
              erreur={concernee && erreur?.taille ? { code: erreur.code, taille: erreur.taille } : null}
              titre={t("couleurs.groupe", { couleur: nom })}
              imbrique
            />
            <div>
              <Bouton variante="secondaire" onClick={() => onRetirer(c.cle)}>
                {t("couleurs.retirer", { couleur: nom })}
              </Bouton>
            </div>
          </section>
        );
      })}
      {couleurs.length === 0 ? <p className="t-small text-text-secondary">{t("couleurs.aucune")}</p> : null}
      <div>
        <Bouton variante="secondaire" onClick={onAjouter}>
          {t("couleurs.ajouter")}
        </Bouton>
      </div>
    </fieldset>
  );
}
