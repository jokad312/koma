"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { ErreurAnnulation } from "@/modules/commande/annulation";
import { demanderAnnulationAction } from "@/modules/commande/annulation-actions";

// « Demander l'annulation » (story 6.6) : une boîte de dialogue demande de confirmer, puis la demande est envoyée. Rien n'est annulé par ce geste :
// Jonathan accepte ou refuse. Le bouton n'existe que tant que la fabrication n'a pas commencé (la page ne le rend plus ensuite).
export function DemandeAnnulation({ numero }: { numero: string }) {
  const t = useTranslations("Commande.annulation");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<ErreurAnnulation | null>(null);
  const [enCours, lancer] = useTransition();

  function envoyer() {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await demanderAnnulationAction({ numero });
        if (r.ok) {
          setOuvert(false);
          router.refresh();
        } else {
          setErreur(r.erreur);
          setOuvert(false);
        }
      } catch {
        setErreur("generique");
        setOuvert(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
        {t("bouton")}
      </Bouton>
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur}`)}</MessageEtat> : null}
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre={t("titreDialogue")}>
        <div className="flex flex-col gap-4">
          <p className="t-body text-text-primary">{t("texteDialogue")}</p>
          <div className="flex flex-wrap gap-3">
            <Bouton enCours={enCours} onClick={envoyer}>
              {t("confirmer")}
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setOuvert(false)}>
              {t("renoncer")}
            </Bouton>
          </div>
        </div>
      </Dialogue>
    </div>
  );
}
