"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { desinscrireAction } from "@/modules/preferences/actions";

// Confirmation de la désinscription (décision de Jonathan du 2026-11-10) : ouvrir le lien ne fait rien ; seul le bouton envoie la demande
// signée (POST d'une Server Action). Le résultat réel de la base est annoncé dans une zone d'état stable (règles 7 et 13).
export function ConfirmationDesinscription({ c, s }: { c: string; s: string }) {
  const t = useTranslations("Desinscription");
  const [etat, setEtat] = useState<"attente" | "desinscrit" | "lien_invalide" | "erreur">("attente");
  const [enCours, setEnCours] = useState(false);
  const enVol = useRef(false);

  async function confirmer() {
    if (enVol.current) return;
    enVol.current = true;
    setEnCours(true);
    try {
      setEtat(await desinscrireAction({ c, s }));
    } catch {
      setEtat("erreur");
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  const termine = etat === "desinscrit" || etat === "lien_invalide";
  return (
    <div className="flex flex-col items-start gap-3">
      {termine ? null : (
        <>
          <p className="t-body text-text-primary">{t("question")}</p>
          <Bouton onClick={confirmer} enCours={enCours}>
            {t("confirmer")}
          </Bouton>
        </>
      )}
      <div role="status" aria-live="polite">
        {etat === "desinscrit" ? <MessageEtat type="succes">{t("fait")}</MessageEtat> : null}
        {etat === "lien_invalide" ? <MessageEtat type="attention">{t("invalide")}</MessageEtat> : null}
        {etat === "erreur" ? <MessageEtat type="erreur">{t("erreur")}</MessageEtat> : null}
      </div>
    </div>
  );
}
