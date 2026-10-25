import { getLocale, getTranslations } from "next-intl/server";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import type { ProduitListe } from "@/modules/catalogue/types";
import { PastilleStatut } from "./PastilleStatut";

// Liste des produits : tableau (caption, th scope) à partir de md, cartes sur mobile. Un seul des deux est visible à la fois (display: none
// retire l'autre des lecteurs d'écran). Nombre annoncé en statut ; état vide avec bouton de création.
export async function ListeProduits({ produits }: { produits: readonly ProduitListe[] }) {
  const t = await getTranslations("Admin.produits");
  const locale = (await getLocale()) as "fr" | "en";

  if (produits.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        <Bouton href="/admin/produits/nouveau">{t("vide.creer")}</Bouton>
      </div>
    );
  }

  const prix = (cents: number | null) => (cents === null ? t("prixAFixer") : formaterUsd(cents, locale));
  const statut = (p: ProduitListe) => (
    <PastilleStatut publie={p.publieLe !== null} libelle={t(p.publieLe === null ? "statut.brouillon" : "statut.publie")} />
  );

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="t-small text-text-secondary">
        {t("nombre", { nombre: produits.length })}
      </p>

      <ul className="flex flex-col gap-ecart-cartes md:hidden">
        {produits.map((p) => (
          <li key={p.id} className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-5">
            <h2 className="t-h2">
              <Link href={`/admin/produits/${p.id}`} className="inline-flex min-h-touch items-center underline">
                {p.titreFr}
              </Link>
            </h2>
            <p className="t-small text-text-secondary">{t(`famille.${p.famille}`)}</p>
            {statut(p)}
            <p className="t-body text-text-primary">{prix(p.prixCents)}</p>
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
                {t("liste.colonnes.famille")}
              </th>
              <th scope="col" className="t-label px-3 py-2">
                {t("liste.colonnes.statut")}
              </th>
              <th scope="col" className="t-label px-3 py-2">
                {t("liste.colonnes.prix")}
              </th>
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <th scope="row" className="px-3 py-2 font-semibold">
                  <Link href={`/admin/produits/${p.id}`} className="inline-flex min-h-touch items-center underline">
                    {p.titreFr}
                  </Link>
                </th>
                <td className="px-3 py-2">{t(`famille.${p.famille}`)}</td>
                <td className="px-3 py-2">{statut(p)}</td>
                <td className="px-3 py-2">{prix(p.prixCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
