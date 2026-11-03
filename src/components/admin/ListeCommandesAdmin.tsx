import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { FAMILLES_FILTRE, PRESTATAIRES_FILTRE, STATUTS_FILTRE, TAILLE_PAGE_ADMIN, ZONES_FILTRE, type CommandeAdminResume, type FiltresCommandes } from "@/modules/commande/admin-queries";

const CHAMP = "min-h-touch rounded-md border border-border-field bg-surface px-3";

function Choix({ nom, libelle, valeur, options, tout }: { nom: string; libelle: string; valeur: string | undefined; options: readonly { cle: string; texte: string }[]; tout: string }) {
  return (
    <label className="flex flex-col gap-1 t-small text-text-primary">
      {libelle}
      <select name={nom} defaultValue={valeur ?? ""} className={CHAMP}>
        <option value="">{tout}</option>
        {options.map((o) => (
          <option key={o.cle} value={o.cle}>
            {o.texte}
          </option>
        ))}
      </select>
    </label>
  );
}

// Filtres en formulaire GET (fonctionne sans JavaScript), nombre de résultats annoncé, « Voir plus » par 12 : tableau sur ordinateur, cartes sur mobile.
export function ListeCommandesAdmin({ commandes, total, filtres, nombre, locale }: { commandes: CommandeAdminResume[]; total: number; filtres: FiltresCommandes; nombre: number; locale: "fr" | "en" }) {
  const t = useTranslations("Admin.commandes");
  const ts = useTranslations("Commande.detail.statuts");
  const avecFiltre = Boolean(filtres.statut || filtres.famille || filtres.prestataire || filtres.zone);
  const suite = new URLSearchParams();
  for (const [cle, v] of Object.entries(filtres)) if (v) suite.set(cle, v);
  suite.set("n", String(nombre + TAILLE_PAGE_ADMIN));
  const remise = (c: CommandeAdminResume) => (c.zone ? `${t(`zones.${c.zone === "bukavu" ? "bukavu" : "goma"}`)} · ${t(`modes.${c.modeRemise === "retrait" ? "retrait" : "livraison"}`)}` : t("sansRemise"));
  const nomPrestataire = (c: CommandeAdminResume) => (c.offerte ? t("offerte") : (c.prestataire ?? t("aucun")));

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("filtres")}>
        <Choix nom="statut" libelle={t("statut")} valeur={filtres.statut} tout={t("tous")} options={STATUTS_FILTRE.map((s) => ({ cle: s, texte: ts(s) }))} />
        <Choix nom="famille" libelle={t("famille")} valeur={filtres.famille} tout={t("toutes")} options={FAMILLES_FILTRE.map((f) => ({ cle: f, texte: t(`familles.${f}`) }))} />
        <Choix nom="prestataire" libelle={t("prestataire")} valeur={filtres.prestataire} tout={t("tous")} options={PRESTATAIRES_FILTRE.map((p) => ({ cle: p, texte: p === "pawapay" ? "PawaPay" : p === "maishapay" ? "MaishaPay" : "Polar" }))} />
        <Choix nom="zone" libelle={t("zone")} valeur={filtres.zone} tout={t("toutes")} options={ZONES_FILTRE.map((z) => ({ cle: z, texte: t(`zones.${z}`) }))} />
        <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="min-h-touch rounded-md border border-border-field px-4 t-label text-text-primary">
            {t("appliquer")}
          </button>
          {avecFiltre ? (
            <Link href="/admin/commandes" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
              {t("effacer")}
            </Link>
          ) : null}
        </div>
      </form>

      <p role="status" className="t-label text-text-primary">
        {t("resultats", { nombre: total })}
      </p>

      {commandes.length === 0 ? (
        <p className="t-body text-text-secondary">{t("vide")}</p>
      ) : (
        <>
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">{t("titre")}</caption>
            <thead>
              <tr className="t-small text-text-secondary">
                <th scope="col" className="py-2 pr-4">{t("colonnes.numero")}</th>
                <th scope="col" className="py-2 pr-4">{t("colonnes.date")}</th>
                <th scope="col" className="py-2 pr-4">{t("colonnes.statut")}</th>
                <th scope="col" className="py-2 pr-4">{t("colonnes.remise")}</th>
                <th scope="col" className="py-2 pr-4">{t("colonnes.prestataire")}</th>
                <th scope="col" className="py-2 text-right">{t("colonnes.total")}</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => (
                <tr key={c.numero} className="border-t border-border">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <Link href={`/admin/commandes/${c.numero}`} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                      {c.numero}
                    </Link>
                  </th>
                  <td className="t-small py-2 pr-4">{formaterDateHeureBoutique(c.creeLe, locale)}</td>
                  <td className="t-small py-2 pr-4">{ts(c.statut)}</td>
                  <td className="t-small py-2 pr-4">{remise(c)}</td>
                  <td className="t-small py-2 pr-4">{nomPrestataire(c)}</td>
                  <td className="t-small py-2 text-right">{formaterUsd(c.totalCents, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul aria-label={t("titre")} className="flex flex-col gap-3 md:hidden">
            {commandes.map((c) => (
              <li key={c.numero} className="rounded-lg border border-border bg-surface p-4">
                <Link href={`/admin/commandes/${c.numero}`} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                  {c.numero}
                </Link>
                <p className="t-small text-text-secondary">{formaterDateHeureBoutique(c.creeLe, locale)}</p>
                <p className="t-body text-text-primary">{ts(c.statut)}</p>
                <p className="t-small text-text-secondary">{remise(c)}</p>
                <p className="t-small text-text-secondary">{nomPrestataire(c)}</p>
                <p className="t-body text-text-primary">{formaterUsd(c.totalCents, locale)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {total > commandes.length ? (
        <Link href={`/admin/commandes?${suite.toString()}`} className="t-body inline-flex min-h-touch items-center text-text-primary underline">
          {t("voirPlus")}
        </Link>
      ) : null}
    </div>
  );
}
