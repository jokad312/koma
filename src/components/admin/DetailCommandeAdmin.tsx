import { useTranslations } from "next-intl";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import type { CommandeAdminDetail } from "@/modules/commande/admin-queries";
import { transitionsPossibles } from "@/modules/commande/transitions";
import { AvancementCommande } from "./AvancementCommande";
import { BoutonMesuresRecues } from "./BoutonMesuresRecues";
import { DecisionDemande, FormulaireRemboursement } from "./DemandeEtRemboursement";
import { EtapesReclamation } from "./EtapesReclamation";
import { FormulaireAdresseCommande } from "./FormulaireAdresseCommande";

// Détail d'une Commande pour l'admin (story 6.2). Le bloc Paiement est en lecture seule : aucun champ, aucun bouton ne permet de poser « payée » (règle 2).
export function DetailCommandeAdmin({ commande, locale, numeroWhatsappAbsent }: { commande: CommandeAdminDetail; locale: "fr" | "en"; numeroWhatsappAbsent: boolean }) {
  const t = useTranslations("Admin.commandes");
  const ts = useTranslations("Commande.detail.statuts");
  const tr = useTranslations("Commande.recap");
  const physiques = commande.lignes.filter((l) => l.origine !== null);
  const transitions = transitionsPossibles({ statut: commande.statut, offerte: commande.offerte, lignesPhysiques: physiques.length, lignesFabriquees: physiques.filter((l) => l.origine === "fabrication").length });
  const mesuresManquantes = physiques.some((l) => l.taille === "sur_mesure" && l.mesuresRecuesLe === null);
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/commandes" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
        {t("retour")}
      </Link>
      <h1 className="t-h1">{t("detail.titre", { numero: commande.numero })}</h1>
      <p className="t-small inline-flex w-fit items-center rounded-full border border-border-field px-3 py-1 text-text-primary">{commande.offerte ? t("offerte") : ts(commande.statut)}</p>

      {commande.lignes.some((l) => l.taille === "sur_mesure") && numeroWhatsappAbsent ? <MessageEtat type="attention">{t("mesures.numeroAbsent")}</MessageEtat> : null}

      <section aria-labelledby="adm-avancement" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="adm-avancement" className="t-h2">
          {t("avancement.titre")}
        </h2>
        {commande.numeroSuivi ? <p className="t-body">{t("avancement.suiviEnregistre", { suivi: commande.numeroSuivi })}</p> : null}
        <AvancementCommande numero={commande.numero} transitions={transitions} mesuresManquantes={mesuresManquantes} retrait={commande.modeRemise === "retrait"} />
      </section>

      {commande.demandeAnnulation || commande.remboursement || commande.tropPercus.length > 0 || commande.annulationsPass.length > 0 ? (
        <section aria-labelledby="adm-argent" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 id="adm-argent" className="t-h2">
            {t("annulation.titre")}
          </h2>
          {commande.demandeAnnulation ? (
            <div className="flex flex-col gap-2">
              <p className="t-body">{t(`annulation.statuts.${commande.demandeAnnulation.statut === "ouverte" ? "ouverte" : commande.demandeAnnulation.statut === "refusee" ? "refusee" : commande.demandeAnnulation.statut === "acceptee" ? "acceptee" : "close"}`)}</p>
              {commande.demandeAnnulation.statut === "ouverte" ? <DecisionDemande demandeId={commande.demandeAnnulation.id} /> : null}
            </div>
          ) : null}
          {commande.remboursement ? (
            <div className="flex flex-col gap-2">
              <p className="t-body">{t("remboursement.montant", { montant: formaterUsd(commande.remboursement.montantCents, locale) })}</p>
              {commande.remboursement.valide ? <p className="t-label">{t("remboursement.confirme")}</p> : commande.statut === "annulee" ? <FormulaireRemboursement cibleType="commande" cibleId={commande.id} /> : null}
            </div>
          ) : null}
          {commande.annulationsPass.map((a) => (
            <div key={a.demandeId} className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="t-label">{t("annulationPass.ligne", { nom: a.nomTitulaire })}</p>
              <p className="t-body">{t(`annulationPass.statuts.${["ouverte", "acceptee", "refusee", "close"].includes(a.statut) ? a.statut : "close"}`)}</p>
              {a.statut === "ouverte" ? <DecisionDemande demandeId={a.demandeId} /> : null}
              {a.remboursement ? (
                <>
                  <p className="t-body">{t("annulationPass.montant", { montant: formaterUsd(a.remboursement.montantCents, locale) })}</p>
                  {a.remboursement.valide ? <p className="t-label">{t("remboursement.confirme")}</p> : <FormulaireRemboursement cibleType="pass" cibleId={a.passId} />}
                </>
              ) : null}
            </div>
          ))}
          {commande.tropPercus.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="t-body">{t("remboursement.tropPercu", { montant: `${p.montantRecu} ${p.devise}`, motif: t(`remboursement.motifs.${["montant_superieur", "deja_payee", "expiree", "annulee", "reservations_liberees"].includes(p.motif) ? p.motif : "autre"}`) })}</p>
              <FormulaireRemboursement cibleType="trop_percu" cibleId={p.id} />
            </div>
          ))}
        </section>
      ) : null}

      {commande.reclamations.length > 0 ? (
        <section aria-labelledby="adm-reclamations" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 id="adm-reclamations" className="t-h2">
            {t("reclamation.titre")}
          </h2>
          <ul className="flex flex-col gap-4">
            {commande.reclamations.map((r) => (
              <li key={r.id} className="flex flex-col gap-2">
                <p className="t-label text-text-primary">{r.ligneTitre}</p>
                <p className="t-small text-text-secondary">{t(`reclamation.statuts.${["ouverte", "acceptee", "refusee", "article_rendu", "remplacement_remis"].includes(r.statut) ? r.statut : "ouverte"}`)}</p>
                <p className="t-body whitespace-pre-line">{r.description}</p>
                <EtapesReclamation demandeId={r.id} statut={r.statut} nombre={r.ligneNombre} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
              {l.taille === "sur_mesure" ? (
                l.mesuresRecuesLe ? (
                  <p className="t-small text-text-primary">{t("mesures.recuesLe", { date: formaterDateHeureBoutique(l.mesuresRecuesLe, locale) ?? "" })}</p>
                ) : ["payee", "en_fabrication"].includes(commande.statut) ? (
                  <BoutonMesuresRecues ligneId={l.id} />
                ) : null
              ) : null}
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1">
          <div className="flex justify-between gap-4">
            <dt className="t-body">{tr("sousTotal")}</dt>
            <dd className="t-body">{formaterUsd(commande.sousTotalCents, locale)}</dd>
          </div>
          {commande.codePromo && commande.codePromo.reductionCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="t-body">{tr("reduction", { code: commande.codePromo.code })}</dt>
              <dd className="t-body">{tr("reductionMontant", { montant: formaterUsd(commande.codePromo.reductionCents, locale) })}</dd>
            </div>
          ) : null}
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
