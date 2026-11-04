"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { avancerStatutCommandeAction } from "@/modules/commande/admin-actions";
import type { ErreurAdminCommande } from "@/modules/commande/admin-service";
import type { TransitionCommande } from "@/modules/commande/transitions";

// Avancement manuel (story 6.3) : seules les transitions autorisées sont rendues, les autres sont absentes. « Passer en fabrication » reste présent mais
// inactif tant que les mesures d'une ligne Sur-mesure ne sont pas confirmées (story 6.5). Le succès n'est affiché qu'après la réponse réelle de la base.
export function AvancementCommande({ numero, transitions, mesuresManquantes, retrait }: { numero: string; transitions: TransitionCommande[]; mesuresManquantes: boolean; retrait: boolean }) {
  const t = useTranslations("Admin.commandes.avancement");
  const id = useId();
  const router = useRouter();
  const [suivi, setSuivi] = useState("");
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [enCours, lancer] = useTransition();

  if (transitions.length === 0) return <p className="t-body text-text-secondary">{t("aucune")}</p>;

  function avancer(vers: TransitionCommande) {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await avancerStatutCommandeAction({ numero, vers, numeroSuivi: vers === "expediee" && !retrait ? suivi : null });
        if (r.ok) {
          setSuivi("");
          router.refresh();
        } else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {transitions.includes("expediee") && !retrait ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-suivi`} className="t-small text-text-primary">
            {t("suivi")}
          </label>
          <input id={`${id}-suivi`} type="text" maxLength={100} value={suivi} onChange={(e) => setSuivi(e.target.value)} aria-describedby={`${id}-suivi-aide`} className="min-h-touch rounded-md border border-border-field bg-surface px-3" />
          <p id={`${id}-suivi-aide`} className="t-small text-text-secondary">
            {t("suiviAide")}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {transitions.map((vers) =>
          vers === "en_fabrication" && mesuresManquantes ? (
            <Bouton key={vers} desactive raison={t("mesuresDabord")}>
              {t("versEnFabrication")}
            </Bouton>
          ) : (
            <Bouton key={vers} enCours={enCours} onClick={() => avancer(vers)} variante={vers === "en_fabrication" ? "principal" : "secondaire"}>
              {vers === "expediee" ? t(retrait ? "versPrete" : "versExpediee") : t(vers === "en_fabrication" ? "versEnFabrication" : "versLivree")}
            </Bouton>
          ),
        )}
      </div>
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur === "non_autorise" || erreur === "transition_interdite" || erreur === "mesures_non_recues" || erreur === "numero_suivi_invalide" || erreur === "commande_introuvable" ? erreur : "generique"}`)}</MessageEtat> : null}
    </div>
  );
}
