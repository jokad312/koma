import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { lireNumeroCommandeAPayer } from "@/modules/commande/queries";
import { dependancesAchat } from "@/modules/evenements/achat-dependances";
import { lireEtatVente } from "@/modules/evenements/achat-queries";
import type { EtatVente } from "@/modules/evenements/achat-types";
import { lireEvenementPublie } from "@/modules/evenements/queries-publiques";
import { FormulaireAchatPass } from "./FormulaireAchatPass";

const ADRESSE_VALIDE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Adresse de cette page, pour la connexion : le client y revient après s'être connecté (et avoir déclaré son âge), FR-33.
export function retourVersAchat(locale: Locale, slug: string): string {
  return `/${locale}/festival/${slug}/acheter`;
}

function versConnexion(locale: Locale, slug: string): never {
  redirect(`/${locale}/connexion?retour=${encodeURIComponent(retourVersAchat(locale, slug))}`);
}

// Achat de Pass (story 7.4) : connexion requise, puis sélecteur de Pass. Tout (Types, prix, état de la vente) est relu en base à la demande.
// Aucun Type « Stand » n'est jamais proposé (candidature, story 7.11) ni aucun Pass gratuit. Le Panier n'est ni lu ni modifié.
export async function PageAchatPass({ locale, slug }: { locale: Locale; slug: string }) {
  const t = await getTranslations({ locale, namespace: "Festival.achat" });
  if (slug.length > 80 || !ADRESSE_VALIDE.test(slug)) notFound();

  const etatCompte = await lireEtatCompte();
  if (etatCompte === "anonyme" || etatCompte === "incomplet") versConnexion(locale, slug);
  const session = await lireSessionVerifiee();
  if (!session) versConnexion(locale, slug);

  let evenement;
  try {
    evenement = await lireEvenementPublie(locale, slug);
  } catch {
    console.error("[achat-pass] lecture de l'événement impossible");
    return <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>;
  }
  if (!evenement) notFound();

  // Une Commande est déjà à payer (de Pass ou de produits) : on y retourne, une seule à la fois.
  const aPayer = await lireNumeroCommandeAPayer(session.compteId).catch(() => null);
  if (aPayer) redirect(`/${locale}${cheminPublic(locale, "/commande")}/${encodeURIComponent(aPayer)}`);

  let etat: EtatVente | null;
  try {
    etat = await lireEtatVente(evenement.id);
  } catch {
    console.error("[achat-pass] état de la vente illisible");
    return <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>;
  }
  if (!etat) notFound();

  const lienRetour = (
    <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
      {t("retourEvenement")}
    </Link>
  );
  if (evenement.passe || etat.etat !== "ouverte") {
    const cle = etat.etat === "complet" ? "complet" : etat.etat === "a_venir" ? "pasEncore" : etat.etat === "aucun" ? "aucunPass" : "venteFermee";
    return (
      <div className="flex flex-col items-start gap-3">
        <MessageEtat type="information">{t(cle)}</MessageEtat>
        {lienRetour}
      </div>
    );
  }

  const types = evenement.types
    .filter((type) => !type.estStand && type.prixCents > 0)
    .map((type) => ({
      id: type.id,
      nom: type.nom,
      prixCents: type.prixCents,
      inclus: type.inclus,
      complet: etat.types.some((x) => x.id === type.id && x.complet),
    }));

  let nomCompte: string | null = null;
  try {
    nomCompte = await dependancesAchat().nomDuCompte(session.compteId);
  } catch {
    // Sans nom de Compte, l'acheteur écrit son nom : rien n'est inventé.
    nomCompte = null;
  }

  return <FormulaireAchatPass evenementId={evenement.id} slug={slug} nomCompte={nomCompte} types={types} />;
}
