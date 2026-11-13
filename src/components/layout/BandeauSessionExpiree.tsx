"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { COOKIE_SESSION_EXPIREE } from "@/lib/auth/inactivite-cookies";
import { cheminRetourValide } from "@/lib/auth/retour";
import type { Locale } from "@/i18n/routing";
import { ID_CONTENU } from "./constantes";

function messagePresent(): boolean {
  return document.cookie.split("; ").some((c) => c === `${COOKIE_SESSION_EXPIREE}=1`);
}

// Bandeau discret des pages publiques après une déconnexion pour inactivité (story 9.14). La personne continue en visiteur ;
// le proxy a posé un cookie lisible ici. Lu après l'affichage : la coque des pages reste prérendue. Dans le flux, jamais par-dessus un élément.
export function BandeauSessionExpiree() {
  const t = useTranslations("SessionExpiree");
  const locale = useLocale() as Locale;
  const chemin = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Lecture d'un cookie du navigateur (système externe) à chaque changement de page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(messagePresent());
  }, [chemin]);

  // Sur la page de connexion, le message complet est déjà affiché.
  const affiche = visible && !/\/connexion(?:[/?#]|$)/.test(chemin);

  const retour = cheminRetourValide(chemin, locale);
  const requete = retour === `/${locale}` ? undefined : { retour };

  function fermer() {
    document.cookie = `${COOKIE_SESSION_EXPIREE}=; path=/; max-age=0`;
    setVisible(false);
    // Le bouton disparaît : le focus va au contenu principal (main tabIndex -1), jamais perdu sur body.
    document.getElementById(ID_CONTENU)?.focus();
  }

  // Région d'annonce toujours présente (vide sans message) : le texte y entre après l'affichage et est annoncé. Lien et bouton hors de la région.
  return (
    <div className={affiche ? "border-b border-border bg-surface" : undefined}>
      <div className={affiche ? "mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-marge py-3" : undefined}>
        <div role="status" className={affiche ? "flex-1" : undefined}>
          {affiche ? <p className="t-small">{t("message")}</p> : null}
        </div>
        {affiche ? (
          <>
            <Link href={{ pathname: "/connexion", query: requete }} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
              {t("reconnecter")}
            </Link>
            <button
              type="button"
              onClick={fermer}
              aria-label={t("fermer")}
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface text-text-primary"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
