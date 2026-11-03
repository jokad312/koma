import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BoutonWhatsApp } from "@/components/vitrine/BoutonWhatsApp";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { lireCommande } from "@/modules/commande/queries";
import { dependancesOptions } from "@/modules/paiement/dependances";
import { lireEtatPaiement } from "@/modules/paiement/etat-queries";
import { lireOptionsPaiement, type OptionsPaiement } from "@/modules/paiement/service";
import { lireNumeroWhatsappOuNull } from "@/lib/reglages";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";
import { construireFrise } from "@/modules/commande/frise";
import { DemandeAnnulation } from "./DemandeAnnulation";
import { EnvoiMesures } from "./EnvoiMesures";
import { FriseStatuts } from "./FriseStatuts";
import { MoyensPaiement } from "./MoyensPaiement";
import { SignalerProbleme } from "./SignalerProbleme";
import { SuiviPaiement } from "./SuiviPaiement";
import { retourVersCommande, versConnexion } from "./PageCommande";

const CLASSES_LIEN = "t-body inline-flex min-h-touch items-center text-text-primary underline";

// Détail d'une Commande du Compte connecté. « À payer avant [heure] » est un texte statique à l'heure de la boutique, sans compte à rebours
// (UX-DR35). Une Commande d'un autre Compte, ou inconnue, est introuvable. Les moyens de paiement arrivent avec la story 4.5.
export async function PageDetailCommande({ locale, numero }: { locale: Locale; numero: string }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Commande" });
  const etat = await lireEtatCompte();
  if (etat === "anonyme" || etat === "incomplet") versConnexion(locale, retourVersCommande(locale, `/${encodeURIComponent(numero)}`));
  const session = await lireSessionVerifiee();
  if (!session) versConnexion(locale, retourVersCommande(locale, `/${encodeURIComponent(numero)}`));

  let commande;
  try {
    commande = await lireCommande(session.compteId, numero, locale);
  } catch {
    console.error("[commande] lecture impossible");
    return <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>;
  }
  if (!commande) notFound();

  const heure = formaterDateHeureBoutique(commande.expireLe, locale);
  // Moyens de paiement : relus en base pour ce Compte (Familles comprises), seulement pour une Commande à payer. Erreur : message d'état.
  let options: OptionsPaiement | null = null;
  // État réel du paiement, lu par la base pour ce Compte : jamais l'adresse, jamais le navigateur (FR-20).
  let etatPaiement = null;
  try {
    etatPaiement = await lireEtatPaiement(session.compteId, numero);
  } catch {
    console.error("[paiement] lecture de l'état du paiement impossible");
  }
  const numeroWhatsapp = await lireNumeroWhatsappOuNull();
  // Sans état lu, aucun choix de moyen n'est proposé : une Tentative en cours pourrait exister (UX-DR36, jamais de double paiement).
  const choixPossible = etatPaiement !== null && (etatPaiement.phase === "a_payer" || etatPaiement.phase === "echec");
  if (choixPossible) {
    try {
      options = await lireOptionsPaiement(dependancesOptions(), { commandeId: commande.id, compteId: session.compteId });
    } catch {
      console.error("[paiement] lecture des moyens de paiement impossible");
    }
  }

  const physique = commande.lignes.some((l) => l.famille !== "kit");
  const etapes = construireFrise({ statut: commande.statut, physique, fabrication: commande.lignes.some((l) => l.origine === "fabrication"), dates: commande.dates });
  const retraitGoma = commande.mode === "retrait";
  // Lignes Sur-mesure : la date de réception n'existe que quand toutes ont été confirmées par l'admin.
  const lignesSurMesure = commande.lignes.filter((l) => l.taille === "sur_mesure");
  const surMesure = lignesSurMesure.length > 0;
  const mesuresRecuesLe = surMesure && lignesSurMesure.every((l) => l.mesuresRecuesLe !== null) ? (lignesSurMesure.map((l) => l.mesuresRecuesLe as string).sort().at(-1) ?? null) : null;
  const libelleStatut = commande.offerte ? t("detail.offert") : commande.statut === "expediee" && retraitGoma ? t("frise.etapes.pretARetirer") : t(`detail.statuts.${commande.statut}`);

  return (
    <div className="flex flex-col gap-6">
      <p className="t-label text-text-primary">{t("detail.statut", { statut: libelleStatut })}</p>
      <FriseStatuts etapes={etapes} retraitGoma={retraitGoma} locale={locale} />
      {commande.numeroSuivi ? (
        <p className="t-body text-text-primary">
          {t("detail.numeroSuivi")} <span>{commande.numeroSuivi}</span>
        </p>
      ) : null}
      {commande.statut === "en_attente" && heure ? <p className="t-body text-text-primary">{t("detail.aPayerAvant", { heure })}</p> : null}
      {commande.statut === "expiree" ? (
        <div className="flex flex-col items-start gap-3">
          <MessageEtat type="attention">{t("detail.expiree")}</MessageEtat>
          <Link href={cheminPublic(locale, "/commande")} className={CLASSES_LIEN}>
            {t("detail.reprendre")}
          </Link>
        </div>
      ) : null}

      {commande.lignesReclamables.length > 0 ? (
        <SignalerProbleme numero={commande.numero} lignes={commande.lignes.filter((l) => commande.lignesReclamables.includes(l.id)).map((l) => ({ id: l.id, titre: l.titre }))} lienWhatsapp={lienWhatsapp(numeroWhatsapp)} />
      ) : null}
      {commande.reclamations.length > 0 ? (
        <section aria-labelledby="commande-reclamations" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 id="commande-reclamations" className="t-h2">
            {t("reclamation.suivi")}
          </h2>
          <ul className="flex flex-col gap-1">
            {commande.reclamations.map((r) => (
              <li key={`${r.ligneId}-${r.statut}`} className="t-body text-text-primary">
                {t("reclamation.ligneEtat", { titre: commande.lignes.find((l) => l.id === r.ligneId)?.titre ?? "", etat: t(`reclamation.statuts.${["ouverte", "acceptee", "refusee", "article_rendu", "remplacement_remis"].includes(r.statut) ? r.statut : "ouverte"}`) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {commande.annulable ? <DemandeAnnulation numero={commande.numero} /> : null}
      {commande.demandeAnnulation === "ouverte" ? <MessageEtat type="information">{t("annulation.ouverte")}</MessageEtat> : null}
      {commande.demandeAnnulation === "refusee" ? <MessageEtat type="information">{t("annulation.refusee")}</MessageEtat> : null}

      {surMesure && ["payee", "en_fabrication"].includes(commande.statut) ? (
        <EnvoiMesures numero={commande.numero} numeroWhatsapp={numeroWhatsapp} mesuresRecuesLe={mesuresRecuesLe} locale={locale} />
      ) : null}

      <section aria-labelledby="commande-lignes" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="commande-lignes" className="t-h2">
          {t("recap.titre")}
        </h2>
        <ul aria-label={t("recap.liste")} className="flex flex-col gap-3">
          {commande.lignes.map((l, i) => (
            <li key={`${l.slug}-${l.taille ?? "kit"}-${i}`} className="flex flex-col gap-1">
              <p className="t-label text-text-primary">{l.titre}</p>
              {l.famille !== "kit" ? <p className="t-small text-text-secondary">{l.taille === "sur_mesure" ? t("recap.tailleSurMesure") : t("recap.taille", { taille: l.taille ?? "" })}</p> : null}
              <p className="t-body text-text-primary">{t("recap.quantitePrix", { nombre: l.nombre, prix: formaterUsd(l.prixCents, locale) })}</p>
              {l.origine === "fabrication" && l.delaiFabricationJours !== null ? (
                <p className="t-small text-text-secondary">
                  {t(l.taille === "sur_mesure" ? "recap.delaiFabricationSurMesure" : "recap.delaiFabrication", {
                    n: l.delaiFabricationJours,
                    remise: t(`recap.remise.${commande.zone === "bukavu" ? "bukavu" : commande.zone === "goma" ? (commande.mode === "retrait" ? "retrait" : "gomaLivraison") : "inconnue"}`),
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between gap-4">
            <dt className="t-body text-text-primary">{t("recap.sousTotal")}</dt>
            <dd className="t-body text-text-primary">{formaterUsd(commande.sousTotalCents, locale)}</dd>
          </div>
          {commande.zone ? (
            <div className="flex justify-between gap-4">
              <dt className="t-body text-text-primary">{t("recap.forfait")}</dt>
              <dd className="t-body text-text-primary">{commande.forfaitCents === 0 ? t("recap.forfaitGratuit") : formaterUsd(commande.forfaitCents, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="t-h3 text-text-primary">{t("recap.total")}</dt>
            <dd className="t-price-card text-text-primary">{formaterUsd(commande.totalCents, locale)}</dd>
          </div>
        </dl>
      </section>

      <div>
        <BoutonWhatsApp numero={numeroWhatsapp} />
      </div>

      {etatPaiement && !commande.offerte ? <SuiviPaiement numero={commande.numero} etatInitial={etatPaiement} numeroWhatsapp={numeroWhatsapp} /> : commande.offerte ? null : <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>}

      {choixPossible ? (options ? <MoyensPaiement numero={commande.numero} options={options} /> : <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>) : null}
    </div>
  );
}
