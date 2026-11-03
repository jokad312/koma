"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { corrigerAdresseCommandeAction } from "@/modules/commande/admin-actions";
import type { ErreurAdminCommande } from "@/modules/commande/admin-service";

// Correction de l'adresse de livraison : le message de succès n'apparaît qu'après la réponse réelle de la base (règle 13).
export function FormulaireAdresseCommande({ numero, adresse }: { numero: string; adresse: string }) {
  const t = useTranslations("Admin.commandes.adresse");
  const id = useId();
  const router = useRouter();
  const [valeur, setValeur] = useState(adresse);
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [fait, setFait] = useState(false);
  const [enCours, lancer] = useTransition();

  function enregistrer() {
    setErreur(null);
    setFait(false);
    lancer(async () => {
      try {
        const r = await corrigerAdresseCommandeAction({ numero, adresse: valeur });
        if (r.ok) {
          setFait(true);
          router.refresh();
        } else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enregistrer();
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor={`${id}-adresse`} className="t-small text-text-primary">
        {t("libelle")}
      </label>
      <textarea
        id={`${id}-adresse`}
        value={valeur}
        maxLength={500}
        rows={3}
        onChange={(e) => setValeur(e.target.value)}
        {...(erreur ? { "aria-invalid": true, "aria-describedby": `${id}-erreur` } : {})}
        className="rounded-md border border-border-field bg-surface px-3 py-2"
      />
      {erreur ? (
        <p id={`${id}-erreur`} role="alert" className="t-small text-danger">
          {t(`erreurs.${erreur === "entree_invalide" || erreur === "non_autorise" || erreur === "commande_introuvable" || erreur === "pas_de_livraison" ? erreur : "generique"}`)}
        </p>
      ) : null}
      {fait ? <MessageEtat type="succes">{t("enregistree")}</MessageEtat> : null}
      <div>
        {valeur.trim() === "" ? (
          <Bouton desactive raison={t("vide")}>
            {t("enregistrer")}
          </Bouton>
        ) : (
          <Bouton type="submit" enCours={enCours}>
            {t("enregistrer")}
          </Bouton>
        )}
      </div>
    </form>
  );
}
