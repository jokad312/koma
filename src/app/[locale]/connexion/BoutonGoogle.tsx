"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { connecterAvecGoogle } from "@/modules/comptes/actions";

// Bouton « Continuer avec Google » selon les règles de marque de Google : « G » officiel non modifié (public/google/google-g.svg,
// voir docs/licences/google-connexion.md), fond blanc, trait #747775, texte #1F1F1F. Les couleurs de Google sont fixes dans les deux thèmes.
export function BoutonGoogle({ retour }: { retour?: string }) {
  const t = useTranslations("Connexion");
  const langue = useLocale();
  const [etat, action, enCours] = useActionState(connecterAvecGoogle, null);

  return (
    <form action={action} className="flex w-full flex-col items-start gap-3">
      <input type="hidden" name="langue" value={langue} />
      {retour ? <input type="hidden" name="retour" value={retour} /> : null}
      {etat ? <MessageEtat type="erreur">{t(`erreurs.${etat.erreur}`)}</MessageEtat> : null}
      <button
        type="submit"
        aria-disabled={enCours || undefined}
        onClick={(e) => {
          if (enCours) e.preventDefault();
        }}
        className="t-button inline-flex min-h-touch items-center gap-3 rounded-full border border-[#747775] bg-[#FFFFFF] py-0 pr-5 pl-0 text-[#1F1F1F]"
      >
        <Image src="/google/google-g.svg" alt="" width={44} height={44} unoptimized className="size-11 shrink-0" />
        {enCours ? t("google.enCours") : t("google.continuer")}
      </button>
    </form>
  );
}
