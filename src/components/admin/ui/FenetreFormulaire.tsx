"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Dialogue } from "@/components/ui/Dialogue";
import { CLASSES_PRINCIPAL, CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Link, useRouter } from "@/i18n/navigation";
import { GardeHydratation } from "../GardeHydratation";

// Ce que la fenêtre offre aux formulaires qu'elle contient (story 9.16 f) : style des champs de la maquette (champ sombre, étiquette en majuscules),
// signal « enregistrement ou envoi en cours » par source (le bouton « Enregistrer » de l'en-tête est occupé et Échap ne quitte pas tant qu'au moins
// une source envoie) et « enregistré » par source (seule la saisie de cette source n'est plus à protéger).
type ContexteFenetre = {
  signalerEnregistrement: (source: string, enCours: boolean) => void;
  marquerEnregistre: (source: string) => void;
  // Story 9.16 h : une saisie faite sans événement de champ (liste d'images changée par un bouton) marque sa source « modifiée ».
  marquerModifie: (source: string) => void;
};

// Attribut qui rattache une saisie à sa source (formulaire principal, zone d'image, zone de fichiers…).
const ATTRIBUT_SOURCE = "data-source-saisie";
// Saisie hors de toute source (galerie, sous-titres…) : protégée jusqu'à la sortie.
const SOURCE_LIBRE = "fenetre";
const Contexte = createContext<ContexteFenetre | null>(null);

const SANS_EFFET = () => {};

// Vrai dans une fenêtre de formulaire : les champs prennent le style de la maquette (D7 à D14).
export function useDansFenetre(): boolean {
  return useContext(Contexte) !== null;
}

// Une source de saisie de la fenêtre (formulaire principal, zone d'envoi) signale son envoi en cours ; enregistre() remet SA saisie à « non modifiée »
// (jamais celle des autres sources). `source` est à poser sur l'élément racine de la source (ses formulaires). Hors fenêtre : sans effet.
export function useEnregistrementFenetre(enCours: boolean): { enregistre: () => void; modifie: () => void; source: { [ATTRIBUT_SOURCE]: string } } {
  const ctx = useContext(Contexte);
  const cle = useId();
  const signaler = ctx?.signalerEnregistrement;
  const marquer = ctx?.marquerEnregistre;
  const marquerModifie = ctx?.marquerModifie;
  useEffect(() => {
    if (!signaler) return;
    signaler(cle, enCours);
    return () => signaler(cle, false);
  }, [cle, enCours, signaler]);
  const enregistre = useCallback(() => marquer?.(cle), [marquer, cle]);
  const modifie = useCallback(() => marquerModifie?.(cle), [marquerModifie, cle]);
  return { enregistre: marquer ? enregistre : SANS_EFFET, modifie: marquerModifie ? modifie : SANS_EFFET, source: { [ATTRIBUT_SOURCE]: cle } };
}

// Rend inertes (clavier, lecteurs d'écran) les éléments du cadre admin que le fond plein écran recouvre : menu latéral, barre du haut, lien d'évitement.
// On remonte de la fenêtre jusqu'à la coque ; à chaque niveau, les frères sont rendus inertes. Hors de la coque (tests) : rien n'est touché.
function rendreLeCadreInerte(depart: HTMLElement): () => void {
  const coque = depart.closest("[data-coque-admin]");
  if (!coque) return SANS_EFFET;
  const touches: HTMLElement[] = [];
  let courant: HTMLElement = depart;
  while (courant !== coque && courant.parentElement) {
    for (const frere of Array.from(courant.parentElement.children)) {
      if (frere === courant || !(frere instanceof HTMLElement) || frere.hasAttribute("inert")) continue;
      frere.setAttribute("inert", "");
      touches.push(frere);
    }
    courant = courant.parentElement;
  }
  return () => {
    for (const el of touches) el.removeAttribute("inert");
  };
}

// Formulaire de l'admin dessiné en fenêtre (story 9.16 b, maquettes D1 à D6 ; décision Q23) : la page reste une page, sur sa route, mais s'affiche comme une
// fenêtre posée sur un fond assombri et flouté, sans la liste derrière. Story 9.16 f : le fond couvre tout l'écran (cadre admin compris, rendu inerte) et
// la fenêtre défile à l'intérieur ; à 390 px elle occupe toute la largeur. En-tête : titre, bouton « Enregistrer » (il soumet le formulaire désigné par
// idFormulaire, qui reste dans la page), croix ; trait sous l'en-tête. Échap et la croix ramènent à la liste (retour).
// Si un champ de la fenêtre a été modifié (saisie ou changement), Échap et la croix demandent d'abord « Quitter sans enregistrer ? » (Quitter / Continuer
// la saisie) ; sans modification, la fenêtre se ferme directement. Échap est ignoré quand une fenêtre modale est ouverte au-dessus, dans une liste déroulante,
// pendant une composition de texte ou pendant un enregistrement ou un envoi. « Modifié » est suivi par source (formulaire principal, chaque zone d'envoi,
// le reste) : un enregistrement réussi ne remet à zéro que sa propre source (useEnregistrementFenetre) ; un échec garde la saisie protégée.
export function FenetreFormulaire({
  titre,
  retour,
  idFormulaire,
  enregistrementEnCours = false,
  children,
}: {
  titre: string;
  retour: string;
  // Absent (formulaire non rendu, par exemple après une lecture impossible) : pas de bouton « Enregistrer » dans l'en-tête.
  idFormulaire?: string;
  enregistrementEnCours?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Admin.ui");
  const routeur = useRouter();
  // Sources dont la saisie n'est pas enregistrée ; sources qui envoient (un compte, jamais un seul booléen partagé).
  const modifiees = useRef(new Set<string>());
  const [confirmation, setConfirmation] = useState(false);
  const [enCoursEnfants, setEnCoursEnfants] = useState<ReadonlySet<string>>(() => new Set());
  const occupe = enregistrementEnCours || enCoursEnfants.size > 0;
  const enCours = useRef(occupe);
  const idTitre = useId();
  const racine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    enCours.current = occupe;
  }, [occupe]);

  // Fond plein écran : le cadre recouvert devient inerte et la page derrière ne défile plus.
  useEffect(() => {
    if (!racine.current) return;
    const liberer = rendreLeCadreInerte(racine.current);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      liberer();
      document.body.style.overflow = defilement;
    };
  }, []);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      // Une fenêtre modale est ouverte au-dessus (Aide, « Plus », confirmation) : Échap lui revient. Son propre écouteur, ajouté après celui-ci,
      // s'exécute plus tard : on ne peut pas compter sur defaultPrevented.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // Échap dans une liste déroulante native la referme ; pendant l'enregistrement, on ne quitte pas.
      if ((e.target as HTMLElement | null)?.closest?.("select") || enCours.current) return;
      e.preventDefault();
      if (modifiees.current.size > 0) setConfirmation(true);
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
    if (modifiees.current.size === 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setConfirmation(true);
  }

  // Une saisie marque sa source (l'ancêtre le plus proche qui porte l'attribut), sinon la source libre.
  const marquer = (e: { target: EventTarget }) => {
    const source = e.target instanceof Element ? e.target.closest(`[${ATTRIBUT_SOURCE}]`)?.getAttribute(ATTRIBUT_SOURCE) : null;
    modifiees.current.add(source ?? SOURCE_LIBRE);
  };

  const signalerEnregistrement = useCallback((source: string, b: boolean) => {
    setEnCoursEnfants((avant) => {
      if (avant.has(source) === b) return avant;
      const apres = new Set(avant);
      if (b) apres.add(source);
      else apres.delete(source);
      return apres;
    });
  }, []);
  const marquerEnregistre = useCallback((source: string) => {
    modifiees.current.delete(source);
  }, []);
  const marquerModifie = useCallback((source: string) => {
    modifiees.current.add(source);
  }, []);
  const contexte = useMemo(() => ({ signalerEnregistrement, marquerEnregistre, marquerModifie }), [signalerEnregistrement, marquerEnregistre, marquerModifie]);

  return (
    <div ref={racine} data-fenetre-formulaire="" className="fixed inset-0 z-40 flex items-stretch justify-center md:items-start md:p-6">
      <div aria-hidden="true" data-fond-fenetre="" className="absolute inset-0 bg-scrim backdrop-blur-sm" />
      <section
        aria-labelledby={idTitre}
        onInputCapture={marquer}
        onChangeCapture={marquer}
        className="relative flex max-h-full w-full max-w-[670px] flex-col bg-admin-fenetre text-text-primary shadow-lg md:rounded-[20px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <h1 id={idTitre} className="t-h3 max-w-[12ch] pt-1 uppercase">
            {titre}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {idFormulaire ? (
              <button
                type="submit"
                form={idFormulaire}
                aria-disabled={occupe || undefined}
                onClick={(e) => {
                  if (occupe) e.preventDefault();
                }}
                className="t-button inline-flex min-h-touch items-center justify-center rounded-full bg-primary px-5 py-3 text-on-primary"
              >
                {t("enregistrer")}
              </button>
            ) : null}
            <Link href={retour} onClick={surCroix} aria-label={t("fermer")} className="inline-flex size-11 items-center justify-center rounded-full text-text-primary no-underline">
              <X aria-hidden="true" className="size-6" />
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="mx-4 mt-4 shrink-0 border-b-[3px] border-text-primary md:mx-5" />
        {/* Contenu défilant à l'intérieur de la fenêtre : l'en-tête et « Enregistrer » restent visibles. */}
        <div data-defilement-fenetre="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5 md:px-5">
          {/* Point 5 (2026-11-21) : garde aussi dans la fenêtre, hydratée avec son formulaire (celle de la coque peut l'être avant). */}
          <Contexte.Provider value={contexte}>
            <GardeHydratation>{children}</GardeHydratation>
          </Contexte.Provider>
        </div>
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
