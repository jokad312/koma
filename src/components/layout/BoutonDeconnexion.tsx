"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { deconnecter, type EtatDeconnexion } from "@/modules/comptes/actions";
import { useFermerMenu } from "./MenuPanneau";

const ETAT_INITIAL: EtatDeconnexion = { erreur: false };

// Ferme la session côté serveur puis revient à l'accueil de la langue.
export function BoutonDeconnexion() {
  const t = useTranslations("Compte");
  const langue = useLocale();
  const [etat, action, enCours] = useActionState(deconnecter, ETAT_INITIAL);
  const fermerMenu = useFermerMenu();

  // Déconnexion réussie (la redirection est faite) : le menu se ferme, même si l'adresse ne change pas. En cas d'échec, il reste ouvert avec le message.
  const etaitEnCours = useRef(false);
  useEffect(() => {
    if (etaitEnCours.current && !enCours && !etat.erreur) fermerMenu();
    etaitEnCours.current = enCours;
  }, [enCours, etat.erreur, fermerMenu]);
  // Après la déconnexion, la page se met à jour et ce bouton est remplacé par « Se connecter » : démonté en pleine action, il ferme aussi le menu.
  useEffect(() => () => {
    if (etaitEnCours.current) fermerMenu();
  }, [fermerMenu]);

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="langue" value={langue} />
      <button
        type="submit"
        aria-disabled={enCours || undefined}
        onClick={(e) => {
          if (enCours) e.preventDefault();
        }}
        className="t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary"
      >
        {enCours ? t("deconnexionEnCours") : t("seDeconnecter")}
      </button>
      {etat.erreur ? (
        <p role="alert" className="t-small text-danger">
          {t("erreurDeconnexion")}
        </p>
      ) : null}
    </form>
  );
}
