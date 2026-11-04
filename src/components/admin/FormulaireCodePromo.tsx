"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { creerCodePromoAction, modifierCodePromoAction } from "@/modules/promo/actions";
import type { CodePromo, ErreurCodePromo, ResultatCodePromo } from "@/modules/promo/types";
import { ChampTexte } from "./ChampTexte";

type Champ = "code" | "affilie" | "reductionPct" | "commissionPct" | "plafond";

// Champ de la page relié à chaque erreur (UX-DR44) : l'erreur s'affiche sous le champ et est reliée par aria-describedby.
const CHAMP_DE_L_ERREUR: Partial<Record<ErreurCodePromo, Champ>> = {
  code_invalide: "code",
  code_existant: "code",
  affilie_invalide: "affilie",
  reduction_invalide: "reductionPct",
  commission_invalide: "commissionPct",
  plafond_invalide: "plafond",
};

const SUFFIXE_DU_CHAMP: Record<Champ, string> = {
  code: "code",
  affilie: "affilie",
  reductionPct: "reduction",
  commissionPct: "commission",
  plafond: "plafond",
};

type Props = {
  // Absent : création. Présent : modification ; le code n'est alors jamais modifiable.
  code?: CodePromo;
  onTermine?: () => void;
};

// Création et modification d'un Code promo (story 9.1, FR-46). Le succès n'apparaît qu'après la réponse réelle du serveur ;
// après un échec la saisie est conservée. La liste est relue par le serveur (router.refresh).
export function FormulaireCodePromo({ code, onTermine }: Props) {
  const t = useTranslations("Admin.codesPromo");
  const router = useRouter();
  const id = useId();
  const [codeSaisi, setCodeSaisi] = useState("");
  const [affilie, setAffilie] = useState(code?.affilie ?? "");
  const [reductionPct, setReductionPct] = useState(code ? String(code.reductionPct) : "");
  const [commissionPct, setCommissionPct] = useState(code ? String(code.commissionPct) : "");
  const [plafond, setPlafond] = useState(code ? String(code.plafond) : "");
  const [actif, setActif] = useState(code?.actif ?? true);
  const [erreur, setErreur] = useState<ErreurCodePromo | null>(null);
  const [succes, setSucces] = useState(false);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);

  const champ = erreur ? CHAMP_DE_L_ERREUR[erreur] : undefined;

  // Une erreur de champ déplace le focus sur ce champ : le lecteur d'écran annonce son libellé et le message relié (aria-describedby).
  useEffect(() => {
    if (!champ) return;
    document.getElementById(`${id}-${SUFFIXE_DU_CHAMP[champ]}`)?.focus();
  }, [champ, erreur, id]);

  // Retaper après un succès efface le message de succès : il ne décrit plus l'état du formulaire.
  const saisir = (setter: (valeur: string) => void) => (valeur: string) => {
    setSucces(false);
    setter(valeur);
  };
  const erreurGenerale = erreur && !champ ? erreur : null;

  function lancer(operation: () => Promise<ResultatCodePromo>) {
    if (enVol.current) return;
    enVol.current = true;
    setErreur(null);
    setSucces(false);
    demarrer(async () => {
      try {
        const resultat = await operation();
        if (resultat.ok) {
          setSucces(true);
          setErreur(null);
          if (!code) {
            setCodeSaisi("");
            setAffilie("");
            setReductionPct("");
            setCommissionPct("");
            setPlafond("");
            setActif(true);
          }
          router.refresh();
        } else {
          setErreur(resultat.erreur);
          // Code supprimé entre-temps : la liste affichée est périmée, elle est relue.
          if (resultat.erreur === "introuvable") router.refresh();
        }
      } catch {
        setErreur("generique");
      } finally {
        enVol.current = false;
      }
    });
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (code) {
      lancer(() => modifierCodePromoAction(code.id, { affilie, reductionPct, commissionPct, plafond, actif }));
    } else {
      lancer(() => creerCodePromoAction({ code: codeSaisi, affilie, reductionPct, commissionPct, plafond, actif }));
    }
  }

  const erreurDe = (c: Champ) => (champ === c ? t(`erreurs.${erreur}`) : null);

  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 id={`${id}-titre`} className="t-h2">
        {code ? t("modification.titre") : t("creation.titre")}
      </h2>

      {code ? (
        <p className="t-body text-text-primary">
          <span className="t-label">{t("champs.codeLigne", { code: code.code })}</span>
        </p>
      ) : null}

      <form onSubmit={surEnvoi} noValidate className="flex flex-col items-start gap-3">
        {code ? null : (
          <ChampTexte
            id={`${id}-code`}
            name="code"
            libelle={t("champs.code")}
            aide={t("aides.code")}
            erreur={erreurDe("code")}
            valeur={codeSaisi}
            onChange={saisir(setCodeSaisi)}
          />
        )}
        <ChampTexte
          id={`${id}-affilie`}
          name="affilie"
          libelle={t("champs.affilie")}
          erreur={erreurDe("affilie")}
          valeur={affilie}
          onChange={saisir(setAffilie)}
        />
        <ChampTexte
          id={`${id}-reduction`}
          name="reductionPct"
          libelle={t("champs.reductionPct")}
          erreur={erreurDe("reductionPct")}
          valeur={reductionPct}
          onChange={saisir(setReductionPct)}
          inputMode="decimal"
        />
        <ChampTexte
          id={`${id}-commission`}
          name="commissionPct"
          libelle={t("champs.commissionPct")}
          erreur={erreurDe("commissionPct")}
          valeur={commissionPct}
          onChange={saisir(setCommissionPct)}
          inputMode="decimal"
        />
        <ChampTexte
          id={`${id}-plafond`}
          name="plafond"
          libelle={t("champs.plafond")}
          aide={code ? t("aides.plafondModif") : t("aides.plafond")}
          erreur={erreurDe("plafond")}
          valeur={plafond}
          onChange={saisir(setPlafond)}
          inputMode="numeric"
        />

        <div className="flex items-center gap-3">
          <input
            id={`${id}-actif`}
            name="actif"
            type="checkbox"
            checked={actif}
            onChange={(e) => {
              setSucces(false);
              setActif(e.target.checked);
            }}
            className="size-5 rounded border border-border-field"
          />
          <label htmlFor={`${id}-actif`} className="t-label text-text-primary">
            {t("champs.actif")}
          </label>
        </div>

        {erreurGenerale ? <MessageEtat type="erreur">{t(`erreurs.${erreurGenerale}`)}</MessageEtat> : null}
        {succes ? <MessageEtat type="succes">{code ? t("succes.modification") : t("succes.creation")}</MessageEtat> : null}

        <div className="flex flex-wrap gap-3">
          <Bouton type="submit" variante="secondaire" enCours={enCours}>
            {code ? t("boutons.enregistrer") : t("boutons.creer")}
          </Bouton>
          {code && onTermine ? (
            <Bouton variante="secondaire" onClick={onTermine}>
              {t("boutons.fermer")}
            </Bouton>
          ) : null}
        </div>
      </form>
    </section>
  );
}
