"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { BoutonDeconnexion } from "@/components/layout/BoutonDeconnexion";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";
import { Dialogue } from "@/components/ui/Dialogue";
import { entreesVisibles, estCourante, PRINCIPALES } from "./navigation-entrees";

const GLYPHE_MENU = "☰";

// Navigation de l'admin (story 9.10), un seul élément nav mis en forme par le CSS :
//  - ordinateur (md et plus) : barre latérale fixe à gauche, pleine hauteur : bloc de marque (logo et nom du site), groupes avec titre, page courante surlignée
//    (fond et barre rouge de 4 px), encart « Besoin d'aide ? » avec « Voir le site » en bas ;
//  - mobile : barre d'onglets fixe en bas (58 px) avec Tableau de bord, Commandes, Tâches et le bouton ☰ « Plus » (story 9.8b) ; le panneau « Plus » liste le reste
//    et un lien « Voir le site ».
// Chaque lien n'existe qu'une fois dans le DOM : les groupes sont aplatis sur mobile (display: contents) et les entrées qui ne sont pas principales y sont masquées.
// compteurMessages : nombre de messages « nouveau » ; null (lecture impossible) ou 0 : aucun compteur affiché.
export function NavigationAdmin({ compteurMessages = null, nomSite, estAdmin = false }: { compteurMessages?: number | null; nomSite: string; estAdmin?: boolean }) {
  const t = useTranslations("Admin.nav");
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

  // Le panneau est réservé au mobile : il se ferme si la fenêtre passe à md ou plus (rotation d'une tablette, redimensionnement).
  useEffect(() => {
    if (!ouvert || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 48rem)");
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
            <span aria-hidden="true" className="t-small ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 text-on-primary">
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
      className="fixed inset-x-0 bottom-0 z-30 flex h-[58px] border-t border-border bg-surface md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-64 md:flex-col md:overflow-y-auto md:border-r md:border-t-0"
    >
      {/* Bloc de marque (ordinateur) : logo et nom du site lu dans les réglages ; le logo mène au site. */}
      <div className="hidden border-b border-border px-5 py-4 md:block">
        <Link href="/" className="inline-flex min-h-touch items-center" aria-label={t("voirSiteNom", { nom: nomSite })}>
          <span className="relative block aspect-[530/124] w-[150px] overflow-hidden">
            <Image src="/logo/logo-principal.svg" alt="" width={630} height={220} unoptimized data-logo="clair" className="logo-clair absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none" />
            <Image src="/logo/logo-principal-inverse.svg" alt="" width={630} height={220} unoptimized data-logo="sombre" className="logo-sombre absolute -left-[9.434%] -top-[37.097%] h-auto w-[118.868%] max-w-none" />
          </span>
        </Link>
        <p className="t-label mt-2 text-text-secondary">{nomSite}</p>
      </div>

      {groupes.map((groupe) => (
        <div key={groupe.cle} className="contents md:mt-3 md:block md:px-3">
          <p className="t-label hidden px-3 pb-1 text-text-secondary md:block">{t(`groupes.${groupe.cle}`)}</p>
          <ul role="list" className="contents md:flex md:flex-col">
            {groupe.entrees.map(({ cle, href }) => {
              const courante = estCourante(chemin, href);
              // Sur mobile, seules les entrées principales sont dans la barre ; les autres restent dans la barre latérale (md et plus).
              const masqueMobile = !PRINCIPALES.includes(cle);
              return (
                <li key={cle} className={`flex-1 md:flex-none ${masqueMobile ? "hidden md:block" : ""}`}>
                  <Link
                    href={href}
                    aria-current={courante ? "page" : undefined}
                    className={`t-label flex min-h-touch flex-wrap items-center justify-center border-t-4 px-1 text-center text-text-primary no-underline md:justify-start md:rounded-md md:border-l-4 md:border-t-0 md:px-3 md:text-left ${
                      courante ? "border-primary md:bg-background" : "border-transparent hover:md:bg-background"
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

      <div className="flex-1 md:hidden">
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

      {/* Encart d'aide (ordinateur). */}
      <div className="m-3 mt-auto hidden rounded-lg border border-border bg-background p-4 md:block">
        <p className="t-label text-text-primary">{t("aide.titre")}</p>
        <p className="t-small mt-1 text-text-secondary">{t("aide.texte")}</p>
        <Link href="/" className="t-small mt-2 inline-flex min-h-touch items-center text-text-primary underline underline-offset-4">
          {t("voirSite")}
        </Link>
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
            <Link href="/" className="t-body flex min-h-touch items-center border-l-4 border-transparent px-4 text-text-primary underline underline-offset-4">
              {t("voirSite")}
            </Link>
          </li>
          {/* Réglages du site repris ici sur mobile (le bandeau reste sur une ligne ; l'en-tête du site est masqué dans l'admin). */}
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
