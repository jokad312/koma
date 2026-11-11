import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { lireEtatVente } from "@/modules/evenements/achat-queries";
import type { EtatVente } from "@/modules/evenements/achat-types";
import { lireEvenementPublie } from "@/modules/evenements/queries-publiques";
import { FormulaireCandidature } from "./FormulaireCandidature";

const ADRESSE_VALIDE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Adresse de cette page, pour la connexion : l'exposant y revient après s'être connecté (et avoir déclaré son âge).
export function retourVersCandidature(locale: Locale, slug: string): string {
  return `/${locale}/festival/${slug}/candidater`;
}

function versConnexion(locale: Locale, slug: string): never {
  redirect(`/${locale}/connexion?retour=${encodeURIComponent(retourVersCandidature(locale, slug))}`);
}

// Candidature Stand (story 7.11) : connexion requise, puis formulaire. Les Types « Stand », leurs prix et l'état de la vente sont relus en base à
// la demande (jamais en cache). Toute personne ayant un Compte peut candidater tant qu'il reste des Stands.
export async function PageCandidature({ locale, slug }: { locale: Locale; slug: string }) {
  const t = await getTranslations({ locale, namespace: "Festival.candidature" });
  if (slug.length > 80 || !ADRESSE_VALIDE.test(slug)) notFound();

  const etatCompte = await lireEtatCompte();
  if (etatCompte === "anonyme" || etatCompte === "incomplet") versConnexion(locale, slug);
  const session = await lireSessionVerifiee();
  if (!session) versConnexion(locale, slug);

  let evenement;
  try {
    evenement = await lireEvenementPublie(locale, slug);
  } catch {
    console.error("[candidature-stand] lecture de l'événement impossible");
    return <MessageEtat type="erreur">{t("erreurs.generique")}</MessageEtat>;
  }
  if (!evenement) notFound();
  const stands = evenement.types.filter((x) => x.estStand && x.prixCents > 0);
  if (stands.length === 0) notFound();

  let etat: EtatVente | null;
  try {
    etat = await lireEtatVente(evenement.id);
  } catch {
    console.error("[candidature-stand] état de la vente illisible");
    return <MessageEtat type="erreur">{t("erreurs.generique")}</MessageEtat>;
  }
  if (!etat) notFound();

  const lienRetour = (
    <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
      {t("retourEvenement")}
    </Link>
  );
  if (evenement.passe || etat.etat === "a_venir" || etat.etat === "fermee") {
    return (
      <div className="flex flex-col items-start gap-3">
        <MessageEtat type="information">{etat.etat === "a_venir" ? t("pasEncore") : t("venteFermee")}</MessageEtat>
        {lienRetour}
      </div>
    );
  }

  const types = stands.map((x) => ({ id: x.id, nom: x.nom, prixCents: x.prixCents, inclus: x.inclus, complet: etat.types.some((y) => y.id === x.id && y.complet) }));
  return (
    <div className="flex flex-col gap-4">
      <p className="t-body text-text-secondary">{t("intro")}</p>
      <FormulaireCandidature evenementId={evenement.id} slug={slug} types={types} />
    </div>
  );
}
