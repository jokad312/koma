"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { TAILLES, type CodeErreurCatalogue, type Taille } from "@/modules/catalogue/types";
import { ChampTexte } from "./ChampTexte";

export type EtatVariante = { actif: boolean; stock: string; surCommande: boolean; delai: string };
export type EtatVariantes = Record<Taille, EtatVariante>;

export const VARIANTES_VIDES: EtatVariantes = Object.fromEntries(
  TAILLES.map((taille) => [taille, { actif: false, stock: "0", surCommande: false, delai: "" }]),
) as EtatVariantes;

// Choix sélectionné : bordure rouge 2 px et coche (jamais la couleur seule). Case native, aucune action au choix.
const OPTION =
  "relative flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border-field bg-surface px-4 py-3 has-[:checked]:border-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

type Props = {
  famille: string;
  valeur: EtatVariantes;
  onChange: (taille: Taille, partiel: Partial<EtatVariante>) => void;
  // Erreur de variante renvoyée par le serveur : rattachée à une taille quand elle est connue.
  erreur: { code: CodeErreurCatalogue; taille?: Taille } | null;
};

function Coche() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="invisible size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:visible">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

// Tailles XS à XXL, plus « Sur mesure » pour un cosplay seulement (choix de taille : les mesures viendront plus tard).
// Chaque taille proposée a son stock, sa fabrication sur commande et un délai facultatif. Rien n'est envoyé avant « Enregistrer ».
export function EditeurVariantes({ famille, valeur, onChange, erreur }: Props) {
  const t = useTranslations("Admin.produits.formulaire");
  const base = useId();
  const tailles = TAILLES.filter((taille) => taille !== "sur_mesure" || famille === "cosplay");
  const erreurGlobale = erreur && !erreur.taille ? erreur.code : null;
  const idErreurGlobale = `${base}-erreur`;

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={`${base}-aide${erreurGlobale ? ` ${idErreurGlobale}` : ""}`}>
      <legend className="t-h2 mb-2">{t("variantes.titre")}</legend>
      <p id={`${base}-aide`} className="t-small text-text-secondary">
        {t("variantes.aide")}
      </p>
      {erreurGlobale ? (
        <p id={idErreurGlobale} className="t-small text-danger">
          {t(`erreurs.${erreurGlobale}`)}
        </p>
      ) : null}
      {tailles.map((taille) => {
        const etat = valeur[taille];
        const idTaille = `${base}-${taille}`;
        const surMesure = taille === "sur_mesure";
        const delaiErreur = erreur?.taille === taille && (erreur.code === "delai_invalide" || erreur.code === "delai_manquant") ? erreur.code : null;
        const stockErreur = erreur?.taille === taille && erreur.code === "stock_invalide" ? erreur.code : null;
        const tailleErreur = erreur?.taille === taille && erreur.code === "taille_invalide" ? erreur.code : null;
        return (
          <fieldset key={taille} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <legend className="t-label px-1 text-text-primary">{t(`variantes.tailles.${taille}`)}</legend>
            <label className={OPTION}>
              <input
                type="checkbox"
                name={`taille_${taille}`}
                checked={etat.actif}
                onChange={(e) => onChange(taille, { actif: e.target.checked })}
                className="peer sr-only"
                aria-describedby={tailleErreur ? `${idTaille}-erreur` : undefined}
              />
              <Coche />
              {t("variantes.proposer", { taille: t(`variantes.tailles.${taille}`) })}
            </label>
            {tailleErreur ? (
              <p id={`${idTaille}-erreur`} className="t-small text-danger">
                {t(`erreurs.${tailleErreur}`)}
              </p>
            ) : null}
            {etat.actif ? (
              <div className="flex flex-col gap-3">
                {surMesure ? (
                  <p className="t-small text-text-secondary">{t("variantes.surMesure")}</p>
                ) : (
                  <>
                    <ChampTexte
                      id={`${idTaille}-stock`}
                      name={`stock_${taille}`}
                      libelle={t("variantes.stock")}
                      valeur={etat.stock}
                      inputMode="numeric"
                      erreur={stockErreur ? t(`erreurs.${stockErreur}`) : null}
                      onChange={(v) => onChange(taille, { stock: v })}
                    />
                    <label className={OPTION}>
                      <input
                        type="checkbox"
                        name={`commande_${taille}`}
                        checked={etat.surCommande}
                        onChange={(e) => onChange(taille, { surCommande: e.target.checked })}
                        className="peer sr-only"
                      />
                      <Coche />
                      {t("variantes.surCommande")}
                    </label>
                  </>
                )}
                <ChampTexte
                  id={`${idTaille}-delai`}
                  name={`delai_${taille}`}
                  libelle={t("variantes.delai")}
                  aide={t("variantes.delaiAide")}
                  valeur={etat.delai}
                  inputMode="numeric"
                  erreur={delaiErreur ? t(`erreurs.${delaiErreur}`) : null}
                  onChange={(v) => onChange(taille, { delai: v })}
                />
              </div>
            ) : null}
          </fieldset>
        );
      })}
    </fieldset>
  );
}
