"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { avancerReclamationAction } from "@/modules/commande/admin-actions";
import type { ErreurAdminCommande } from "@/modules/commande/admin-service";

// Étapes d'une réclamation : seules celles qui suivent l'état courant sont proposées. Un remplacement pris en stock décompte le stock (case à cocher).
export function EtapesReclamation({ demandeId, statut, nombre }: { demandeId: string; statut: string; nombre: number }) {
  const t = useTranslations("Admin.commandes.reclamation");
  const id = useId();
  const router = useRouter();
  const [depuisStock, setDepuisStock] = useState(false);
  const [quantite, setQuantite] = useState(String(nombre));
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [enCours, lancer] = useTransition();
  function avancer(etape: "accepter" | "refuser" | "article_rendu" | "remplacement_remis") {
    setErreur(null);
    lancer(async () => {
      try {
        // Quantité remplacée : ligne entière par défaut ; entier de 1 à la quantité de la ligne (revérifié en base).
        const n = Number(quantite);
        if (etape === "remplacement_remis" && (!Number.isInteger(n) || n < 1 || n > nombre)) {
          setErreur("quantite_invalide");
          return;
        }
        const r = await avancerReclamationAction({ demandeId, etape, depuisStock, ...(etape === "remplacement_remis" ? { quantite: n } : {}) });
        if (r.ok) router.refresh();
        else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }
  if (statut === "refusee" || statut === "remplacement_remis") return null;
  return (
    <div className="flex flex-col gap-2">
      {statut === "article_rendu" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-quantite`} className="t-small text-text-primary">
            {t("quantite", { max: nombre })}
          </label>
          <input
            id={`${id}-quantite`}
            type="number"
            inputMode="numeric"
            min={1}
            max={nombre}
            step={1}
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            {...(erreur === "quantite_invalide" ? { "aria-invalid": true } : {})}
            className="min-h-touch w-28 rounded-md border border-border-field bg-surface px-3"
          />
        </div>
      ) : null}
      {statut === "article_rendu" ? (
        <label htmlFor={`${id}-stock`} className="flex min-h-touch items-center gap-2 t-body text-text-primary">
          <input id={`${id}-stock`} type="checkbox" checked={depuisStock} onChange={(e) => setDepuisStock(e.target.checked)} />
          {t("depuisStock")}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {statut === "ouverte" ? (
          <>
            <Bouton enCours={enCours} onClick={() => avancer("accepter")}>
              {t("accepter")}
            </Bouton>
            <Bouton variante="secondaire" enCours={enCours} onClick={() => avancer("refuser")}>
              {t("refuser")}
            </Bouton>
          </>
        ) : null}
        {statut === "acceptee" ? (
          <Bouton enCours={enCours} onClick={() => avancer("article_rendu")}>
            {t("articleRendu")}
          </Bouton>
        ) : null}
        {statut === "article_rendu" ? (
          <Bouton enCours={enCours} onClick={() => avancer("remplacement_remis")}>
            {t("remplacementRemis")}
          </Bouton>
        ) : null}
      </div>
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${["non_autorise", "demande_deja_traitee", "stock_insuffisant", "stock_invalide", "etape_invalide", "type_non_pris_en_charge", "quantite_invalide", "demande_introuvable"].includes(erreur) ? erreur : "generique"}`)}</MessageEtat> : null}
    </div>
  );
}
