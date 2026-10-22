"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { creerUnivers, type EtatUnivers } from "@/modules/catalogue/actions";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

// Création d'un univers (jamais de renommage ni de suppression). Le succès n'apparaît qu'après la réponse de l'action serveur ;
// la saisie est conservée après un échec et vidée seulement après un succès réel. La liste est relue par le serveur (router.refresh).
export function FormulaireUnivers() {
  const t = useTranslations("Admin.univers.formulaire");
  const router = useRouter();
  const [nomFr, setNomFr] = useState("");
  const [nomEn, setNomEn] = useState("");
  const [etat, setEtat] = useState<EtatUnivers | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const refResume = useRef<HTMLDivElement>(null);
  const idFr = useId();
  const idEn = useId();
  const idAideFr = useId();
  const idAideEn = useId();
  const idErreurFr = useId();
  const idErreurEn = useId();

  // Après un échec, le focus va au résumé d'erreur (annoncé en alerte).
  useEffect(() => {
    if (etat?.statut === "erreur") refResume.current?.focus();
  }, [etat]);

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    enVol.current = true;
    setEtat(null);
    demarrer(async () => {
      try {
        const resultat = await creerUnivers({ nomFr, nomEn });
        setEtat(resultat);
        if (resultat.statut === "succes") {
          setNomFr("");
          setNomEn("");
          router.refresh();
        }
      } catch {
        // Réseau coupé : jamais un faux succès, la saisie est conservée.
        setEtat({ statut: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  const erreur = etat?.statut === "erreur" ? etat : null;
  const erreurFr = erreur?.champ === "nom_fr";
  const erreurEn = erreur?.champ === "nom_en";
  const erreurDeChamp = erreurFr || erreurEn;

  return (
    <section aria-labelledby={`${idFr}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 id={`${idFr}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      {erreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{erreurDeChamp ? t("resume") : t(`erreurs.${erreur.erreur === "non_autorise" || erreur.erreur === "univers_existe" || erreur.erreur === "nom_invalide" ? erreur.erreur : "generique"}`)}</MessageEtat>
        </div>
      ) : null}
      <form onSubmit={surEnvoi} noValidate className="flex flex-col items-start gap-3">
        <label htmlFor={idFr} className="t-label text-text-primary">
          {t("nomFr.libelle")}
        </label>
        <p id={idAideFr} className="t-small text-text-secondary">
          {t("nomFr.aide")}
        </p>
        <input
          id={idFr}
          name="nom_fr"
          type="text"
          autoComplete="off"
          value={nomFr}
          onChange={(e) => setNomFr(e.target.value)}
          aria-invalid={erreurFr || undefined}
          aria-describedby={erreurFr ? `${idAideFr} ${idErreurFr}` : idAideFr}
          className={CHAMP}
        />
        {erreurFr ? (
          <p id={idErreurFr} className="t-small text-danger">
            {t("erreurs.nom_invalide")}
          </p>
        ) : null}

        <label htmlFor={idEn} className="t-label text-text-primary">
          {t("nomEn.libelle")}
        </label>
        <p id={idAideEn} className="t-small text-text-secondary">
          {t("nomEn.aide")}
        </p>
        <input
          id={idEn}
          name="nom_en"
          type="text"
          autoComplete="off"
          value={nomEn}
          onChange={(e) => setNomEn(e.target.value)}
          aria-invalid={erreurEn || undefined}
          aria-describedby={erreurEn ? `${idAideEn} ${idErreurEn}` : idAideEn}
          className={CHAMP}
        />
        {erreurEn ? (
          <p id={idErreurEn} className="t-small text-danger">
            {t("erreurs.nom_invalide")}
          </p>
        ) : null}

        <Bouton type="submit" enCours={enCours}>
          {enCours ? t("enCours") : t("creer")}
        </Bouton>
      </form>
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}
    </section>
  );
}
