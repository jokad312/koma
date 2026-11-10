import { getTranslations } from "next-intl/server";

export type Barre = { libelle: string; valeur: number; texteValeur: string };

// Graphique en barres (UX-DR43) : la valeur est écrite sur chaque barre, une seule teinte (aucune couleur par série), et
// « Voir les données en tableau » donne les mêmes chiffres en tableau. Aucune barre n'est inventée : sans donnée, un message.
export async function GraphiqueBarres({ id, titre, barres, total, vide }: { id: string; titre: string; barres: readonly Barre[]; total?: string; vide?: string }) {
  const t = await getTranslations("Admin.tableau.graphiques");
  const max = Math.max(0, ...barres.map((b) => b.valeur));
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h3 id={id} className="t-h2">
        {titre}
      </h3>
      {total ? <p className="t-label text-text-primary">{total}</p> : null}
      {barres.length === 0 ? (
        <p className="t-body text-text-secondary">{vide ?? t("vide")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {barres.map((b) => (
              <li key={b.libelle} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <span className="t-small text-text-secondary">{b.libelle}</span>
                <span className="relative flex h-8 items-center overflow-hidden rounded bg-background">
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded border border-text-secondary/40 bg-border" style={{ width: `${max > 0 ? Math.max(2, Math.round((b.valeur / max) * 100)) : 0}%` }} />
                  <span className="t-label relative px-2 text-text-primary">{b.texteValeur}</span>
                </span>
              </li>
            ))}
          </ul>
          <details>
            <summary className="t-label inline-flex min-h-touch cursor-pointer items-center text-text-primary underline">{t("donnees")}</summary>
            <table className="mt-2 w-full border-collapse text-left">
              <caption className="sr-only">{titre}</caption>
              <thead>
                <tr>
                  <th scope="col" className="t-label border-b border-border py-2 pr-2">
                    {t("colonneLibelle")}
                  </th>
                  <th scope="col" className="t-label border-b border-border py-2 text-right">
                    {t("colonneMontant")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {barres.map((b) => (
                  <tr key={b.libelle}>
                    <th scope="row" className="t-body border-b border-border py-2 pr-2 font-normal">
                      {b.libelle}
                    </th>
                    <td className="t-body border-b border-border py-2 text-right">{b.texteValeur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
