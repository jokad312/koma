"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { changerEtatPrestataireAction, deplacerPrestataireAction } from "@/modules/paiement/actions";
import type { ErreurPrestataire, ResultatPrestataire } from "@/modules/paiement/service";
import type { CoupleCouverture } from "@/modules/paiement/couverture";
import type { Prestataire } from "@/modules/paiement/types";
import { CouvertureAgregateur } from "./CouvertureAgregateur";

export type PrestataireAdmin = Prestataire & { adaptateurBranche: boolean; couples: CoupleCouverture[] };

// Liste des Prestataires (FR-21). L'état « Actif » ou « Désactivé » affiché est celui de la base : la liste est relue après chaque
// réponse réelle du serveur (règle 13). La règle de la carte est affichée verrouillée : elle ne se règle pas ici (règle 10).
export function ListePrestataires({ prestataires }: { prestataires: PrestataireAdmin[] }) {
  const t = useTranslations("Admin.prestataires");
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<ErreurPrestataire | null>(null);
  const agregateurs = prestataires.filter((p) => p.type === "agregateur");

  function lancer(operation: () => Promise<ResultatPrestataire>) {
    setErreur(null);
    demarrer(async () => {
      try {
        const resultat = await operation();
        if (!resultat.ok) setErreur(resultat.erreur);
      } catch {
        setErreur("generique");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur}`)}</MessageEtat> : null}
      <ul className="flex flex-col gap-3">
        {prestataires.map((p) => {
          const rang = agregateurs.findIndex((a) => a.code === p.code);
          const moyens = [...(p.mobileMoney ? [t("moyen.mobile_money")] : []), ...(p.carte ? [t("moyen.carte")] : [])].join(", ");
          const activationImpossible = !p.actif && !p.adaptateurBranche;
          return (
            <li key={p.code} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="t-h2">{p.nom}</h2>
                <p role="status" className="t-label text-text-primary" data-etat={p.actif ? "actif" : "desactive"}>
                  {p.actif ? t("etat.actif") : t("etat.desactive")}
                </p>
              </div>
              <p className="t-small text-text-secondary">{t("moyens", { moyens })}</p>
              {p.ordre !== null ? <p className="t-small text-text-secondary">{t("rang", { rang: rang + 1 })}</p> : null}
              <div className="flex flex-wrap gap-3">
                {activationImpossible ? (
                  <Bouton variante="secondaire" desactive raison={t("adaptateurAbsent")}>
                    {t("activer", { prestataire: p.nom })}
                  </Bouton>
                ) : (
                  <Bouton variante="secondaire" enCours={enCours} onClick={() => lancer(() => changerEtatPrestataireAction({ code: p.code, actif: !p.actif }))}>
                    {p.actif ? t("desactiver", { prestataire: p.nom }) : t("activer", { prestataire: p.nom })}
                  </Bouton>
                )}
                {p.ordre !== null ? (
                  <>
                    {rang === 0 ? (
                      <Bouton variante="secondaire" desactive raison={t("deplacementImpossible")}>
                        {t("monter", { prestataire: p.nom })}
                      </Bouton>
                    ) : (
                      <Bouton variante="secondaire" enCours={enCours} onClick={() => lancer(() => deplacerPrestataireAction({ code: p.code, sens: "monter" }))}>
                        {t("monter", { prestataire: p.nom })}
                      </Bouton>
                    )}
                    {rang === agregateurs.length - 1 ? (
                      <Bouton variante="secondaire" desactive raison={t("deplacementImpossible")}>
                        {t("descendre", { prestataire: p.nom })}
                      </Bouton>
                    ) : (
                      <Bouton variante="secondaire" enCours={enCours} onClick={() => lancer(() => deplacerPrestataireAction({ code: p.code, sens: "descendre" }))}>
                        {t("descendre", { prestataire: p.nom })}
                      </Bouton>
                    )}
                  </>
                ) : null}
              </div>
              {p.type === "agregateur" ? <CouvertureAgregateur prestataire={p.code} nom={p.nom} couples={p.couples} /> : null}
            </li>
          );
        })}
      </ul>
      <section aria-labelledby="regle-carte" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 id="regle-carte" className="t-label text-text-primary">
          {t("regleCarte.titre")}
        </h2>
        <p className="t-small text-text-secondary">{t("regleCarte.maishapay")}</p>
        <p className="t-small text-text-secondary">{t("regleCarte.polar")}</p>
      </section>
    </div>
  );
}
