"use client";

import { FileText, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { PHOTO_TAILLE_MAX, type PhotoAdmin } from "@/modules/catalogue/types";
import { useClassesChamp } from "./ChampTexte";
import { EnvoiFichierKit } from "./EnvoiFichierKit";
import { EnvoiPhoto } from "./EnvoiPhoto";
import { PublicationProduit, StatutCreation } from "./PublicationProduit";

// titre : dans la langue de la page (repli sur le français), pour la confirmation d'archivage.
export type ProduitEnTete = { id: string; titre: string; publie: boolean; archive: boolean; photo: PhotoAdmin | null };

// Zones de la maquette placées entre les champs du haut et le reste du formulaire (story 9.16 f, D12 à D14) : zone de fichiers du Kit (famille Kit
// seulement), image, menu STATUT. Avant le premier enregistrement (produit absent), le produit n'existe pas encore : fichiers et photos ne peuvent pas
// être envoyés (stockage inchangé) et le statut est Brouillon ; un texte le dit, comme avant la refonte.
export function ZonesEnTete({ produit, kit }: { produit: ProduitEnTete | null; kit: boolean }) {
  const t = useTranslations("Admin.produits.zones");
  const classes = useClassesChamp();
  const base = useId();

  return (
    <div className="flex w-full flex-col gap-6">
      {kit ? (
        <section aria-labelledby={`${base}-fichiers`} className="flex flex-col gap-3">
          <h2 id={`${base}-fichiers`} className={classes.etiquette}>
            {t("fichiers")}
          </h2>
          {produit ? (
            <EnvoiFichierKit produitId={produit.id} />
          ) : (
            <div className="flex min-h-[105px] items-center gap-3 rounded-2xl border-2 border-dashed border-border-field bg-admin-champ px-4 py-4">
              <FileText aria-hidden="true" className="size-8 shrink-0" strokeWidth={1.5} />
              <p className="t-body text-text-primary">{t("fichiersApres")}</p>
            </div>
          )}
        </section>
      ) : null}

      <section aria-labelledby={`${base}-image`} className="flex flex-col gap-3">
        <h2 id={`${base}-image`} className={classes.etiquette}>
          {t("image")}
        </h2>
        {produit ? (
          <EnvoiPhoto produitId={produit.id} vignette={produit.photo} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-admin-champ text-text-secondary">
              <ImageIcon aria-hidden="true" className="size-10" strokeWidth={1.5} />
            </div>
            <p className="t-body min-w-0 flex-1 text-text-primary">{t("photosApres", { max: PHOTO_TAILLE_MAX / (1024 * 1024) })}</p>
          </div>
        )}
      </section>

      {produit ? <PublicationProduit produitId={produit.id} publie={produit.publie} archive={produit.archive} titre={produit.titre} /> : <StatutCreation />}
    </div>
  );
}
