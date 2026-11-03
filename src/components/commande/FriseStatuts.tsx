import { useTranslations } from "next-intl";
import { formaterDateBoutique } from "@/lib/dates";
import type { EtapeFrise } from "@/modules/commande/frise";

// Frise des statuts : liste ordonnée, chaque étape avec icône, libellé et état en texte ; l'étape courante porte aria-current="step".
// Aucune couleur rouge (UX-DR38) : l'état est aussi dit en toutes lettres.
export function FriseStatuts({ etapes, retraitGoma, locale }: { etapes: EtapeFrise[]; retraitGoma: boolean; locale: "fr" | "en" }) {
  const t = useTranslations("Commande.frise");
  if (etapes.length === 0) return null;
  return (
    <ol aria-label={t("titre")} className="flex flex-col gap-3">
      {etapes.map((e) => {
        const libelle = e.cle === "expediee" && retraitGoma ? t("etapes.pretARetirer") : t(`etapes.${e.cle}`);
        const date = formaterDateBoutique(e.date, locale);
        return (
          <li key={e.cle} {...(e.etat === "en_cours" ? { "aria-current": "step" as const } : {})} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-field t-small text-text-primary">
              {e.etat === "fait" ? "✓" : e.etat === "en_cours" ? "●" : "○"}
            </span>
            <span className="flex flex-col">
              <span className="t-label text-text-primary">{libelle}</span>
              <span className="t-small text-text-secondary">
                {t(`etats.${e.etat}`)}
                {date ? ` · ${date}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
