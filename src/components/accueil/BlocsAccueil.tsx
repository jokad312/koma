import { Suspense, type ReactNode } from "react";
import { BlocCosplaysRecents } from "./BlocCosplaysRecents";
import { BlocFaqCourte } from "./BlocFaqCourte";
import { BlocGuides } from "./BlocGuides";
import { BlocKits } from "./BlocKits";
import { BlocMur } from "./BlocMur";
import { BlocRendezVous } from "./BlocRendezVous";
import { BlocPorteOuFabrique } from "./BlocPorteOuFabrique";
import { HerosAccueil } from "./HerosAccueil";
import { BlocJonathan } from "./BlocJonathan";
import { TuilesCategories } from "./TuilesCategories";
import type { Locale } from "@/i18n/routing";
import { blocsAffiches } from "@/modules/accueil/blocs";

// Rendu de chaque bloc affiché. L'ordre et les emplacements réservés (rien à rendre) viennent de src/modules/accueil/blocs.ts.
function rendreBloc(id: string, locale: Locale, requete: Promise<Record<string, string | string[] | undefined>>, variante: VarianteAccueil): ReactNode {
  // Sous le H2 « Découvrir la boutique » de l'espace personnel, les titres des blocs descendent d'un niveau (H3, cartes en H4).
  const niveau = variante === "boutique" ? 3 : 2;
  switch (id) {
    case "heros":
      // Accroche (H1) dans la coque statique ; vedette, photo et vidéo lues à chaque requête. Visiteur : héros de la maquette « fusion ».
      // « Découvrir la boutique » de l'espace personnel (story 9.12) : les mêmes blocs, sans le grand héros.
      return variante === "boutique" ? null : <HerosAccueil locale={locale} />;
    case "categories":
      return <TuilesCategories niveau={niveau} />;
    case "porteOuFabrique":
      // Bloc 1 « Porte-le ou fabrique-le » : le Cosplay vedette porté et son Kit lié, deux colonnes ; masqué sans Kit publié (FR-2).
      return (
        <Suspense fallback={null}>
          <BlocPorteOuFabrique locale={locale} niveau={niveau} />
        </Suspense>
      );
    case "kits":
      // Les Kits publiés, le Kit gratuit en évidence ; le bloc se masque sans Kit publié (FR-2).
      return (
        <Suspense fallback={null}>
          <BlocKits locale={locale} niveau={niveau} />
        </Suspense>
      );
    case "cosplaysRecents":
      // Lu à chaque requête (badge de disponibilité) ; pas de repli visible : le bloc n'existe qu'une fois ses cosplays lus.
      return (
        <Suspense fallback={null}>
          <BlocCosplaysRecents locale={locale} niveau={niveau} />
        </Suspense>
      );
    case "galerie":
      // Bloc 4 « Ils le portent » : le mur public des photos et Réalisations validées ; masqué sans photo publiée.
      return (
        <Suspense fallback={null}>
          <BlocMur locale={locale} requete={requete} niveau={niveau} />
        </Suspense>
      );
    case "rendezVousOtaku":
      // Bloc 5 « Rendez-vous otaku » : le prochain Événement à venir ; masqué sans Événement à venir ou si la lecture échoue (FR-2).
      return (
        <Suspense fallback={null}>
          <BlocRendezVous locale={locale} niveau={niveau} />
        </Suspense>
      );
    case "jonathan":
      return <BlocJonathan niveau={niveau} />;
    case "bloc7":
      // Bloc « Guides » : lu à chaque requête ; masqué sans Article publié.
      return (
        <Suspense fallback={null}>
          <BlocGuides locale={locale} niveau={niveau} />
        </Suspense>
      );
    case "faqCourte":
      return <BlocFaqCourte locale={locale} niveau={niveau} />;
    default:
      return null;
  }
}

export type VarianteAccueil = "visiteur" | "boutique";

// Les blocs de l'accueil, dans l'ordre de src/modules/accueil/blocs.ts. Variante « boutique » (espace personnel) : sans le héros.
export function BlocsAccueil({ locale, searchParams, variante }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>>; variante: VarianteAccueil }) {
  return (
    <div className={variante === "visiteur" ? "accueil-visiteur flex flex-col gap-10" : "flex flex-col gap-10"}>
      {blocsAffiches().map((bloc) => (
        <div key={bloc.id} className="contents">
          {rendreBloc(bloc.id, locale, searchParams, variante)}
        </div>
      ))}
    </div>
  );
}
