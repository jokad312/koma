"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { marquerStockVerifieAction } from "@/modules/commande/admin-actions";
import type { ErreurAdminCommande } from "@/modules/commande/admin-service";

// Ferme la tâche « Vérifier le stock » (Commande annulée dont la quantité retirée du stock était inconnue) une fois le stock vérifié à la main.
// Le succès n'est affiché qu'après la réponse réelle de la base.
export function BoutonStockVerifie({ commandeId }: { commandeId: string }) {
  const t = useTranslations("Admin.commandes.stock");
  const router = useRouter();
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [enCours, lancer] = useTransition();
  function confirmer() {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await marquerStockVerifieAction({ commandeId });
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
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur === "non_autorise" || erreur === "stock_deja_verifie" ? erreur : "generique"}`)}</MessageEtat> : null}
    </div>
  );
}
