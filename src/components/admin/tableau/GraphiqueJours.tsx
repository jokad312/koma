import { useLocale, useTranslations } from "next-intl";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { formaterUsd, formaterUsdCompact, graduations, indicesDates, type PointJour } from "@/modules/tableau-de-bord/calculs";

// Graphique des ventes payées par jour (story 9.16 c, maquette E5 et E6, décision Q10) : une barre verticale rouge par jour sur 30 jours,
// jours sans vente à zéro (zéro réel : la lecture a réussi), axe des montants gradué, une date tous les 5 jours sous l'axe (tous les 10 jours
// sous 640 px, pour que les dates ne se chevauchent pas). Le dessin est décoratif pour les lecteurs d'écran : un résumé le décrit et
// « Voir les données en tableau » donne les 30 jours. Lecture en échec (points null) : la zone le dit, jamais une barre inventée.
export function GraphiqueJours({ points }: { points: readonly PointJour[] | null }) {
  const t = useTranslations("Admin.tableau");
  const locale = useLocale();
  if (points === null) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;

  const graduation = graduations(Math.max(0, ...points.map((p) => p.montantCents)));
  const haut = graduation[graduation.length - 1];
  const aucuneVente = points.every((p) => p.montantCents === 0);
  const libellesAxe = graduation.map((v) => formaterUsdCompact(v, locale));
  const dates = new Set(indicesDates(points.length));
  const datesLarges = new Set(indicesDates(points.length, 10));
  const date = (jour: string) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
  const dateLongue = (jour: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
  const hauteur = (v: number) => `${haut > 0 ? Math.min(100, (v / haut) * 100) : 0}%`;

  return (
    <div className="flex flex-col gap-2" data-graphique-jours="">
      <p className="t-small flex items-center justify-center gap-2 text-text-primary">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-transparent bg-admin-barre" />
        {t("ventes.legende")}
      </p>
      <p className="sr-only">{t("ventes.resume", { donnees: t("graphiques.donnees") })}</p>
      {/* Lecture réussie mais aucune vente : on le dit, l'axe et les 30 barres à zéro restent. */}
      {aucuneVente ? <p className="t-body text-center text-text-secondary">{t("ventes.vide")}</p> : null}
      <div aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* Axe des montants : la colonne prend la largeur du plus long libellé (copie invisible), les libellés sont placés à leur hauteur. */}
        <div className="t-small relative text-right text-text-secondary">
          <div className="invisible h-0 overflow-hidden whitespace-nowrap">
            {libellesAxe.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          <div className="relative h-44 xl:h-36">
            {graduation.map((v, i) => (
              <span key={v} className="absolute right-0 translate-y-1/2 whitespace-nowrap" style={{ bottom: hauteur(v) }}>
                {libellesAxe[i]}
              </span>
            ))}
          </div>
        </div>
        <div className="relative h-44 border-b-2 border-l-2 border-text-secondary xl:h-36">
          {graduation.slice(1).map((v) => (
            <span key={v} className="absolute inset-x-0 border-t border-admin-axe" style={{ bottom: hauteur(v) }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] px-1">
            {points.map((p) => (
              <span key={p.jour} data-barre={p.jour} className="min-w-0 flex-1 rounded-t-sm bg-admin-barre" style={{ height: hauteur(p.montantCents) }} />
            ))}
          </div>
        </div>
        <span />
        <div className="t-small mt-1 grid px-1 text-text-primary" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((p, i) =>
            dates.has(i) ? (
              <span
                key={p.jour}
                className={`whitespace-nowrap text-right ${datesLarges.has(i) ? "" : "hidden sm:block"}`}
                style={{ gridColumn: `${Math.max(1, i - 3)} / ${i + 2}`, gridRow: 1 }}
              >
                {date(p.jour)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <details>
        <summary className="t-label inline-flex min-h-touch cursor-pointer items-center text-text-primary underline">{t("graphiques.donnees")}</summary>
        <table className="mt-2 w-full border-collapse text-left">
          <caption className="sr-only">{t("ventes.tableau")}</caption>
          <thead>
            <tr>
              <th scope="col" className="t-label border-b border-admin-axe py-2 pr-2">
                {t("ventes.colonneJour")}
              </th>
              <th scope="col" className="t-label border-b border-admin-axe py-2 text-right">
                {t("graphiques.colonneMontant")}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.jour}>
                <th scope="row" className="t-body border-b border-admin-axe py-2 pr-2 font-normal">
                  {dateLongue(p.jour)}
                </th>
                <td className="t-body border-b border-admin-axe py-2 text-right">{formaterUsd(p.montantCents, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
