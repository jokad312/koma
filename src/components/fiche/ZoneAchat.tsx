"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { capaciteAtteinte, couleursDistinctes, taillesChoisissables, taillesPourCouleur } from "@/modules/catalogue/fiche";
import type { KitLieFiche, Taille, TailleFiche } from "@/modules/catalogue/types";
import { ModesRemise } from "./ModesRemise";
import { BoutonAjouterPanier } from "./BoutonAjouterPanier";
import { SelecteurCouleur } from "./SelecteurCouleur";
import { SelecteurTaille, StatutTaille } from "./SelecteurTaille";
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

const ACHETABLE = new Set(["disponible", "dernieres_pieces", "sur_commande"]);

// Zone d'achat : tailles (état et délai sur place) et modes de remise dont le délai suit la variante choisie.
// « Ajouter au panier » (story 4.1) ; sur mesure : les mesures s'envoient sur WhatsApp après la commande (aucune mesure saisie ici).
// Vêtement (story 9.15) : sélecteur de couleur à partir de deux couleurs, nom écrit en texte pour une seule ; l'état et le délai sont ceux
// du couple (taille, couleur). Autre article : sa variante « Taille unique », sans sélecteur.
// Avec un Kit lié publié et le Plafond atteint, elle accompagne le message « Commandes complètes pour le moment » par la proposition du Kit (FR-10).
export function ZoneAchat({ produitId, locale, tailles, forfaitGoma, forfaitBukavu, retraitGoma, kit }: Props) {
  const t = useTranslations("Fiche.tailles");
  const tp = useTranslations("Fiche.panier");
  const tc = useTranslations("Fiche.couleurs");
  const tOption = useTranslations("Fiche");
  const couleurs = couleursDistinctes(tailles);
  const avecSelecteurCouleur = couleurs.length >= 2;
  const unique = tailles.length > 0 && tailles.every((x) => x.taille === "unique");
  const [choisie, setChoisie] = useState<Taille | null>(null);
  const [couleurChoisie, setCouleurChoisie] = useState<string | null>(null);
  // Une seule couleur : elle est choisie d'office (son nom est écrit) ; aucune couleur : null.
  const couleur = avecSelecteurCouleur ? couleurChoisie : (couleurs[0]?.cle ?? null);
  // Au moins une variante s'achète : la zone d'achat s'affiche (sélecteurs et bouton).
  const achetable = taillesChoisissables(tailles).length > 0;
  const choix = avecSelecteurCouleur ? taillesPourCouleur(tailles, couleurChoisie) : taillesChoisissables(tailles);
  const complet = capaciteAtteinte(tailles);
  // Couleur choisie dont une variante est fabriquée sur commande mais à capacité atteinte : « Commandes complètes », pas « Plus en stock ».
  const couleurPleine = capaciteAtteinte(tailles.filter((x) => x.couleur?.cle === couleurChoisie));
  // Une taille choisie qui n'existe pas dans la couleur choisie ne compte plus : la taille est à rechoisir.
  const tailleEffective = unique ? "unique" : choix.some((x) => x.taille === choisie) ? choisie : null;
  const courante = choix.find((x) => x.taille === tailleEffective) ?? null;
  const toutSurCommande = choix.length > 0 && choix.every((x) => x.etat === "sur_commande");
  const fabrication = courante ? (courante.etat === "sur_commande" ? { jours: courante.delaiJours } : null) : toutSurCommande ? ("choisir" as const) : null;
  // Raison affichée à côté du bouton tant que l'ajout n'est pas possible (jamais un bouton désactivé sans explication).
  const raison =
    tailleEffective === null && avecSelecteurCouleur && couleurChoisie === null
      ? tp("choisirTailleCouleur")
      : tailleEffective === null
        ? tp("choisirTaille")
        : avecSelecteurCouleur && couleurChoisie === null
          ? tp("choisirCouleur")
          : courante && !ACHETABLE.has(courante.etat)
            ? tp("combinaisonIndisponible")
            : null;

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
      {achetable && couleurs.length === 1 ? <p className="t-small font-semibold text-text-primary">{tc("une", { couleur: couleurs[0].nom })}</p> : null}
      {achetable && avecSelecteurCouleur ? <SelecteurCouleur couleurs={couleurs} choisie={couleurChoisie} onChoisir={setCouleurChoisie} /> : null}
      {achetable ? (
        unique ? (
          <div role="status" className="t-small flex flex-col gap-1 text-text-primary">
            <StatutTaille courante={courante} />
          </div>
        ) : choix.length > 0 ? (
          <SelecteurTaille tailles={choix} choisie={tailleEffective} onChoisir={setChoisie} />
        ) : (
          // Couleur choisie sans aucune taille achetable : capacité atteinte dans cette couleur, sinon stock à zéro.
          <MessageEtat type="information">{t(couleurPleine ? "complet" : "epuise")}</MessageEtat>
        )
      ) : complet ? null : (
        // Aucune variante achetable et aucune capacité atteinte : tout est en stock à zéro. « Plus en stock pour le moment »,
        // jamais « Épuisé » (EXPERIENCE.md, C-4).
        <MessageEtat type="information">{t("epuise")}</MessageEtat>
      )}
      {achetable ? (
        <div className="flex flex-col items-start gap-3">
          {tailleEffective === "sur_mesure" ? <MessageEtat type="information">{tp("surMesure")}</MessageEtat> : null}
          <BoutonAjouterPanier produitId={produitId} taille={tailleEffective} couleur={couleur} raison={raison} />
        </div>
      ) : null}
      <ModesRemise locale={locale} forfaitGoma={forfaitGoma} forfaitBukavu={forfaitBukavu} retraitGoma={retraitGoma} fabrication={fabrication} />
    </div>
  );
}
