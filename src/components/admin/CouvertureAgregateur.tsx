"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { ajouterCoupleAction, confirmerCoupleAction, retirerCoupleAction } from "@/modules/paiement/actions";
import type { CoupleCouverture, ErreurCouverture, ResultatCouverture } from "@/modules/paiement/couverture";
import type { CodePrestataire } from "@/modules/paiement/types";

type Champ = "pays" | "operateur" | "source";

// Champ de la page relié à chaque erreur (UX-DR44) : l'erreur s'affiche sous le champ et est reliée par aria-describedby.
const CHAMP_DE_L_ERREUR: Partial<Record<ErreurCouverture, Champ>> = {
  source_manquante: "source",
  source_invalide: "source",
  pays_invalide: "pays",
  operateur_invalide: "operateur",
  couple_existant: "operateur",
};

function nomPays(code: string, langue: string): string {
  try {
    return new Intl.DisplayNames([langue], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Couverture d'un Agrégateur (story 5.1) : les couples pays-opérateur viennent de sa documentation officielle et de ses contrats, avec leur source.
// Un couple reste « À vérifier » tant que Jonathan ne le confirme pas ; seul un couple confirmé d'un Agrégateur actif sert au paiement.
export function CouvertureAgregateur({ prestataire, nom, couples }: { prestataire: CodePrestataire; nom: string; couples: CoupleCouverture[] }) {
  const t = useTranslations("Admin.prestataires.couverture");
  const langue = useLocale();
  const router = useRouter();
  const id = useId();
  const [enCours, demarrer] = useTransition();
  const [pays, setPays] = useState("");
  const [operateur, setOperateur] = useState("");
  const [source, setSource] = useState("");
  const [erreur, setErreur] = useState<ErreurCouverture | null>(null);

  const champ = erreur ? CHAMP_DE_L_ERREUR[erreur] : undefined;
  const erreurGenerale = erreur && !champ ? erreur : null;

  function lancer(operation: () => Promise<ResultatCouverture>, apresSucces?: () => void) {
    setErreur(null);
    demarrer(async () => {
      try {
        const resultat = await operation();
        if (resultat.ok) apresSucces?.();
        else setErreur(resultat.erreur);
      } catch {
        setErreur("generique");
      }
      router.refresh();
    });
  }

  const idErreur = (c: Champ) => `${id}-${c}-erreur`;
  // L'aide de la source reste lue pendant l'erreur : les deux ids sont listés.
  const lieErreur = (c: Champ) => (champ === c ? { "aria-invalid": true, "aria-describedby": c === "source" ? `${idErreur(c)} ${id}-aide-source` : idErreur(c) } : {});
  const CLASSE_CHAMP = "min-h-touch rounded-md border border-border-field bg-surface px-3";

  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 border-t border-border pt-3">
      <h3 id={`${id}-titre`} className="t-label text-text-primary">
        {t("titre", { prestataire: nom })}
      </h3>
      {couples.length === 0 ? (
        <p className="t-small text-text-secondary">{t("vide")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {couples.map((c) => {
            const couple = `${nomPays(c.pays, langue)} · ${c.operateur}`;
            return (
              <li key={c.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <p className="t-label text-text-primary">{couple}</p>
                <p className="t-small text-text-primary" data-etat={c.etat}>
                  {t(`etat.${c.etat}`)}
                </p>
                <p className="t-small text-text-secondary">{t("source", { source: c.source })}</p>
                <div className="flex flex-wrap gap-3">
                  {c.etat === "a_verifier" ? (
                    <Bouton variante="secondaire" enCours={enCours} onClick={() => lancer(() => confirmerCoupleAction(c.id))}>
                      {t("confirmer", { couple })}
                    </Bouton>
                  ) : null}
                  <Bouton variante="secondaire" enCours={enCours} onClick={() => lancer(() => retirerCoupleAction(c.id))}>
                    {t("retirer", { couple })}
                  </Bouton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          lancer(
            () => ajouterCoupleAction({ prestataire, pays, operateur, source }),
            () => {
              setPays("");
              setOperateur("");
              setSource("");
            },
          );
        }}
      >
        <h4 className="t-label text-text-primary">{t("ajouter.titre")}</h4>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-pays`} className="t-small text-text-primary">
            {t("ajouter.pays")}
          </label>
          <input id={`${id}-pays`} value={pays} onChange={(e) => setPays(e.target.value)} maxLength={2} autoCapitalize="characters" className={CLASSE_CHAMP} {...lieErreur("pays")} />
          {champ === "pays" ? (
            <p id={idErreur("pays")} role="alert" className="t-small text-danger">
              {t(`erreurs.${erreur}`)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-operateur`} className="t-small text-text-primary">
            {t("ajouter.operateur")}
          </label>
          <input id={`${id}-operateur`} value={operateur} onChange={(e) => setOperateur(e.target.value)} maxLength={40} className={CLASSE_CHAMP} {...lieErreur("operateur")} />
          {champ === "operateur" ? (
            <p id={idErreur("operateur")} role="alert" className="t-small text-danger">
              {t(`erreurs.${erreur}`)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-source`} className="t-small text-text-primary">
            {t("ajouter.source")}
          </label>
          <input id={`${id}-source`} value={source} onChange={(e) => setSource(e.target.value)} maxLength={300} className={CLASSE_CHAMP} {...lieErreur("source")} />
          <p id={`${id}-aide-source`} className="t-small text-text-secondary">
            {t("ajouter.aideSource")}
          </p>
          {champ === "source" ? (
            <p id={idErreur("source")} role="alert" className="t-small text-danger">
              {t(`erreurs.${erreur}`)}
            </p>
          ) : null}
        </div>
        {erreurGenerale ? <MessageEtat type="erreur">{t(`erreurs.${erreurGenerale}`)}</MessageEtat> : null}
        <div>
          <Bouton type="submit" variante="secondaire" enCours={enCours}>
            {t("ajouter.bouton", { prestataire: nom })}
          </Bouton>
        </div>
      </form>
    </section>
  );
}
