import { Suspense } from "react";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { LangueRepli } from "@/components/layout/LangueRepli";
import { LogoSite } from "@/components/layout/LogoSite";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";

// En-tête réduit de la page de connexion (story 9.17, maquette connexion.mp4, F1) : logo à gauche, bouton thème et langue à droite, trait fin
// dessous sur toute la largeur ; 50 px de haut, mêmes marges que la page dès 768 px (connexion.css). Ni menu, ni « Se connecter », ni panier : l'en-tête complet du site est masqué sur cette page (globals.css, [data-page-connexion]).
export function EnTeteConnexion({ nomSite }: { nomSite: string }) {
  return (
    <header data-entete-connexion="" className="cx-entete flex items-center justify-between gap-3 border-b border-border">
      <LogoSite nomSite={nomSite} />
      <div className="flex items-center gap-2">
        {/* Ronds de la maquette (F1 : soleil dans un rond blanc, langue dans un rond à contour), comme la barre du haut de l'admin : tiennent à 390 px. */}
        <BasculeTheme variante="rond" />
        <Suspense fallback={<LangueRepli />}>
          <SelecteurLangue variante="rond" />
        </Suspense>
      </div>
    </header>
  );
}
