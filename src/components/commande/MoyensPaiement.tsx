import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { OptionsPaiement } from "@/modules/paiement/service";

// Moyens de paiement d'une Commande à payer : seulement ce que le serveur autorise, en texte et sans logo (UX-DR34). Aucun repli caché :
// sans Prestataire carte autorisé, le message le dit (UX-DR36). « Paiement traité par {Prestataire} » précède le bouton de paiement
// (qui arrive avec les stories des adaptateurs : aucun bouton n'est affiché tant qu'aucun adaptateur n'existe).
export async function MoyensPaiement({ locale, options }: { locale: Locale; options: OptionsPaiement }) {
  const t = await getTranslations({ locale, namespace: "Paiement.moyens" });
  return (
    <section aria-labelledby="commande-moyens" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="commande-moyens" className="t-h2">
        {t("titre")}
      </h2>
      <ul className="flex flex-col gap-3">
        <li className="flex flex-col gap-1">
          <p className="t-label text-text-primary">{t("mobileMoney")}</p>
          {options.mobileMoney.disponible ? null : <p className="t-small text-text-secondary">{t("mobileMoneyIndisponible")}</p>}
        </li>
        <li className="flex flex-col gap-1">
          <p className="t-label text-text-primary">{t("carte")}</p>
          {options.carte.disponible ? (
            <p className="t-small text-text-secondary">{t("traitePar", { prestataire: options.carte.prestataire.nom })}</p>
          ) : (
            <p className="t-small text-text-secondary">{t("carteIndisponible")}</p>
          )}
        </li>
      </ul>
    </section>
  );
}
