import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AvatarInitiale } from "@/components/admin/ui/AvatarInitiale";
import { CLASSES_TABLEAU_ADMIN, EnTeteTableau } from "@/components/admin/ui/EnTeteTableau";
import { Pastille } from "@/components/admin/ui/Pastille";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { FUSEAU_BOUTIQUE } from "@/lib/dates";
import { adresseCodes, type ParametresCodes } from "@/modules/promo/liste";
import type { CodePromo } from "@/modules/promo/types";
import { ActionsCodePromo } from "./ActionsCodePromo";
import { Nombre, nb } from "@/components/ui/Nombre";

const CODE = "t-label inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full bg-admin-champ px-4 text-text-primary";
// Détails (conditions, ventes) : libellé et valeur côte à côte, les paires passent à la ligne.
const DETAILS = "flex flex-wrap gap-x-6 gap-y-1";

// Lignes d'une page de Codes promo selon la maquette 07-codes-promo (story 9.16 i, CP5 à CP8) : tableau à partir de 1024 px, cartes en dessous (aucun
// défilement horizontal à 390 px). Colonnes de la maquette : N° = rang dans la liste filtrée (Q29), INFLUENCEUR, DATE = création à l'heure de Goma (Q29),
// CODE en pastille sombre, ÉTAT, ACTIONS ; les valeurs existantes (réduction, commission, plafond, ventes de la story 9.3) sont sur une seconde ligne, sous
// chaque code, sur toute la largeur (sinon le tableau déborde à 1366 px). Chaque code est un <tbody> (ses deux lignes). Valeurs lues en base.
export function ListeCodesPromo({ codes, debut, parametres, locale }: { codes: readonly CodePromo[]; debut: number; parametres: ParametresCodes; locale: Locale }) {
  const t = useTranslations("Admin.codesPromo");
  const nombre = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const pct = (v: number) => t("pourcentage", { valeur: nombre.format(v) });
  const formatDate = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: FUSEAU_BOUTIQUE, day: "numeric", month: "short", year: "numeric" });
  const date = (c: CodePromo) => {
    const d = new Date(c.creeLe);
    return Number.isNaN(d.getTime()) ? "" : formatDate.format(d);
  };
  const modifier = (c: CodePromo) => adresseCodes(parametres, { modifier: c.id });
  const etat = (c: CodePromo) => (
    <span data-etat={c.actif ? "actif" : "inactif"}>
      <Pastille>{c.actif ? t("etat.actif") : t("etat.inactif")}</Pastille>
    </span>
  );
  const paire = (libelle: string, valeur: ReactNode) => (
    <div className="flex gap-2">
      <dt className="text-text-secondary">{libelle}</dt>
      <dd>{valeur}</dd>
    </div>
  );
  const conditions = (c: CodePromo) => (
    <dl className={DETAILS} role="group" aria-label={t("conditions.titre", { code: c.code })}>
      {paire(t("champs.reductionPct"), pct(c.reductionPct))}
      {paire(t("champs.commissionPct"), pct(c.commissionPct))}
      {paire(t("champs.plafond"), nombre.format(c.plafond))}
    </dl>
  );
  // Story 9.3 : calcul de la vue commission_code_promo ; aucun paiement de commission n'est fait par le site.
  const ventes = (c: CodePromo) => (
    <dl className={DETAILS} role="group" aria-label={t("ventes.titre", { code: c.code })}>
      {paire(t("ventes.nombre"), <Nombre>{nombre.format(c.ventes)}</Nombre>)}
      {paire(t("ventes.montant"), <Nombre>{formaterUsd(c.montantCents, locale)}</Nombre>)}
      {paire(t("ventes.commission"), <Nombre>{formaterUsd(c.commissionCents, locale)}</Nombre>)}
    </dl>
  );
  const colonnes = [
    { cle: "numero", libelle: t("colonnes.numero") },
    { cle: "influenceur", libelle: t("colonnes.influenceur") },
    { cle: "date", libelle: t("colonnes.date") },
    { cle: "code", libelle: t("colonnes.code") },
    { cle: "etat", libelle: t("colonnes.etat") },
    { cle: "actions", libelle: t("colonnes.actions") },
  ];
  return (
    <>
      <div className="hidden lg:block">
        <table className={`${CLASSES_TABLEAU_ADMIN} t-body text-left text-text-primary`}>
          <EnTeteTableau colonnes={colonnes} />
          {codes.map((c, i) => (
            <tbody key={c.id} data-code-promo={c.code}>
              <tr>
                <td className="px-4 pt-4 align-middle">{debut + i + 1}</td>
                <td className="px-4 pt-4 align-middle">
                  <span className="flex min-w-0 items-center gap-3">
                    <AvatarInitiale nom={c.affilie} />
                    <span className="min-w-0 break-words">{c.affilie}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 pt-4 align-middle">{date(c)}</td>
                <td className="px-4 pt-4 align-middle">
                  <span className={CODE}><Nombre>{c.code}</Nombre></span>
                </td>
                <td className="px-4 pt-4 align-middle">{etat(c)}</td>
                <td className="px-2 pt-4 align-middle">
                  <ActionsCodePromo code={c} modifier={modifier(c)} />
                </td>
              </tr>
              <tr>
                <td />
                <td colSpan={5} className="border-b border-border-field px-4 pb-4 pt-3 text-text-primary">
                  <div className="flex flex-col gap-1">
                    {conditions(c)}
                    {ventes(c)}
                  </div>
                </td>
              </tr>
            </tbody>
          ))}
        </table>
      </div>
      <ul className="flex flex-col gap-3 lg:hidden">
        {codes.map((c, i) => (
          <li key={c.id} data-code-promo={c.code} className="t-body flex min-w-0 flex-col gap-3 rounded-[16px] bg-admin-entete p-4 text-text-primary">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="t-label">{t.rich("carte.numero", { numero: debut + i + 1, nb })}</span>
              {etat(c)}
            </div>
            <span className="flex min-w-0 items-center gap-3">
              <AvatarInitiale nom={c.affilie} />
              <span className="min-w-0 break-words">{c.affilie}</span>
            </span>
            <span className={`${CODE} self-start`}><Nombre>{c.code}</Nombre></span>
            <p className="text-text-secondary">{t("carte.creeLe", { date: date(c) })}</p>
            {conditions(c)}
            {ventes(c)}
            <ActionsCodePromo code={c} modifier={modifier(c)} />
          </li>
        ))}
      </ul>
    </>
  );
}
