import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Bouton } from "@/components/ui/Bouton";
import type { Locale } from "@/i18n/routing";
import { lireEtatVente } from "@/modules/evenements/achat-queries";
import type { EtatVente } from "@/modules/evenements/achat-types";
import type { EvenementPublic } from "@/modules/evenements/types";

type Props = { evenement: Pick<EvenementPublic, "id" | "slug" | "passe" | "types">; locale: Locale };

// Bouton d'achat de la page d'un Événement (story 7.4). Sa seule donnée, l'état de la vente (dates, Capacité, quotas), est relue en base à chaque
// requête (AD-17) : le composant se place sous Suspense et le reste de la page reste en cache. Aucun compteur de places n'est montré.
// Une erreur de lecture n'affiche aucun bouton : jamais un bouton ou un « Complet » inventé. « Me prévenir » (story 7.3) reste géré par la page
// tant que la vente n'est pas ouverte.
export async function AchatEvenement({ evenement, locale }: Props) {
  await connection();
  if (evenement.passe) return null;
  let etat: EtatVente | null;
  try {
    etat = await lireEtatVente(evenement.id);
  } catch {
    console.error("[festival] état de la vente illisible");
    return null;
  }
  if (!etat || etat.etat === "a_venir" || etat.etat === "aucun") return null;
  const t = await getTranslations({ locale, namespace: "Festival.achat" });

  if (etat.etat === "fermee") {
    return (
      <p role="status" className="t-label text-text-primary">
        {t("venteFermee")}
      </p>
    );
  }
  if (etat.etat === "complet") {
    return (
      <p role="status" className="t-label text-text-primary">
        {t("complet")}
      </p>
    );
  }
  // Vente ouverte : le bouton, et les Types achetables dont le quota est atteint. Un Stand n'est jamais proposé ici (candidature, story 7.11).
  const complets = evenement.types.filter((type) => !type.estStand && type.prixCents > 0 && etat.types.some((x) => x.id === type.id && x.complet));
  return (
    <div className="flex flex-col items-start gap-3">
      <Bouton href={`/festival/${evenement.slug}/acheter`}>{t("bouton")}</Bouton>
      {complets.length > 0 ? (
        <ul className="t-small flex flex-col gap-1 text-text-secondary">
          {complets.map((type) => (
            <li key={type.id}>{t("typeComplet", { nom: type.nom })}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
