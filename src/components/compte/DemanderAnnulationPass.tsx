"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { demanderAnnulationPassAction } from "@/modules/evenements/annulation-actions";
import type { ErreurAnnulationPass } from "@/modules/evenements/annulation";
import type { AnnulationPass } from "@/modules/evenements/pass-types";

const erreurAffichee = (e: ErreurAnnulationPass): "impossible" | "deja" | "reglage" | "generique" => (e === "impossible" || e === "deja" || e === "reglage" ? e : "generique");

// « Demander l'annulation » (story 7.9, FR-38) : le bouton n'existe que si la base a dit « annulable » (48 h, Pass valide, frais connus) ; la demande
// n'est envoyée qu'après une confirmation qui rappelle les frais retenus. La base revérifie tout : ce composant n'est qu'une commodité d'affichage.
export function DemanderAnnulationPass({ passId, annulation }: { passId: string; annulation: AnnulationPass }) {
  const t = useTranslations("Pass.carte.annulation");
  const router = useRouter();
  const id = useId();
  const titre = useRef<HTMLHeadingElement>(null);
  const [etape, setEtape] = useState<"repos" | "confirmation" | "envoyee">("repos");
  const [erreur, setErreur] = useState<ErreurAnnulationPass | null>(null);
  const [enCours, lancer] = useTransition();

  useEffect(() => {
    if (etape === "confirmation") titre.current?.focus();
  }, [etape]);

  function envoyer() {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await demanderAnnulationPassAction({ passId });
        if (r.ok) {
          setEtape("envoyee");
          router.refresh();
        } else {
          setErreur(r.erreur);
          setEtape("repos");
        }
      } catch {
        setErreur("generique");
        setEtape("repos");
      }
    });
  }

  if (etape === "envoyee" || annulation.demande === "ouverte") {
    return (
      <p role="status" className="t-small text-text-primary">
        {etape === "envoyee" ? t("envoyee") : t("enCours")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {annulation.demande === "refusee" ? <p className="t-small text-text-secondary">{t("refusee")}</p> : null}
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreurAffichee(erreur)}`)}</MessageEtat> : null}
      {annulation.possible && annulation.fraisPct !== null ? (
        etape === "confirmation" ? (
          <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-2 rounded-md border border-border-field p-3">
            <h5 id={`${id}-titre`} ref={titre} tabIndex={-1} className="t-label text-text-primary">
              {t("titre")}
            </h5>
            <p className="t-small text-text-primary">{t("frais", { frais: annulation.fraisPct })}</p>
            {annulation.stand ? <p className="t-small text-text-primary">{t("stand")}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Bouton enCours={enCours} onClick={envoyer}>
                {t("confirmer")}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setEtape("repos")}>
                {t("garder")}
              </Bouton>
            </div>
          </section>
        ) : (
          <div>
            <Bouton variante="secondaire" onClick={() => setEtape("confirmation")}>
              {t("bouton")}
            </Bouton>
          </div>
        )
      ) : null}
    </div>
  );
}
