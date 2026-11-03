"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { confirmerMesuresRecuesAction } from "@/modules/commande/admin-actions";
import type { ErreurAdminCommande } from "@/modules/commande/admin-service";

// « Mesures reçues » : la date est posée par la base après la réponse réelle ; aucune mesure n'est saisie (story 6.5, AD-32).
export function BoutonMesuresRecues({ ligneId }: { ligneId: string }) {
  const t = useTranslations("Admin.commandes.mesures");
  const router = useRouter();
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [enCours, lancer] = useTransition();
  function confirmer() {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await confirmerMesuresRecuesAction({ ligneId });
        if (r.ok) router.refresh();
        else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Bouton variante="secondaire" enCours={enCours} onClick={confirmer}>
          {t("bouton")}
        </Bouton>
      </div>
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur === "non_autorise" || erreur === "mesures_deja_recues" ? erreur : "generique"}`)}</MessageEtat> : null}
    </div>
  );
}
