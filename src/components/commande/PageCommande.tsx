import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { cheminPublic } from "@/i18n/adresses";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { lireRetraitGoma } from "@/lib/reglages";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { lireRecapitulatif } from "@/modules/commande/actions";
import { lireRemiseReprise } from "@/modules/commande/queries";
import { origineSchema } from "@/modules/commande/schemas";
import type { ModeRemise, ZoneRemise } from "@/modules/commande/schemas";
import { FormulaireCommande } from "./FormulaireCommande";

// Adresse complète de cette page pour la connexion : le client y revient après s'être connecté (et avoir déclaré son âge), FR-12.
export function retourVersCommande(locale: Locale, suite = ""): string {
  return `/${locale}${cheminPublic(locale, "/commande")}${suite}`;
}

export function versConnexion(locale: Locale, retour: string): never {
  redirect(`/${locale}/connexion?retour=${encodeURIComponent(retour)}`);
}

// Étape de commande : un visiteur non connecté ou au Compte incomplet passe par la connexion, puis revient ici. Les champs de livraison
// n'existent que pour un Panier avec produit physique. Zone, Mode, téléphone et adresse de la dernière commande sont repris (FR-13).
export async function PageCommande({ locale, origine }: { locale: Locale; origine: string | undefined }) {
  const etat = await lireEtatCompte();
  if (etat === "anonyme" || etat === "incomplet") versConnexion(locale, retourVersCommande(locale));
  const session = await lireSessionVerifiee();
  if (!session) versConnexion(locale, retourVersCommande(locale));

  const reprise = await lireRemiseReprise(session.compteId).catch(() => null);
  const zone: ZoneRemise | null = reprise?.zone ?? null;
  const mode: ModeRemise | null = zone && reprise?.mode && !(zone === "bukavu" && reprise.mode === "retrait") ? reprise.mode : null;

  let resultat = await lireRecapitulatif(zone && mode ? { zone, mode } : {}, locale);
  // Un Panier vide ne fait pas une commande : retour au Panier.
  if (!resultat.ok && resultat.erreur === "panier_vide") redirect(`/${locale}${cheminPublic(locale, "/panier")}`);
  if (!resultat.ok && resultat.erreur === "non_connecte") versConnexion(locale, retourVersCommande(locale));
  if (!resultat.ok && zone && mode) resultat = await lireRecapitulatif({}, locale);
  if (!resultat.ok) {
    const t = await getTranslations({ locale, namespace: "Commande" });
    return <MessageEtat type="erreur">{t(`erreurs.${resultat.erreur}`)}</MessageEtat>;
  }

  const lieuRetrait = await lireRetraitGoma(locale).catch(() => null);
  const origineValide = origine && origineSchema.safeParse(origine).success ? origine : null;

  return (
    <FormulaireCommande
      recapInitial={resultat.recap}
      zoneInitiale={zone && mode ? zone : null}
      modeInitial={zone && mode ? mode : null}
      telephoneInitial={reprise?.telephone ?? ""}
      adresseInitiale={mode === "livraison" ? (reprise?.adresse ?? "") : ""}
      lieuRetrait={lieuRetrait}
      origine={origineValide}
    />
  );
}
