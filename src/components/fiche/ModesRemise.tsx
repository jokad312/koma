import { useTranslations } from "next-intl";
import { formaterUsd } from "@/lib/argent";

type Props = {
  locale: "fr" | "en";
  // Forfaits de livraison en centimes USD ; null = non réglé : aucun montant n'est affiché (rien d'inventé).
  forfaitGoma: number | null;
  forfaitBukavu: number | null;
  // Lieu et modalités du retrait gratuit à Goma dans la langue de la page ; null = non réglé : pas de retrait affiché.
  retraitGoma: string | null;
  // Fabrication de la taille choisie (délai nul : fabrication sur commande sans délai fixé) ; null = rien à fabriquer ou aucune taille choisie.
  // "choisir" : toutes les tailles proposées sont fabriquées sur commande et aucune n'est choisie, le délai dépend de la taille.
  fabrication: { jours: number | null } | "choisir" | null;
};

// Modes de remise : Goma (retrait gratuit ou livraison au forfait) et Bukavu (livraison au forfait). Le délai se dit en deux membres,
// sans addition : fabrication éventuelle, puis remise en texte fixe. Aucun montant calculé (frais, total : epic 4).
export function ModesRemise({ locale, forfaitGoma, forfaitBukavu, retraitGoma, fabrication }: Props) {
  const t = useTranslations("Fiche.remise");

  function delai(remise: string) {
    if (fabrication === "choisir") return t("fabricationAChoisir");
    if (!fabrication) return t("delaiSimple", { remise });
    return fabrication.jours === null || fabrication.jours <= 0 ? t("delaiFabricationInconnu", { remise }) : t("delaiFabrication", { n: fabrication.jours, remise });
  }

  return (
    <section aria-labelledby="remise-titre" className="flex flex-col gap-3">
      <h2 id="remise-titre" className="t-h3">
        {t("titre")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <h3 className="t-button">{t("goma")}</h3>
          <ul className="t-small flex flex-col gap-1 text-text-primary">
            {retraitGoma ? <li>{t("retrait", { lieu: retraitGoma })}</li> : null}
            {forfaitGoma !== null ? <li>{t("livraison", { prix: formaterUsd(forfaitGoma, locale) })}</li> : null}
            <li>{delai(t("remiseGoma"))}</li>
          </ul>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <h3 className="t-button">{t("bukavu")}</h3>
          <ul className="t-small flex flex-col gap-1 text-text-primary">
            {forfaitBukavu !== null ? <li>{t("livraison", { prix: formaterUsd(forfaitBukavu, locale) })}</li> : null}
            <li>{delai(t("remiseBukavu"))}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
