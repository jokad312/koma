"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { BoutonDeconnexion } from "@/components/layout/BoutonDeconnexion";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";
import { Dialogue } from "@/components/ui/Dialogue";

import { entreesVisibles, estCourante, PRINCIPALES } from "./navigation-entrees";

// « Voir le site » : un vrai lien (rechargement complet), pas une navigation interne. La mise en page de l'admin (9.10) masque l'en-tête du site
// tant que la coque admin est dans la page ; après une navigation interne, Next.js garde la page admin cachée en mémoire et l'en-tête resterait masqué.
// Adresse : accueil public avec ?vue=site, que le proxy n'aiguille pas vers l'admin (story 9.12).
function adresseVoirLeSite(locale: string) {
  return `/${locale}?vue=site`;
}

const GLYPHE_MENU = "☰";

// Navigation de l'admin (story 9.10, cadre A des maquettes depuis 9.16 b), un seul élément nav mis en forme par le CSS :
//  - ordinateur (lg et plus, décision 4 du 2026-11-16) : menu latéral fixe à gauche, pleine hauteur, bord droit de 4 px : logo, « ADMINISTRATION », trait,
//    puis les groupes (le premier sans titre visible, comme la maquette) ; l'entrée courante est un bloc de la couleur du fond, collé au bord droit, au
//    texte un peu plus grand, avec un trait rouge de 4 px à gauche (repère qui ne dépend pas que de la couleur, décision 2) ;
//  - en dessous : barre d'onglets fixe en bas (58 px) avec Tableau de bord, Commandes, Tâches et le bouton ☰ « Plus » (story 9.8b) ; le panneau « Plus » liste le
//    reste, « Voir le site », le thème, la langue et la déconnexion.
// Chaque lien n'existe qu'une fois dans le DOM : les groupes sont aplatis en dessous de lg (display: contents) et les entrées qui ne sont pas principales y sont masquées.
// L'encart « Besoin d'aide ? » est retiré (Q7) : « Aide » et « Voir le site » sont dans le menu du profil (BandeauAdmin).
// compteurMessages : nombre de messages « nouveau » ; null (lecture impossible) ou 0 : aucun compteur affiché.
export function NavigationAdmin({ compteurMessages = null, nomSite, estAdmin = false }: { compteurMessages?: number | null; nomSite: string; estAdmin?: boolean }) {
  const t = useTranslations("Admin.nav");
  const locale = useLocale();
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const groupes = entreesVisibles(estAdmin);
  const toutes = groupes.flatMap((g) => g.entrees);

  // Toute navigation ferme le panneau : la coque n'est pas remontée entre deux pages admin.
  const [cheminVu, setCheminVu] = useState(chemin);
  if (chemin !== cheminVu) {
    setCheminVu(chemin);
    setOuvert(false);
  }

  // Le panneau est réservé aux petites largeurs : il se ferme si la fenêtre passe à lg ou plus (rotation d'une tablette, redimensionnement).
  useEffect(() => {
    if (!ouvert || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const surChangement = () => mq.matches && setOuvert(false);
    surChangement();
    mq.addEventListener("change", surChangement);
    return () => mq.removeEventListener("change", surChangement);
  }, [ouvert]);

  const compteur = compteurMessages && compteurMessages > 0 ? compteurMessages : null;
  const entreeCourante = toutes.find(({ href }) => estCourante(chemin, href));
  const courantDansPlus = entreeCourante !== undefined && !PRINCIPALES.includes(entreeCourante.cle);

  // Texte visible « Plus » ; nom accessible « Plus de pages » (il commence par le texte visible, WCAG 2.5.3), suivi du compteur
  // de messages et de la page actuelle quand elle se trouve dans le panneau.
  const parties = [t("plusNom")];
  if (compteur) parties.push(t("messagesNouveaux", { nombre: compteur }));
  if (courantDansPlus && entreeCourante) parties.push(t("pageActuelle", { nom: t(entreeCourante.cle) }));
  const nomBouton = parties.join("");

  function etiquette(cle: string) {
    return (
      <>
        {t(cle)}
        {cle === "messages" && compteur ? (
          <>
            <span aria-hidden="true" className="t-small ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 tracking-normal text-on-primary">
              {compteur}
            </span>
            <span className="sr-only">{t("messagesNouveaux", { nombre: compteur })}</span>
          </>
        ) : null}
      </>
    );
  }

  return (
    <nav
      aria-label={t("libelle")}
      data-barre-admin=""
      className="fixed inset-x-0 bottom-0 z-30 flex h-[58px] border-t border-admin-bord bg-admin-menu lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-r-4 lg:border-t-0"
    >
      {/* Bloc de marque (ordinateur) : logo (mène au site ; le lien porte le nom du site lu dans les réglages), « ADMINISTRATION », trait. */}
      <div className="hidden shrink-0 border-b-[3px] border-admin-bord px-5 pb-2 pt-2 lg:block">
        <a href={adresseVoirLeSite(locale)} className="inline-flex min-h-touch items-center" aria-label={t("voirSiteNom", { nom: nomSite })}>
          <span className="relative block aspect-[530/124] w-[165px] overflow-hidden">
            <Image src="/logo/logo-principal.svg" alt="" width={630} height={220} unoptimized data-logo="clair" className="logo-clair absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none" />
            <Image src="/logo/logo-principal-inverse.svg" alt="" width={630} height={220} unoptimized data-logo="sombre" className="logo-sombre absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none" />
          </span>
        </a>
        <p className="t-label mt-1 whitespace-nowrap text-text-primary">{t("libelle")}</p>
      </div>

      {groupes.map((groupe, rang) => (
        <div key={groupe.cle} className={`contents lg:block ${rang === 0 ? "lg:pt-1" : ""}`}>
          {/* Le premier groupe n'a pas de titre visible sur la maquette : son titre reste pour les lecteurs d'écran. */}
          <p className={rang === 0 ? "sr-only" : "t-label hidden px-4 pt-1 text-text-secondary lg:block"}>{t(`groupes.${groupe.cle}`)}</p>
          <ul role="list" className="contents lg:flex lg:flex-col">
            {groupe.entrees.map(({ cle, href }) => {
              const courante = estCourante(chemin, href);
              // En dessous de lg, seules les entrées principales sont dans la barre ; les autres restent dans le menu latéral (lg et plus).
              const masqueMobile = !PRINCIPALES.includes(cle);
              return (
                <li key={cle} className={`flex-1 lg:flex-none ${masqueMobile ? "hidden lg:block" : ""}`}>
                  <Link
                    href={href}
                    aria-current={courante ? "page" : undefined}
                    className={`t-label flex min-h-touch flex-wrap items-center justify-center border-t-4 px-1 text-center text-text-primary no-underline lg:ml-3 lg:justify-start lg:whitespace-nowrap lg:rounded-l-[14px] lg:border-l-4 lg:border-t-0 lg:pl-3 lg:pr-1 lg:text-left lg:tracking-[0.08em] ${
                      courante ? "border-primary lg:bg-admin-actif lg:text-[18px]" : "border-transparent hover:lg:bg-admin-actif"
                    }`}
                  >
                    {etiquette(cle)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="flex-1 lg:hidden">
        <button
          ref={bouton}
          type="button"
          aria-label={nomBouton}
          aria-haspopup="dialog"
          aria-expanded={ouvert}
          onClick={() => setOuvert(true)}
          className={`t-label flex min-h-touch w-full flex-wrap items-center justify-center gap-1 border-t-4 px-1 text-center text-text-primary ${
            courantDansPlus ? "border-primary" : "border-transparent"
          }`}
        >
          <span aria-hidden="true">{GLYPHE_MENU}</span>
          <span>{t("plus")}</span>
        </button>
      </div>

      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre={t("plusTitre")} variante="plein" retourFocus={bouton}>
        <ul className="flex flex-col">
          {toutes
            .filter(({ cle }) => !PRINCIPALES.includes(cle))
            .map(({ cle, href }) => (
              <li key={cle}>
                <Link
                  href={href}
                  aria-current={estCourante(chemin, href) ? "page" : undefined}
                  onClick={(e) => {
                    // Un clic avec Ctrl, Meta, Maj ou le bouton du milieu ouvre un autre onglet : le panneau reste ouvert.
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                    setOuvert(false);
                  }}
                  className={`t-body flex min-h-touch items-center border-l-4 px-4 text-text-primary no-underline ${
                    estCourante(chemin, href) ? "border-primary" : "border-transparent"
                  }`}
                >
                  {etiquette(cle)}
                </Link>
              </li>
            ))}
          <li>
            <a href={adresseVoirLeSite(locale)} className="t-body flex min-h-touch items-center border-l-4 border-transparent px-4 text-text-primary underline underline-offset-4">
              {t("voirSite")}
            </a>
          </li>
          {/* Réglages du site repris ici en dessous de lg (la barre du haut reste sur une ligne ; l'en-tête du site est masqué dans l'admin). */}
          <li className="flex flex-wrap items-center gap-2 px-4 py-3">
            <BasculeTheme />
            <Suspense fallback={null}>
              <SelecteurLangue sansTraduction={[]} />
            </Suspense>
            <BoutonDeconnexion />
          </li>
        </ul>
      </Dialogue>
    </nav>
  );
}
