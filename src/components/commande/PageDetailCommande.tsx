import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { lireCommande } from "@/modules/commande/queries";
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

  return (
    <div className="flex flex-col gap-6">
      <p className="t-label text-text-primary">{t("detail.statut", { statut: t(`detail.statuts.${commande.statut}`) })}</p>
      {commande.statut === "en_attente" && heure ? <p className="t-body text-text-primary">{t("detail.aPayerAvant", { heure })}</p> : null}
      {commande.statut === "expiree" ? (
        <div className="flex flex-col items-start gap-3">
          <MessageEtat type="attention">{t("detail.expiree")}</MessageEtat>
          <Link href={cheminPublic(locale, "/commande")} className={CLASSES_LIEN}>
            {t("detail.reprendre")}
          </Link>
        </div>
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
    </div>
  );
}
