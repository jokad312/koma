"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { capaciteAtteinte, taillesChoisissables } from "@/modules/catalogue/fiche";
import type { KitLieFiche, Taille, TailleFiche } from "@/modules/catalogue/types";
import { ModesRemise } from "./ModesRemise";
import { BoutonAjouterPanier } from "./BoutonAjouterPanier";
import { SelecteurTaille } from "./SelecteurTaille";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";

type Props = {
  produitId: string;
  locale: "fr" | "en";
  tailles: readonly TailleFiche[];
  forfaitGoma: number | null;
  forfaitBukavu: number | null;
  retraitGoma: string | null;
  // Kit lié publié (double option, story 3.4) : proposé quand le Plafond de fabrication est atteint (FR-10).
  kit?: KitLieFiche | null;
};

// Zone d'achat : tailles (état et délai sur place) et modes de remise dont le délai suit la taille choisie.
// « Ajouter au panier » (story 4.1) ; sur mesure : les mesures s'envoient sur WhatsApp après la commande (aucune mesure saisie ici).
// Avec un Kit lié publié et le Plafond atteint, elle accompagne le message « Commandes complètes pour le moment » par la proposition du Kit (FR-10).
export function ZoneAchat({ produitId, locale, tailles, forfaitGoma, forfaitBukavu, retraitGoma, kit }: Props) {
  const t = useTranslations("Fiche.tailles");
  const tp = useTranslations("Fiche.panier");
  const tOption = useTranslations("Fiche");
  const [choisie, setChoisie] = useState<Taille | null>(null);
  const choix = taillesChoisissables(tailles);
  const complet = capaciteAtteinte(tailles);
  const courante = choix.find((x) => x.taille === choisie) ?? null;
  const toutSurCommande = choix.length > 0 && choix.every((x) => x.etat === "sur_commande");
  const fabrication = courante ? (courante.etat === "sur_commande" ? { jours: courante.delaiJours } : null) : toutSurCommande ? ("choisir" as const) : null;

  return (
    <div className="flex flex-col gap-6">
      {complet ? (
        <div className="flex flex-col gap-3">
          <MessageEtat type="attention">{t("complet")}</MessageEtat>
          {kit ? (
            <section aria-labelledby="zone-kit-titre" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <h2 id="zone-kit-titre" className="t-h2">
                {tOption("option.kitTitre")}
              </h2>
              <p className="t-price-card text-text-primary">{formaterUsd(kit.prixCents, locale)}</p>
              <p className="t-small text-text-secondary">{tOption("option.acces")}</p>
              <Link href={cheminPublic(locale, `/kits/${kit.slug}`)} className="t-button text-text-primary underline">
                {tOption("option.voirLeKit")}
              </Link>
            </section>
          ) : null}
        </div>
      ) : null}
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
