"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { forcerLiberationVerrouAction } from "@/modules/scan/hors-ligne-actions";
import type { VerrouHorsLigne } from "@/modules/scan/queries";

const FUSEAU = "Africa/Lubumbashi";

type Retour = { type: "ok" } | { type: "aucun" } | { type: "erreur"; erreur: "non_connecte" | "non_autorise" | "generique" };

// Section « Scan hors ligne » de la page d'un Événement (story 7.8, FR-36) : qui tient le Verrou, et « Libérer le Verrou » (Admin seulement) quand un
// appareil est perdu. La libération demande une confirmation ; le succès n'apparaît qu'après la réponse réelle du serveur.
export function SectionVerrou({ evenementId, verrou }: { evenementId: string; verrou: VerrouHorsLigne | null }) {
  const t = useTranslations("Admin.evenements.verrou");
  const locale = useLocale();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(false);
  const [retour, setRetour] = useState<Retour | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const format = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: FUSEAU }).format(new Date(iso));

  function liberer() {
    if (enVol.current) return;
    enVol.current = true;
    setRetour(null);
    demarrer(async () => {
      try {
        const r = await forcerLiberationVerrouAction({ evenementId });
        if (r.ok) {
          setRetour({ type: r.statut === "force" ? "ok" : "aucun" });
          setConfirmation(false);
          router.refresh();
        } else {
          setRetour({ type: "erreur", erreur: r.erreur === "non_connecte" || r.erreur === "non_autorise" ? r.erreur : "generique" });
        }
      } catch {
        setRetour({ type: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  return (
    <section aria-labelledby="admin-verrou" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="admin-verrou" className="t-h3">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      {verrou ? (
        <div className="flex flex-col gap-2">
          <p className="t-body">{t("tenu", { email: verrou.email, depuis: format(verrou.prisLe), fin: format(verrou.expireLe) })}</p>
          <p className="t-small text-text-secondary">{verrou.listeTelechargee ? t("tenuListe") : t("tenuSansListe")}</p>
          {verrou.echu ? <p className="t-small text-text-secondary">{t("echu")}</p> : null}
          {confirmation ? (
            <div className="flex flex-wrap gap-3">
              <Bouton enCours={enCours} onClick={liberer}>
                {enCours ? t("enCours") : t("confirmer")}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setConfirmation(false)}>
                {t("annuler")}
              </Bouton>
            </div>
          ) : (
            <div>
              <Bouton variante="secondaire" onClick={() => setConfirmation(true)}>
                {t("liberer")}
              </Bouton>
            </div>
          )}
        </div>
      ) : (
        <p className="t-small text-text-secondary">{t("aucun")}</p>
      )}
      <div aria-live="polite">
        {retour?.type === "ok" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}
        {retour?.type === "aucun" ? <MessageEtat type="information">{t("aucunALiberer")}</MessageEtat> : null}
        {retour?.type === "erreur" ? <MessageEtat type="erreur">{t(`erreurs.${retour.erreur}`)}</MessageEtat> : null}
      </div>
    </section>
  );
}
