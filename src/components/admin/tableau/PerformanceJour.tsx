import { useLocale, useTranslations } from "next-intl";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { formaterUsd, PLAFOND_COMMANDES_PAYEES, ventesDuJour } from "@/modules/tableau-de-bord/calculs";
import { FUSEAU_GOMA } from "@/modules/tableau-de-bord/periode";
import type { CommandePayee, Zone } from "@/modules/tableau-de-bord/queries";

// Performance du jour (story 9.16 c, maquette E7, décision Q11) : nombre et montant des ventes payées aujourd'hui à Goma (Africa/Lubumbashi),
// mêmes règles que SM-1 (Commandes payées, hors annulées et remboursées, USD, livraison comprise). La date est écrite selon la langue.
// Lecture au plafond : « au moins », jamais un chiffre présenté comme exact. Lecture en échec : la zone le dit, jamais un faux zéro.
export function PerformanceJour({ commandes, maintenant }: { commandes: Zone<CommandePayee[]>; maintenant: Date }) {
  const t = useTranslations("Admin.tableau");
  const locale = useLocale();
  if (commandes === null) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  const { nombre, montantCents, auMoins } = ventesDuJour(commandes, PLAFOND_COMMANDES_PAYEES);
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: FUSEAU_GOMA }).format(maintenant);
  const valeur = (texte: string) => (auMoins ? t("jour.auMoins", { valeur: texte }) : texte);
  return (
    <div className="flex flex-col gap-4">
      <p className="t-label">{t("jour.date", { date })}</p>
      <dl className="flex flex-col gap-3 pl-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="t-label text-text-secondary">{t("jour.nombre")}</dt>
          <dd className="t-h3" data-ventes-nombre="">
            {valeur(String(nombre))}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="t-label text-text-secondary">{t("jour.montant")}</dt>
          <dd className="t-h3" data-ventes-montant="">
            {valeur(formaterUsd(montantCents, locale))}
          </dd>
        </div>
      </dl>
    </div>
  );
}
