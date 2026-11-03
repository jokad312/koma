import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import type { CommandeAdminDetail } from "@/modules/commande/admin-queries";
import { FormulaireAdresseCommande } from "./FormulaireAdresseCommande";

// Détail d'une Commande pour l'admin (story 6.2). Le bloc Paiement est en lecture seule : aucun champ, aucun bouton ne permet de poser « payée » (règle 2).
export function DetailCommandeAdmin({ commande, locale }: { commande: CommandeAdminDetail; locale: "fr" | "en" }) {
  const t = useTranslations("Admin.commandes");
  const ts = useTranslations("Commande.detail.statuts");
  const tr = useTranslations("Commande.recap");
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/commandes" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
        {t("retour")}
      </Link>
      <h1 className="t-h1">{t("detail.titre", { numero: commande.numero })}</h1>
      <p className="t-small inline-flex w-fit items-center rounded-full border border-border-field px-3 py-1 text-text-primary">{commande.offerte ? t("offerte") : ts(commande.statut)}</p>

      <section aria-labelledby="adm-lignes" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="adm-lignes" className="t-h2">
          {t("detail.lignes")}
        </h2>
        <ul className="flex flex-col gap-3">
          {commande.lignes.map((l, i) => (
            <li key={`${l.titre}-${i}`} className="flex flex-col gap-1">
              <p className="t-label text-text-primary">{l.titre}</p>
              {l.famille !== "kit" ? <p className="t-small text-text-secondary">{l.taille === "sur_mesure" ? tr("tailleSurMesure") : tr("taille", { taille: l.taille ?? "" })}</p> : null}
              <p className="t-body text-text-primary">{tr("quantitePrix", { nombre: l.nombre, prix: formaterUsd(l.prixCents, locale) })}</p>
              {l.origine ? <p className="t-small text-text-secondary">{t(`origines.${l.origine === "fabrication" ? "fabrication" : "stock"}`)}</p> : null}
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1">
          <div className="flex justify-between gap-4">
            <dt className="t-body">{tr("sousTotal")}</dt>
            <dd className="t-body">{formaterUsd(commande.sousTotalCents, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="t-body">{tr("forfait")}</dt>
            <dd className="t-body">{formaterUsd(commande.forfaitCents, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="t-h3">{tr("total")}</dt>
            <dd className="t-body">{formaterUsd(commande.totalCents, locale)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="adm-remise" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="adm-remise" className="t-h2">
          {t("detail.remise")}
        </h2>
        <dl className="flex flex-col gap-1">
          <div>
            <dt className="t-small text-text-secondary">{t("detail.zoneMode")}</dt>
            <dd className="t-body">{commande.zone ? `${t(`zones.${commande.zone === "bukavu" ? "bukavu" : "goma"}`)} · ${t(`modes.${commande.modeRemise === "retrait" ? "retrait" : "livraison"}`)}` : t("sansRemise")}</dd>
          </div>
          <div>
            <dt className="t-small text-text-secondary">{t("detail.telephone")}</dt>
            <dd className="t-body">{commande.telephone ?? t("detail.absent")}</dd>
          </div>
          <div>
            <dt className="t-small text-text-secondary">{t("detail.adresse")}</dt>
            <dd className="t-body">{commande.adresse ?? t("detail.absent")}</dd>
          </div>
        </dl>
        {commande.modeRemise === "livraison" ? <FormulaireAdresseCommande numero={commande.numero} adresse={commande.adresse ?? ""} /> : null}
      </section>

      <section aria-labelledby="adm-paiement" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="adm-paiement" className="t-h2">
          {t("paiement.titre")}
        </h2>
        {commande.offerte ? (
          <p className="t-body">{t("paiement.offerte")}</p>
        ) : (
          <dl className="flex flex-col gap-1">
            <div>
              <dt className="t-small text-text-secondary">{t("paiement.prestataire")}</dt>
              <dd className="t-body">{commande.prestataire ?? t("detail.absent")}</dd>
            </div>
            <div>
              <dt className="t-small text-text-secondary">{t("paiement.moyen")}</dt>
              <dd className="t-body">{commande.moyen ? t(`paiement.moyens.${commande.moyen === "carte" ? "carte" : "mobile_money"}`) : t("detail.absent")}</dd>
            </div>
            <div>
              <dt className="t-small text-text-secondary">{t("paiement.reference")}</dt>
              <dd className="t-body break-all">{commande.referenceTransaction ?? t("detail.absent")}</dd>
            </div>
            <div>
              <dt className="t-small text-text-secondary">{t("paiement.montant")}</dt>
              <dd className="t-body">
                {`${formaterUsd(commande.totalCents, locale)} (${commande.devise})`}
              </dd>
            </div>
            <div>
              <dt className="t-small text-text-secondary">{t("paiement.confirmeLe")}</dt>
              <dd className="t-body">{formaterDateHeureBoutique(commande.payeLe, locale) ?? t("detail.absent")}</dd>
            </div>
          </dl>
        )}
        <p className="t-small text-text-secondary">{t("paiement.regle")}</p>
      </section>
    </div>
  );
}
