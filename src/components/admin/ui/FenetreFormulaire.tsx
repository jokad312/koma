"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Dialogue } from "@/components/ui/Dialogue";
import { CLASSES_PRINCIPAL, CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Link, useRouter } from "@/i18n/navigation";

// Formulaire de l'admin dessiné en fenêtre (story 9.16 b, maquettes D1 à D6 ; décision Q23) : la page reste une page, sur sa route, mais s'affiche comme une
// fenêtre posée sur un fond assombri et flouté (sans la liste derrière). En-tête : titre, bouton « Enregistrer » (il soumet le formulaire désigné par
// idFormulaire, qui reste dans la page), croix ; trait sous l'en-tête. Échap et la croix ramènent à la liste (retour).
// Si un champ de la fenêtre a été modifié (saisie ou changement), Échap et la croix demandent d'abord « Quitter sans enregistrer ? » (Quitter / Continuer
// la saisie) ; sans modification, la fenêtre se ferme directement. Échap est ignoré quand une fenêtre modale est ouverte au-dessus, dans une liste déroulante,
// pendant une composition de texte ou pendant l'enregistrement. « Modifié » n'est pas remis à zéro à la soumission : si l'enregistrement échoue, la saisie
// reste protégée (une confirmation de trop vaut mieux qu'une saisie perdue).
export function FenetreFormulaire({
  titre,
  retour,
  idFormulaire,
  enregistrementEnCours = false,
  children,
}: {
  titre: string;
  retour: string;
  idFormulaire: string;
  enregistrementEnCours?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Admin.ui");
  const routeur = useRouter();
  const modifie = useRef(false);
  const [confirmation, setConfirmation] = useState(false);
  const enCours = useRef(enregistrementEnCours);
  const idTitre = useId();
  useEffect(() => {
    enCours.current = enregistrementEnCours;
  }, [enregistrementEnCours]);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      // Une fenêtre modale est ouverte au-dessus (Aide, « Plus », confirmation) : Échap lui revient. Son propre écouteur, ajouté après celui-ci,
      // s'exécute plus tard : on ne peut pas compter sur defaultPrevented.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // Échap dans une liste déroulante native la referme ; pendant l'enregistrement, on ne quitte pas.
      if ((e.target as HTMLElement | null)?.closest?.("select") || enCours.current) return;
      e.preventDefault();
      if (modifie.current) setConfirmation(true);
      else routeur.push(retour);
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [retour, routeur]);

  function surCroix(e: MouseEvent<HTMLAnchorElement>) {
    if (enCours.current) {
      e.preventDefault();
      return;
    }
    // Ctrl, Meta, Maj ou bouton du milieu : un autre onglet s'ouvre, rien n'est perdu ici.
    if (!modifie.current || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setConfirmation(true);
  }

  const marquer = () => {
    modifie.current = true;
  };

  return (
    <div className="relative isolate px-0 py-4 md:px-6">
      <div aria-hidden="true" className="absolute inset-0 -z-10 rounded-[22px] bg-scrim backdrop-blur-sm" />
      <section
        aria-labelledby={idTitre}
        onInputCapture={marquer}
        onChangeCapture={marquer}
        className="mx-auto w-full max-w-[670px] rounded-[20px] bg-admin-fenetre p-5 text-text-primary shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b-[3px] border-text-primary pb-4">
          <h1 id={idTitre} className="t-h3 max-w-[12ch] uppercase">
            {titre}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="submit"
              form={idFormulaire}
              aria-disabled={enregistrementEnCours || undefined}
              onClick={(e) => {
                if (enregistrementEnCours) e.preventDefault();
              }}
              className="t-button inline-flex min-h-touch items-center justify-center rounded-full bg-primary px-5 py-3 text-on-primary"
            >
              {t("enregistrer")}
            </button>
            <Link href={retour} onClick={surCroix} aria-label={t("fermer")} className="inline-flex size-11 items-center justify-center rounded-full text-text-primary no-underline">
              <X aria-hidden="true" className="size-6" />
            </Link>
          </div>
        </div>
        <div className="pt-5">{children}</div>
      </section>

      <Dialogue ouvert={confirmation} onFermer={() => setConfirmation(false)} titre={t("quitter.titre")} entete="fenetre">
        <div className="flex flex-wrap gap-3">
          <button type="button" className={CLASSES_PRINCIPAL} onClick={() => routeur.push(retour)}>
            {t("quitter.quitter")}
          </button>
          <button type="button" className={CLASSES_SECONDAIRE} onClick={() => setConfirmation(false)}>
            {t("quitter.continuer")}
          </button>
        </div>
      </Dialogue>
    </div>
  );
}
