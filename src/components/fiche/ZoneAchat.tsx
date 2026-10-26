"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { capaciteAtteinte, taillesChoisissables } from "@/modules/catalogue/fiche";
import type { Taille, TailleFiche } from "@/modules/catalogue/types";
import { ModesRemise } from "./ModesRemise";
import { SelecteurTaille } from "./SelecteurTaille";

type Props = {
  locale: "fr" | "en";
  tailles: readonly TailleFiche[];
  forfaitGoma: number | null;
  forfaitBukavu: number | null;
  retraitGoma: string | null;
};

// Zone d'achat : tailles (état et délai sur place) et modes de remise dont le délai suit la taille choisie.
// Pas de bouton d'ajout au panier ici (epic 4), pas de Kit lié (epic 3).
export function ZoneAchat({ locale, tailles, forfaitGoma, forfaitBukavu, retraitGoma }: Props) {
  const t = useTranslations("Fiche.tailles");
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
      <ModesRemise locale={locale} forfaitGoma={forfaitGoma} forfaitBukavu={forfaitBukavu} retraitGoma={retraitGoma} fabrication={fabrication} />
    </div>
  );
}
