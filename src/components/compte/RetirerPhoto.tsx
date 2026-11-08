"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { retirerPhotoAction } from "@/modules/communaute/actions";

// Retrait d'une photo à la demande du client (FR-41) : confirmation, puis résultat réel de la base ; la liste est relue ensuite.
export function RetirerPhoto({ id, publiee }: { id: string; publiee: boolean }) {
  const t = useTranslations("Communaute.mesPhotos");
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enVol = useRef(false);

  async function retirer() {
    if (enVol.current) return;
    enVol.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await retirerPhotoAction({ id });
      if (!r.ok) {
        setErreur(r.erreur === "introuvable" ? t("erreurIntrouvable") : r.erreur === "non_connecte" ? t("erreurSession") : t("erreur"));
        return;
      }
      setConfirmation(false);
      router.refresh();
    } catch {
      setErreur(t("erreur"));
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {confirmation ? (
        <>
          <p className="t-small text-text-primary">{publiee ? t("confirmationPubliee") : t("confirmation")}</p>
          <div className="flex flex-wrap gap-2">
            <Bouton variante="secondaire" onClick={retirer} enCours={enCours}>
              {t("confirmer")}
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setConfirmation(false)}>
              {t("garder")}
            </Bouton>
          </div>
        </>
      ) : (
        <Bouton variante="secondaire" onClick={() => setConfirmation(true)}>
          {t("retirer")}
        </Bouton>
      )}
      {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
    </div>
  );
}
