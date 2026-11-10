import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CarteTache } from "@/modules/tableau-de-bord/queries";

// Cartes de tâche (UX-DR43) : compteur réel et lien vers la page qui traite la tâche. Une carte à zéro reste affichée, en ton
// atténué. Compteur illisible : la carte le dit (« Lecture impossible »), jamais un faux zéro. Aucune donnée personnelle.
export async function CartesTaches({ cartes }: { cartes: readonly CarteTache[] }) {
  const t = await getTranslations("Admin.tableau.taches");
  const aucune = cartes.every((c) => c.nombre === 0);
  return (
    <section aria-labelledby="tableau-taches" className="flex flex-col gap-3">
      <h2 id="tableau-taches" className="t-h2">
        {t("titre")}
      </h2>
      {aucune ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
      <ul className="grid grid-cols-1 gap-ecart-cartes sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map((c) => {
          const zero = c.nombre === 0;
          return (
            <li key={c.cle} className={`flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 ${zero ? "opacity-70" : ""}`}>
              <h3 className="t-label text-text-primary">{t(c.cle)}</h3>
              <p className="t-h2">
                {c.nombre === null ? <span className="t-body text-text-secondary">{t("illisible")}</span> : c.nombre}
              </p>
              <Link href={c.href} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                <span aria-hidden="true">{t("ouvrir")}</span>
                <span className="sr-only">{t("ouvrirTache", { tache: t(c.cle) })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
