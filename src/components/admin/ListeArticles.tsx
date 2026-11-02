import { getFormatter, getTranslations } from "next-intl/server";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import type { ArticleListe } from "@/modules/blog/types";
import { PastilleStatut } from "./PastilleStatut";

const FUSEAU_BOUTIQUE = "Africa/Lubumbashi";

// Liste des articles : tableau (caption, th scope) à partir de md, cartes sur mobile. Nombre annoncé en statut ;
// état vide avec bouton de rédaction. Le statut vient de la base, jamais d'une supposition locale.
export async function ListeArticles({ articles }: { articles: readonly ArticleListe[] }) {
  const t = await getTranslations("Admin.blog");
  const format = await getFormatter();

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        <Bouton href="/admin/blog/nouveau">{t("vide.ecrire")}</Bouton>
      </div>
    );
  }

  const statut = (a: ArticleListe) => <PastilleStatut publie={a.publieLe !== null} libelle={t(a.publieLe === null ? "statut.brouillon" : "statut.publie")} />;
  const date = (a: ArticleListe) => format.dateTime(new Date(a.modifieLe), { dateStyle: "short", timeStyle: "short", timeZone: FUSEAU_BOUTIQUE });

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="t-small text-text-secondary">
        {t("nombre", { nombre: articles.length })}
      </p>

      <ul className="flex flex-col gap-ecart-cartes md:hidden">
        {articles.map((a) => (
          <li key={a.id} className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-5">
            <h2 className="t-h2">
              <Link href={`/admin/blog/${a.id}`} className="inline-flex min-h-touch items-center underline">
                {a.titreFr}
              </Link>
            </h2>
            {statut(a)}
            <p className="t-small text-text-secondary">{t("liste.modifieLe", { date: date(a) })}</p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="t-body w-full border-collapse text-left">
          <caption className="sr-only">{t("liste.legende")}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="t-label px-3 py-2">
                {t("liste.colonnes.titre")}
              </th>
              <th scope="col" className="t-label px-3 py-2">
                {t("liste.colonnes.statut")}
              </th>
              <th scope="col" className="t-label px-3 py-2">
                {t("liste.colonnes.modifieLe")}
              </th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id} className="border-b border-border">
                <th scope="row" className="px-3 py-2 font-semibold">
                  <Link href={`/admin/blog/${a.id}`} className="inline-flex min-h-touch items-center underline">
                    {a.titreFr}
                  </Link>
                </th>
                <td className="px-3 py-2">{statut(a)}</td>
                <td className="px-3 py-2">{date(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
