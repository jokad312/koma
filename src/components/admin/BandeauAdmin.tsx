"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";
import { PLUSIEURS_LANGUES } from "@/i18n/routing";
import { usePathname } from "@/i18n/navigation";
import { MenuProfil } from "./MenuProfil";
import { entreesVisibles, estCourante } from "./navigation-entrees";

export type UtilisateurBandeau = { affichage: string; initiales: string; role: "admin" | "assistant" | "benevole" | null };

// Barre du haut de l'admin (story 9.10, cadre A des maquettes depuis 9.16 b) : à gauche le surtitre « Espace administrateur » (jamais coupé : une seule ligne)
// et le nom de la page (libellé de la section, d'après la navigation ; le titre de niveau 1 reste celui de la page) ; à droite le thème (rond clair), la langue
// (rond à contour), le nom et le rôle du Compte connecté (à partir de 1280 px ; sinon dans le menu du profil), puis l'avatar rouge qui ouvre le menu du profil
// (la déconnexion y est passée). Sans information sur le Compte (lecture impossible) : ni nom, ni rôle, ni initiales, jamais un nom inventé.
// lienAide : lien WhatsApp des réglages pour la fenêtre « Aide » (null sans numéro réglé).
export function BandeauAdmin({ utilisateur, estAdmin, lienAide = null }: { utilisateur: UtilisateurBandeau | null; estAdmin: boolean; lienAide?: string | null }) {
  const t = useTranslations("Admin.nav");
  const chemin = usePathname();
  const courante = entreesVisibles(estAdmin)
    .flatMap((g) => g.entrees)
    .find(({ href }) => estCourante(chemin, href));
  const role = utilisateur ? (utilisateur.role ? t(`bandeau.roles.${utilisateur.role}`) : t("bandeau.roles.aucun")) : null;

  return (
    <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-4 border-b border-admin-bord bg-admin-menu px-marge py-2 lg:px-3">
      <div className="min-w-0">
        {/* Une seule ligne à partir de 640 px ; en dessous (320 px), le surtitre passe à la ligne entre ses deux mots plutôt que de glisser sous l'avatar. */}
        <p className="t-label text-text-secondary sm:whitespace-nowrap">{t("bandeau.surtitre")}</p>
        <p className="t-h3 truncate text-text-primary">{courante ? t(courante.cle) : t("libelle")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* Sous 768 px, le thème et la langue sont dans le panneau « Plus » (NavigationAdmin) : la barre reste sur une ligne. */}
        <div className="hidden items-center gap-3 md:flex">
          <BasculeTheme variante="rond" />
          {PLUSIEURS_LANGUES ? (
            <Suspense fallback={null}>
              <SelecteurLangue sansTraduction={[]} variante="rond" />
            </Suspense>
          ) : null}
        </div>
        {utilisateur && role ? (
          <div className="hidden max-w-56 text-right xl:block">
            <p className="truncate text-[18px] leading-6 text-text-primary">{utilisateur.affichage}</p>
            <p className="t-small text-text-secondary">{role}</p>
          </div>
        ) : null}
        <MenuProfil profil={utilisateur && role ? { affichage: utilisateur.affichage, initiales: utilisateur.initiales, role } : null} lienAide={lienAide} />
      </div>
    </header>
  );
}
