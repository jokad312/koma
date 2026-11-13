import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CarteEvenement } from "@/components/festival/CarteEvenement";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import type { Locale } from "@/i18n/routing";
import { lireProchainEvenement } from "@/modules/evenements/queries-publiques";

// Bloc 5 « Rendez-vous otaku » de l'accueil (FR-2) : le prochain Événement à venir, en carte (photo, date, titre, lieu, lien).
// Aucun Événement à venir : le bloc n'existe pas (aucun titre, aucun texte, aucun espace).
// Une erreur de lecture masque le bloc (jamais une carte inventée, jamais une page d'accueil en erreur).
export async function BlocRendezVous({ locale, niveau = 2 }: { locale: Locale; niveau?: 2 | 3 }) {
  // Attend la vraie requête : pendant le prérendu de la coque, Next.js annulerait la lecture et le bloc serait figé « absent ».
  await connection();
  let evenement;
  try {
    evenement = await lireProchainEvenement(locale);
  } catch (e) {
    // Les signaux internes de Next.js (rendu dynamique, redirection) doivent remonter ; toute autre erreur masque le bloc.
    unstable_rethrow(e);
    console.error("[festival] lecture du prochain événement impossible : bloc masqué");
    return null;
  }
  if (!evenement) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.rendezVous" });
  return (
    <section id="rendez-vous" aria-labelledby="accueil-rendez-vous" className="flex scroll-mt-24 flex-col gap-4">
      <div id="accueil-rendez-vous">
        <TitreVitrine niveau={niveau}>{t("titre")}</TitreVitrine>
      </div>
      <div className="max-w-[520px]">
        <CarteEvenement evenement={evenement} niveau={niveau === 2 ? 3 : 4} />
      </div>
    </section>
  );
}
