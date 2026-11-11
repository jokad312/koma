import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Squelette } from "@/components/ui/Squelette";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte } from "@/lib/auth/compte";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { FormulairePrevenir } from "./FormulairePrevenir";

type Props = { evenementId: string; venteOuvreLe: string | null; locale: Locale };

// Lit l'état du Compte au moment de la requête (sous Suspense) : « Avec mon compte » n'est proposé qu'à un Compte complet.
async function FormulaireSelonCompte({ evenementId }: { evenementId: string }) {
  const etat = await lireEtatCompte();
  return <FormulairePrevenir evenementId={evenementId} connecte={etat === "complet" || etat === "questions"} />;
}

// Bloc « Me prévenir » d'une page Événement (story 7.3). Affiché seulement tant que la vente des Pass n'est pas ouverte.
// L'ancre #prevenir reçoit les liens « Me prévenir » des cartes de la liste Festival et de l'accueil.
export async function BlocPrevenir({ evenementId, venteOuvreLe, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "Festival.prevenir" });
  const date = venteOuvreLe ? formaterDateHeureBoutique(venteOuvreLe, locale) : null;
  return (
    <section id="prevenir" aria-labelledby="festival-prevenir" className="flex max-w-[720px] scroll-mt-24 flex-col gap-3">
      <h2 id="festival-prevenir" className="t-h2">
        {t("titre")}
      </h2>
      {date ? <p className="t-body text-text-primary">{t("ouvertureLe", { date })}</p> : null}
      <Suspense fallback={<Squelette />}>
        <FormulaireSelonCompte evenementId={evenementId} />
      </Suspense>
    </section>
  );
}
