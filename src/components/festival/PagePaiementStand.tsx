import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { dependancesPaiementStand } from "@/modules/evenements/candidature-dependances";
import { lireRecapitulatifStand } from "@/modules/evenements/candidature-paiement";
import { lireCandidatureDuCompte } from "@/modules/evenements/candidature-queries";
import { FormulairePaiementStand } from "./FormulairePaiementStand";

const ADRESSE_VALIDE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Page de paiement d'un Stand accepté (story 7.11) : réservée au Compte du candidat (tout autre Compte, ou une adresse inconnue, voit un 404 sans
// rien apprendre). Le lien ne contient aucun secret. Tout (état, échéance, prix, réduction) est relu en base à la demande ; « Délai dépassé » vient de
// l'échéance enregistrée, jamais d'une horloge du navigateur.
export async function PagePaiementStand({ locale, slug, candidatureId }: { locale: Locale; slug: string; candidatureId: string }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Festival.stand" });
  if (slug.length > 80 || !ADRESSE_VALIDE.test(slug)) notFound();
  const retour = `/${locale}/festival/${slug}/stand/${candidatureId}`;
  const etatCompte = await lireEtatCompte();
  if (etatCompte === "anonyme" || etatCompte === "incomplet") redirect(`/${locale}/connexion?retour=${encodeURIComponent(retour)}`);
  const session = await lireSessionVerifiee();
  if (!session) redirect(`/${locale}/connexion?retour=${encodeURIComponent(retour)}`);

  let candidature;
  try {
    candidature = await lireCandidatureDuCompte(session.compteId, candidatureId);
  } catch {
    console.error("[candidature-stand] lecture de la candidature impossible");
    return <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>;
  }
  if (!candidature || candidature.evenementSlug !== slug) notFound();

  const lien = (
    <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
      {t("retourEvenement")}
    </Link>
  );
  if (candidature.etat === "payee") redirect(`/${locale}${cheminPublic(locale, "/compte")}/pass`);
  if (candidature.etat === "a_payer" && candidature.numeroCommande) {
    redirect(`/${locale}${cheminPublic(locale, "/commande")}/${encodeURIComponent(candidature.numeroCommande)}`);
  }
  if (candidature.etat === "refusee") {
    return (
      <div className="flex flex-col items-start gap-3">
        <MessageEtat type="information">{t("refusee")}</MessageEtat>
        {lien}
      </div>
    );
  }
  if (candidature.etat === "expiree") {
    return (
      <div className="flex flex-col items-start gap-3">
        <MessageEtat type="attention">{t("delaiDepasse")}</MessageEtat>
        <p className="t-small text-text-secondary">{t("delaiDepasseAide")}</p>
        {lien}
      </div>
    );
  }

  const deps = dependancesPaiementStand();
  const recap = await lireRecapitulatifStand(deps, { candidatureId, code: null }, locale);
  if (!recap.ok) {
    const cle = recap.erreur === "expiree" ? "delaiDepasse" : recap.erreur === "refusee" ? "refusee" : "erreurs.erreur";
    return (
      <div className="flex flex-col items-start gap-3">
        <MessageEtat type="erreur">{t(cle)}</MessageEtat>
        {lien}
      </div>
    );
  }
  let nomCompte: string | null = null;
  try {
    nomCompte = await deps.nomDuCompte(session.compteId);
  } catch {
    // Sans nom de Compte, l'exposant écrit son nom : rien n'est inventé.
    nomCompte = null;
  }
  return (
    <FormulairePaiementStand
      candidatureId={candidatureId}
      slug={slug}
      nomCompte={nomCompte}
      recapInitial={recap.recap}
      limite={formaterDateHeureBoutique(candidature.expireLe, locale) ?? ""}
      limiteIso={candidature.expireLe}
    />
  );
}
