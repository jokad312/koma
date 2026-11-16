"use client";

import { CircleHelp, ExternalLink, Settings, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { BoutonDeconnexion } from "@/components/layout/BoutonDeconnexion";
import { Dialogue } from "@/components/ui/Dialogue";

export type ProfilMenu = { affichage: string; initiales: string; role: string };

// Toutes les entrées sont de vrais liens (rechargement complet), comme « Voir le site » : la mise en page de l'admin masque l'en-tête du site tant que la
// coque admin est dans la page, et Next.js garde la page admin cachée en mémoire après une navigation interne.
// « Mon profil » porte ?vue=site : sans lui, le proxy renvoie l'admin et l'assistant de /[l]/compte vers l'admin (story 9.12).
function adresses(locale: string) {
  return { profil: `/${locale}/compte?vue=site`, parametres: `/${locale}/compte/preferences`, site: `/${locale}?vue=site` };
}

const ENTREE =
  "t-label flex min-h-touch w-full items-center gap-3 rounded-[10px] px-3 text-left text-text-primary no-underline hover:bg-admin-actif";

// Menu du profil (story 9.16 b, décision Q8) : bouton rond rouge aux initiales dans la barre du haut ; il ouvre un menu déroulant (motif « disclosure ») de cinq
// entrées : Mon profil, Paramètres du profil, Aide, Voir le site, Se déconnecter. Clavier : Entrée ou Espace ouvre et place le focus sur la première entrée,
// flèches haut et bas, Début et Fin pour circuler ; Échap ferme et rend le focus au bouton ; un clic à l'extérieur ou un Tab qui sort du menu le ferme.
// « Aide » ouvre une petite fenêtre (texte de l'ancien encart et lien WhatsApp des réglages, seulement si un numéro est réglé : jamais de lien inventé).
// Sans Compte lisible (profil null), le bouton montre une icône, sans nom ni initiales inventés.
export function MenuProfil({ profil, lienAide }: { profil: ProfilMenu | null; lienAide: string | null }) {
  const t = useTranslations("Admin.nav");
  const locale = useLocale();
  const [ouvert, setOuvert] = useState(false);
  const [aide, setAide] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const idMenu = useId();
  const lien = adresses(locale);

  function entrees() {
    return [...(liste.current?.querySelectorAll<HTMLElement>("[data-entree-profil]") ?? [])];
  }

  function fermer(rendreFocus: boolean) {
    setOuvert(false);
    if (rendreFocus) bouton.current?.focus();
  }

  // À l'ouverture, le focus va sur la première entrée.
  useEffect(() => {
    if (ouvert) entrees()[0]?.focus();
  }, [ouvert]);

  // Clic ou toucher à l'extérieur : le menu se ferme, le focus reste là où la personne a cliqué.
  useEffect(() => {
    if (!ouvert) return;
    function surPointeur(e: PointerEvent) {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("pointerdown", surPointeur);
    return () => document.removeEventListener("pointerdown", surPointeur);
  }, [ouvert]);

  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    if (!ouvert) return;
    if (e.key === "Escape") {
      e.preventDefault();
      fermer(true);
      return;
    }
    const liste = entrees();
    const position = liste.indexOf(document.activeElement as HTMLElement);
    let cible: number | null = null;
    if (e.key === "ArrowDown") cible = position < 0 ? 0 : (position + 1) % liste.length;
    else if (e.key === "ArrowUp") cible = position <= 0 ? liste.length - 1 : position - 1;
    else if (e.key === "Home") cible = 0;
    else if (e.key === "End") cible = liste.length - 1;
    if (cible !== null && liste.length > 0) {
      e.preventDefault();
      liste[cible].focus();
    }
  }

  const nomBouton = profil ? t("profil.bouton", { initiales: profil.initiales, nom: profil.affichage, role: profil.role }) : t("profil.boutonSansCompte");

  return (
    <div
      ref={racine}
      className="relative"
      onKeyDown={surTouche}
      onBlur={(e) => {
        // Le focus quitte le menu (Tab après la dernière entrée, ou avant le bouton) : le menu se ferme.
        if (ouvert && e.relatedTarget && racine.current && !racine.current.contains(e.relatedTarget as Node)) setOuvert(false);
      }}
    >
      <button
        ref={bouton}
        type="button"
        aria-label={nomBouton}
        aria-expanded={ouvert}
        aria-controls={idMenu}
        onClick={() => setOuvert((o) => !o)}
        className="t-label inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-transparent bg-primary tracking-normal text-on-primary"
      >
        {profil ? <span aria-hidden="true">{profil.initiales}</span> : <UserRound aria-hidden="true" className="size-6" />}
      </button>

      <div
        id={idMenu}
        hidden={!ouvert}
        className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[14px] border border-admin-bord bg-admin-fenetre p-2 text-text-primary shadow-lg"
      >
        {profil ? (
          <div className="border-b border-admin-bord px-3 pb-2 pt-1">
            <p className="t-body truncate">{profil.affichage}</p>
            <p className="t-small text-text-secondary">{profil.role}</p>
          </div>
        ) : null}
        <ul ref={liste} role="list" className="flex flex-col pt-1">
          <li>
            <a href={lien.profil} data-entree-profil="" className={ENTREE}>
              <UserRound aria-hidden="true" className="size-5 shrink-0" />
              {t("profil.monProfil")}
            </a>
          </li>
          <li>
            <a href={lien.parametres} data-entree-profil="" className={ENTREE}>
              <Settings aria-hidden="true" className="size-5 shrink-0" />
              {t("profil.parametres")}
            </a>
          </li>
          <li>
            <button
              type="button"
              data-entree-profil=""
              aria-haspopup="dialog"
              onClick={() => {
                setOuvert(false);
                setAide(true);
              }}
              className={ENTREE}
            >
              <CircleHelp aria-hidden="true" className="size-5 shrink-0" />
              {t("profil.aide")}
            </button>
          </li>
          <li>
            <a href={lien.site} data-entree-profil="" className={ENTREE}>
              <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
              {t("profil.voirSite")}
            </a>
          </li>
          <li className="mt-1 border-t border-admin-bord pt-1">
            <BoutonDeconnexion variante="menu" />
          </li>
        </ul>
      </div>

      <Dialogue ouvert={aide} onFermer={() => setAide(false)} titre={t("aide.titre")} retourFocus={bouton} entete="fenetre">
        <p className="t-body">{t("aide.texte")}</p>
        {lienAide ? (
          <a href={lienAide} target="_blank" rel="noopener noreferrer" className="t-body mt-4 inline-flex min-h-touch items-center text-text-primary underline underline-offset-4">
            {t("profil.whatsapp")}
          </a>
        ) : null}
      </Dialogue>
    </div>
  );
}
