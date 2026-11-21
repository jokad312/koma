"use client";

import { Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { changerEtatCodePromoAction } from "@/modules/promo/actions";
import type { CodePromo, ErreurCodePromo } from "@/modules/promo/types";
import { useAnnonceCodesPromo } from "./AnnoncesCodesPromo";

const ICONE = "inline-flex size-touch shrink-0 items-center justify-center rounded-full no-underline hover:bg-admin-champ disabled:text-text-secondary";

// Actions d'une ligne de Code promo (story 9.16 i, maquette CP8) : copier (Q30 : presse-papiers, « copié » annoncé en statut), modifier (fenêtre sur la même
// route, Q23), corbeille = désactiver (Q22 : jamais de suppression ; confirmation d'abord) ; un code inactif propose « Réactiver » (sans confirmation :
// l'action ne perd rien). Désactiver et réactiver ne changent que l'état (changerEtatCodePromoAction : mêmes droits et même fonction de base que la
// modification, autres valeurs relues en base par le serveur) ; l'état affiché est relu en base après la réponse (router.refresh), jamais supposé.
// Les annonces passent par la zone de la page (AnnoncesCodesPromo) : la ligne peut quitter la vue après l'action ; le focus va alors au compteur.
export function ActionsCodePromo({ code, modifier }: { code: CodePromo; modifier: string }) {
  const t = useTranslations("Admin.codesPromo");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const annoncer = useAnnonceCodesPromo();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const corbeille = useRef<HTMLButtonElement>(null);

  async function copier() {
    setErreur(null);
    try {
      await navigator.clipboard.writeText(code.code);
      annoncer(t("actions.copie", { code: code.code }));
    } catch {
      setErreur(t("actions.copieImpossible"));
    }
  }

  function changerEtat(actif: boolean) {
    if (enVol.current) return;
    enVol.current = true;
    setErreur(null);
    demarrer(async () => {
      try {
        const resultat = await changerEtatCodePromoAction(code.id, actif);
        setOuvert(false);
        if (resultat.ok) {
          annoncer(actif ? t("actions.reactive", { code: code.code }) : t("actions.desactive", { code: code.code }), { focusCompteur: true });
          router.refresh();
        } else {
          const e: ErreurCodePromo = resultat.erreur;
          setErreur(t(`erreurs.${e}`));
          if (e === "introuvable") router.refresh();
        }
      } catch {
        setOuvert(false);
        setErreur(t("erreurs.generique"));
      } finally {
        enVol.current = false;
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" onClick={copier} disabled={enCours} aria-label={t("actions.copier", { code: code.code })} className={`${ICONE} text-text-primary`}>
        <Copy aria-hidden="true" className="size-7" />
      </button>
      <Link href={modifier} aria-label={t("boutons.modifierCode", { code: code.code })} className={`${ICONE} text-text-secondary`}>
        <Pencil aria-hidden="true" className="size-7" />
      </Link>
      {code.actif ? (
        <button
          ref={corbeille}
          type="button"
          onClick={() => setOuvert(true)}
          disabled={enCours}
          aria-label={t("actions.desactiver", { code: code.code })}
          className={`${ICONE} text-primary`}
        >
          <Trash2 aria-hidden="true" className="size-7" />
        </button>
      ) : (
        <Bouton variante="secondaire" onClick={() => changerEtat(true)} enCours={enCours} aria-label={t("actions.reactiverSur", { code: code.code })}>
          {enCours ? null : <RotateCcw aria-hidden="true" className="size-5" />}
          {enCours ? t("actions.enCours") : t("actions.reactiver")}
        </Bouton>
      )}
      {erreur ? (
        <p role="alert" className="t-small w-full text-text-primary">
          {erreur}
        </p>
      ) : null}
      <Dialogue
        ouvert={ouvert}
        onFermer={() => {
          if (!enVol.current) setOuvert(false);
        }}
        titre={t("confirmation.titre", { code: code.code })}
        retourFocus={corbeille}
      >
        <p className="t-body">{t("confirmation.texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={enCours} onClick={() => setOuvert(false)}>
            {t("confirmation.annuler")}
          </button>
          <Bouton enCours={enCours} onClick={() => changerEtat(false)}>
            {enCours ? t("actions.enCours") : t("confirmation.confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </div>
  );
}
