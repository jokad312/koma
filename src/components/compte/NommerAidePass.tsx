"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { nommerAideAction } from "@/modules/evenements/candidature-actions";
import { nomValable } from "@/modules/evenements/candidature-nom";
import type { ErreurNommerAide } from "@/modules/evenements/candidature-types";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

// « Nom de l'aide à saisir » (story 7.11) : le Pass de l'aide d'un Stand porte un nom provisoire ; l'exposant le remplace une seule fois, jusqu'au début de
// l'Événement. La base revérifie la propriété du Pass, le nom, la date et le fait qu'il reste à saisir. Le nom n'est annoncé qu'après sa réponse réelle.
export function NommerAidePass({ passId }: { passId: string }) {
  const t = useTranslations("Pass.carte.aide");
  const router = useRouter();
  const id = useId();
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<ErreurNommerAide | null>(null);
  const [enCours, lancer] = useTransition();

  function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!nomValable(nom)) {
      setErreur("nom_invalide");
      return;
    }
    setErreur(null);
    lancer(async () => {
      try {
        const r = await nommerAideAction({ passId, nom });
        if (r.ok) {
          router.refresh();
          return;
        }
        setErreur(r.erreur);
        if (r.erreur === "deja_saisi" || r.erreur === "evenement_commence") router.refresh();
      } catch {
        setErreur("generique");
      }
    });
  }

  return (
    <form onSubmit={envoyer} noValidate className="flex flex-col gap-2 rounded-md border border-border-field p-3">
      <label htmlFor={`${id}-nom`} className="t-label text-text-primary">
        {t("titre")}
      </label>
      <p id={`${id}-aide`} className="t-small text-text-secondary">
        {t("aide")}
      </p>
      <input
        id={`${id}-nom`}
        type="text"
        autoComplete="off"
        maxLength={200}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        aria-describedby={`${id}-aide`}
        aria-invalid={erreur === "nom_invalide" ? true : undefined}
        className={CHAMP}
      />
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur}`)}</MessageEtat> : null}
      <div>
        <Bouton type="submit" enCours={enCours}>
          {t("enregistrer")}
        </Bouton>
      </div>
    </form>
  );
}
