"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import type { CodePromo } from "@/modules/promo/types";
import { FormulaireCodePromo } from "./FormulaireCodePromo";

// Liste des Codes promo (story 9.1, FR-46). L'état et les valeurs affichés sont ceux de la base : la liste est relue après
// chaque réponse réelle du serveur (règle 13). Le code d'un code promo existant ne se modifie jamais.
export function ListeCodesPromo({ codes }: { codes: CodePromo[] }) {
  const t = useTranslations("Admin.codesPromo");
  const langue = useLocale();
  const nombre = new Intl.NumberFormat(langue, { maximumFractionDigits: 2 });
  const [enEdition, setEnEdition] = useState<string | null>(null);

  if (codes.length === 0) return <p className="t-body text-text-secondary">{t("vide")}</p>;

  return (
    <ul className="flex flex-col gap-3">
      {codes.map((c) => (
        <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-h2">{c.code}</h2>
            <p className="t-label text-text-primary" data-etat={c.actif ? "actif" : "inactif"}>
              {c.actif ? t("etat.actif") : t("etat.inactif")}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex flex-col">
              <dt className="t-small text-text-secondary">{t("champs.affilie")}</dt>
              <dd className="t-body text-text-primary">{c.affilie}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="t-small text-text-secondary">{t("champs.reductionPct")}</dt>
              <dd className="t-body text-text-primary">{t("pourcentage", { valeur: nombre.format(c.reductionPct) })}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="t-small text-text-secondary">{t("champs.commissionPct")}</dt>
              <dd className="t-body text-text-primary">{t("pourcentage", { valeur: nombre.format(c.commissionPct) })}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="t-small text-text-secondary">{t("champs.plafond")}</dt>
              <dd className="t-body text-text-primary">{nombre.format(c.plafond)}</dd>
            </div>
          </dl>
          <div>
            <Bouton
              variante="secondaire"
              onClick={() => setEnEdition(enEdition === c.id ? null : c.id)}
              aria-label={t("boutons.modifierCode", { code: c.code })}
              aria-expanded={enEdition === c.id}
            >
              {t("boutons.modifier")}
            </Bouton>
          </div>
          {enEdition === c.id ? <FormulaireCodePromo code={c} onTermine={() => setEnEdition(null)} /> : null}
        </li>
      ))}
    </ul>
  );
}
