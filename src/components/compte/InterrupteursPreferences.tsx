"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { reglerPreferenceAction } from "@/modules/preferences/actions";
import type { ObjetConsentement, Preferences } from "@/modules/preferences/types";

const LIGNES: { objet: ObjetConsentement; cle: "relances" | "nouveautes" | "alertes" }[] = [
  { objet: "relances", cle: "relances" },
  { objet: "nouveautes", cle: "nouveautes" },
  { objet: "alertes_festival", cle: "alertes" },
];

// « Mon compte » › « Préférences » (story 9.4, UX-DR43) : trois interrupteurs. Le mot « Actif » ou « Désactivé » n'est mis à jour
// qu'après l'enregistrement réel en base (règle 13) ; un échec laisse l'état précédent et le dit.
export function InterrupteursPreferences({ initiales }: { initiales: Preferences }) {
  const t = useTranslations("Preferences");
  const id = useId();
  const [etat, setEtat] = useState<Record<ObjetConsentement, boolean>>({
    relances: initiales.relances,
    nouveautes: initiales.nouveautes,
    alertes_festival: initiales.alertesFestival,
  });
  const [enCours, setEnCours] = useState<ObjetConsentement | null>(null);
  const [erreur, setErreur] = useState<{ objet: ObjetConsentement; session: boolean } | null>(null);
  const enVol = useRef(false);

  async function basculer(objet: ObjetConsentement) {
    if (enVol.current) return;
    enVol.current = true;
    setEnCours(objet);
    setErreur(null);
    try {
      const r = await reglerPreferenceAction({ objet, actif: !etat[objet] });
      if (r.ok) setEtat((e) => ({ ...e, [objet]: r.actif }));
      else setErreur({ objet, session: r.erreur === "non_connecte" });
    } catch {
      setErreur({ objet, session: false });
    } finally {
      enVol.current = false;
      setEnCours(null);
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {LIGNES.map(({ objet, cle }) => {
        const actif = etat[objet];
        const idNom = `${id}-${cle}-nom`;
        const idAide = `${id}-${cle}-aide`;
        const idEtat = `${id}-${cle}-etat`;
        return (
          <li key={objet} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p id={idNom} className="t-label text-text-primary">
                  {t(`${cle}.nom`)}
                </p>
                <p id={idAide} className="t-small text-text-secondary">
                  {t(`${cle}.aide`)}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={actif}
                aria-labelledby={idNom}
                aria-describedby={`${idAide} ${idEtat}`}
                aria-busy={enCours === objet || undefined}
                // aria-disabled plutôt que disabled : le focus clavier reste sur l'interrupteur (règle 7) ; enVol bloque le second clic.
                aria-disabled={enCours !== null || undefined}
                onClick={() => basculer(objet)}
                className="inline-flex min-h-touch min-w-touch items-center gap-2 rounded-full border-2 border-border-field px-3 py-1 aria-checked:border-primary aria-disabled:opacity-60"
              >
                <span aria-hidden="true" className={`size-5 rounded-full ${actif ? "bg-primary" : "bg-border-field"}`} />
                <span id={idEtat} className="t-small text-text-primary">
                  {enCours === objet ? t("enregistrement") : actif ? t("actif") : t("desactive")}
                </span>
              </button>
            </div>
            {erreur?.objet === objet ? <MessageEtat type="erreur">{erreur.session ? t("erreurSession") : t("erreur")}</MessageEtat> : null}
          </li>
        );
      })}
    </ul>
  );
}
