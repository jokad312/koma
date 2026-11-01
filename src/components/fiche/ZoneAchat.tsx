"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { capaciteAtteinte, taillesChoisissables } from "@/modules/catalogue/fiche";
import type { Taille, TailleFiche } from "@/modules/catalogue/types";
import { ModesRemise } from "./ModesRemise";
import { BoutonAjouterPanier } from "./BoutonAjouterPanier";
import { SelecteurTaille } from "./SelecteurTaille";

type Props = {
  produitId: string;
  locale: "fr" | "en";
  tailles: readonly TailleFiche[];
  forfaitGoma: number | null;
  forfaitBukavu: number | null;
  retraitGoma: string | null;
};

// Zone d'achat : tailles (état et délai sur place) et modes de remise dont le délai suit la taille choisie.
// « Ajouter au panier » (story 4.1) ; sur mesure : les mesures s'envoient sur WhatsApp après la commande (aucune mesure saisie ici). Pas de Kit lié (story 3.4).
export function ZoneAchat({ produitId, locale, tailles, forfaitGoma, forfaitBukavu, retraitGoma }: Props) {
  const t = useTranslations("Fiche.tailles");
  const tp = useTranslations("Fiche.panier");
  const [choisie, setChoisie] = useState<Taille | null>(null);
  const choix = taillesChoisissables(tailles);
  const complet = capaciteAtteinte(tailles);
  const courante = choix.find((x) => x.taille === choisie) ?? null;
  const toutSurCommande = choix.length > 0 && choix.every((x) => x.etat === "sur_commande");
  const fabrication = courante ? (courante.etat === "sur_commande" ? { jours: courante.delaiJours } : null) : toutSurCommande ? ("choisir" as const) : null;

  return (
    <div className="flex flex-col gap-6">
      {complet ? <MessageEtat type="attention">{t("complet")}</MessageEtat> : null}
      {choix.length > 0 ? (
        <SelecteurTaille tailles={choix} choisie={choisie} onChoisir={setChoisie} />
      ) : complet ? null : (
        <MessageEtat type="information">{t("epuise")}</MessageEtat>
      )}
      {choix.length > 0 ? (
        <div className="flex flex-col items-start gap-3">
          {choisie === "sur_mesure" ? <MessageEtat type="information">{tp("surMesure")}</MessageEtat> : null}
          <BoutonAjouterPanier produitId={produitId} taille={choisie} />
        </div>
      ) : null}
      <ModesRemise locale={locale} forfaitGoma={forfaitGoma} forfaitBukavu={forfaitBukavu} retraitGoma={retraitGoma} fabrication={fabrication} />
    </div>
  );
}
