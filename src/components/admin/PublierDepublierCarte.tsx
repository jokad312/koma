"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { useRouter } from "@/i18n/navigation";
import { depublierProduit, publierProduit } from "@/modules/catalogue/actions";
import type { ManquePublication } from "@/modules/catalogue/types";

type Retour = { type: "erreur"; erreur: string; manques?: ManquePublication[] };

const ERREURS_CONNUES = ["publication_incomplete", "produit_publie_verrouille", "produit_introuvable", "non_autorise"];

// Bouton Publier / Dépublier d'une carte de produit (story 9.10) : mêmes actions que le panneau de la fiche (publierProduit, depublierProduit), qui revérifient le droit
// et la complétude. Le statut affiché vient de la base (router.refresh), jamais d'une supposition locale ; un refus liste ce qui manque.
export function PublierDepublierCarte({ produitId, publie, titre }: { produitId: string; publie: boolean; titre: string }) {
  const t = useTranslations("Admin.produits.publication");
  const router = useRouter();
  const [retour, setRetour] = useState<Retour | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);

  function changer() {
    if (enVol.current) return;
    enVol.current = true;
    setRetour(null);
    demarrer(async () => {
      try {
        const etat = publie ? await depublierProduit({ id: produitId }) : await publierProduit({ id: produitId });
        if (etat.statut === "succes") router.refresh();
        else setRetour({ type: "erreur", erreur: etat.erreur, manques: etat.manques });
      } catch {
        setRetour({ type: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  const liste = retour?.erreur === "publication_incomplete" && retour.manques && retour.manques.length > 0 ? retour.manques : null;
  return (
    <>
      <Bouton variante={publie ? "secondaire" : "principal"} onClick={changer} enCours={enCours} aria-label={t("actionSur", { action: t(publie ? "depublier" : "publier"), titre })}>
        {enCours ? t("enCours") : t(publie ? "depublier" : "publier")}
      </Bouton>
      {retour ? (
        <div role="alert" className="t-small w-full text-text-primary">
          {liste ? (
            <>
              <p>{t("incomplet")}</p>
              <ul className="list-disc pl-5">
                {liste.map((m) => (
                  <li key={m}>{t(`manques.${m}`)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t(`erreurs.${ERREURS_CONNUES.includes(retour.erreur) ? retour.erreur : "generique"}`)}</p>
          )}
        </div>
      ) : null}
    </>
  );
}
