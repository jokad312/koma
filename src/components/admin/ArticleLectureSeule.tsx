import { getFormatter, getTranslations } from "next-intl/server";
import type { Article } from "@/modules/blog/types";

// Story 9.16 (correctif, point 3 de Jonathan, 2026-11-21) : l'Assistant a le droit blog.gerer (liste et fiches) mais la base réserve à l'Admin
// l'écriture du blog (enregistrer_article, publier, dépublier, archiver). Il voit donc l'article en lecture seule : aucun champ, aucun bouton
// d'écriture, aucune action qui finirait refusée. Texte affiché tel quel (pas de Markdown interprété), comme une relecture.
export async function ArticleLectureSeule({ article }: { article: Article }) {
  const t = await getTranslations("Admin.blog.lecture");
  const statut = article.archiveLe ? "archive" : article.publieLe ? "publie" : "brouillon";
  const ts = await getTranslations("Admin.blog.statut");
  const format = await getFormatter();
  const bloc = (libelle: string, valeur: string | null) => (
    <div className="flex flex-col gap-1">
      <dt className="t-label uppercase text-text-secondary">{libelle}</dt>
      <dd className="t-body whitespace-pre-wrap text-text-primary [overflow-wrap:anywhere]">{valeur && valeur.trim() !== "" ? valeur : t("vide")}</dd>
    </div>
  );
  return (
    <div className="flex flex-col gap-6" data-article-lecture-seule="">
      <p role="note" className="t-body text-text-secondary">
        {t("note")}
      </p>
      <dl className="flex flex-col gap-4">
        {bloc(t("statut"), ts(statut))}
        {bloc(t("titreFr"), article.titreFr)}
        {bloc(t("titreEn"), article.titreEn)}
        {bloc(t("extraitFr"), article.extraitFr)}
        {bloc(t("extraitEn"), article.extraitEn)}
        {bloc(t("texteFr"), article.texteFr)}
        {bloc(t("texteEn"), article.texteEn)}
        {bloc(t("adresse"), article.slug)}
        {bloc(t("produitLie"), article.lienProduitId ? t("produitOui") : null)}
        {bloc(t("modifieLe"), format.dateTime(new Date(article.modifieLe), { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lubumbashi" }))}
        <div className="flex flex-col gap-1">
          <dt className="t-label uppercase text-text-secondary">{t("images")}</dt>
          <dd className="t-body text-text-primary">
            {article.images.length === 0 ? (
              t("vide")
            ) : (
              // Textes alternatifs (ce que l'Admin vérifie avant de publier) ; l'image elle-même reste dans la fiche de l'Admin.
              <ul className="flex flex-col gap-1">
                {article.images.map((image) => (
                  <li key={image.fichier} className="[overflow-wrap:anywhere]">
                    {image.altFr.trim() !== "" ? image.altFr : t("imageSansTexte")}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
