"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { BoutonDeconnexion } from "@/components/layout/BoutonDeconnexion";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";
import { usePathname } from "@/i18n/navigation";
import { entreesVisibles, estCourante } from "./navigation-entrees";

export type UtilisateurBandeau = { affichage: string; initiales: string; role: "admin" | "assistant" | "benevole" | null };

// Bandeau en haut du contenu de l'admin (story 9.10) : sur-titre « Espace administrateur », titre de la page (libellé de la section, d'après la navigation ; le titre
// de niveau 1 reste celui de la page), et à droite le nom (ou l'email partiellement masqué) et le rôle du Compte connecté, avec ses initiales, puis le thème,
// la langue et la déconnexion (l'en-tête du site est masqué dans l'admin). Sans information sur le Compte (lecture impossible), seuls les réglages s'affichent :
// jamais un nom inventé.
export function BandeauAdmin({ utilisateur, estAdmin }: { utilisateur: UtilisateurBandeau | null; estAdmin: boolean }) {
  const t = useTranslations("Admin.nav");
  const chemin = usePathname();
  const courante = entreesVisibles(estAdmin)
    .flatMap((g) => g.entrees)
    .find(({ href }) => estCourante(chemin, href));

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-surface px-marge py-3">
      <div className="min-w-0">
        <p className="t-label text-text-secondary">{t("bandeau.surtitre")}</p>
        <p className="t-h3 truncate">{courante ? t(courante.cle) : t("libelle")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* Sur mobile, ces réglages sont dans le panneau « Plus » (NavigationAdmin) : le bandeau reste sur une ligne. */}
        <div className="hidden items-center gap-2 md:flex">
          <BasculeTheme />
          <Suspense fallback={null}>
            <SelecteurLangue sansTraduction={[]} />
          </Suspense>
          <BoutonDeconnexion />
        </div>
        {utilisateur ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="t-small font-semibold text-text-primary">{utilisateur.affichage}</p>
              <p className="t-small text-text-secondary">{utilisateur.role ? t(`bandeau.roles.${utilisateur.role}`) : t("bandeau.roles.aucun")}</p>
            </div>
            <span
              role="img"
              aria-label={t("bandeau.avatar", { nom: utilisateur.affichage, role: utilisateur.role ? t(`bandeau.roles.${utilisateur.role}`) : t("bandeau.roles.aucun") })}
              className="t-label inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
            >
              {utilisateur.initiales}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
