"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Dialogue } from "@/components/ui/Dialogue";

// Seules les entrées dont la page existe sont listées : chaque story qui crée une page admin ajoute sa ligne ici.
const ENTREES = [
  { cle: "tableau", href: "/admin" },
  { cle: "commandes", href: "/admin/commandes" },
  { cle: "produits", href: "/admin/produits" },
  { cle: "univers", href: "/admin/univers" },
  { cle: "blog", href: "/admin/blog" },
  { cle: "galerie", href: "/admin/galerie" },
  { cle: "codesPromo", href: "/admin/codes-promo" },
  { cle: "messages", href: "/admin/messages" },
  { cle: "taches", href: "/admin/taches" },
  { cle: "prestataires", href: "/admin/prestataires" },
  { cle: "reglages", href: "/admin/reglages" },
] as const;

const GLYPHE_MENU = "☰";

type Cle =(typeof ENTREES)[number]["cle"];

// Sur mobile, la barre du bas garde les entrées de tous les jours (UX-DR42) ; le reste passe par le bouton ☰ « Plus ».
// Sur ordinateur, la barre latérale les montre toutes.
const PRINCIPALES: readonly Cle[] = ["tableau", "commandes", "taches"];

// « /admin » est le tableau de bord : il n'est courant que sur sa propre page, jamais sur les sous-pages.
function estCourante(chemin: string, href: string) {
  return href === "/admin" ? chemin === href : chemin === href || chemin.startsWith(`${href}/`);
}

// Barre latérale sur ordinateur, barre d'onglets fixe en bas (58 px) sur mobile : un seul élément nav, mis en forme par le CSS.
// Entrée courante : barre rouge de 4 px (en haut de l'onglet sur mobile, à gauche sur ordinateur).
// compteurMessages : nombre de messages « nouveau » ; null (lecture impossible) ou 0 : aucun compteur affiché.
export function NavigationAdmin({ compteurMessages = null }: { compteurMessages?: number | null }) {
  const t = useTranslations("Admin.nav");
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);

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
  const entreeCourante = ENTREES.find(({ href }) => estCourante(chemin, href));
  const courantDansPlus = entreeCourante !== undefined && !PRINCIPALES.includes(entreeCourante.cle);

  function etiquette(cle: Cle) {
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
      className="fixed inset-x-0 bottom-0 z-30 flex h-[58px] border-t border-border bg-surface md:sticky md:inset-x-auto md:bottom-auto md:top-[calc(var(--spacing-entete)+16px)] md:h-auto md:w-56 md:shrink-0 md:flex-col md:rounded-lg md:border"
    >
      <ul className="flex w-full md:flex-col">
        {ENTREES.map(({ cle, href }) => {
          const courante = estCourante(chemin, href);
          // Sur mobile, seules les entrées principales sont dans la barre ; les autres restent dans la barre latérale (md et plus).
          const masqueMobile = !PRINCIPALES.includes(cle);
          return (
            <li key={cle} className={`flex-1 md:flex-none ${masqueMobile ? "hidden md:block" : ""}`}>
              <Link
                href={href}
                aria-current={courante ? "page" : undefined}
                className={`t-label flex min-h-touch flex-wrap items-center justify-center border-t-4 px-1 text-center text-text-primary no-underline md:justify-start md:border-l-4 md:border-t-0 md:px-4 md:text-left ${
                  courante ? "border-primary" : "border-transparent"
                }`}
              >
                {etiquette(cle)}
              </Link>
            </li>
          );
        })}
        <li className="flex-1 md:hidden">
          <button
            ref={bouton}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={ouvert}
            onClick={() => setOuvert(true)}
            className={`t-label flex min-h-touch w-full flex-wrap items-center justify-center gap-1 border-t-4 px-1 text-center text-text-primary ${
              courantDansPlus ? "border-primary" : "border-transparent"
            }`}
          >
            <span aria-hidden="true">{GLYPHE_MENU}</span>
            <span>{t("plus")}</span>
            {compteur ? <span className="sr-only">{t("messagesNouveaux", { nombre: compteur })}</span> : null}
            {courantDansPlus && entreeCourante ? <span className="sr-only">{t("pageActuelle", { nom: t(entreeCourante.cle) })}</span> : null}
          </button>
        </li>
      </ul>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre={t("plusTitre")} variante="plein" retourFocus={bouton}>
        <ul className="flex flex-col">
          {ENTREES.filter(({ cle }) => !PRINCIPALES.includes(cle)).map(({ cle, href }) => (
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
        </ul>
      </Dialogue>
    </nav>
  );
}
