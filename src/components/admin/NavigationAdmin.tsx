"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Seules les entrées dont la page existe sont listées : chaque story qui crée une page admin ajoute sa ligne ici.
const ENTREES = [
  { cle: "produits", href: "/admin/produits" },
  { cle: "univers", href: "/admin/univers" },
  { cle: "messages", href: "/admin/messages" },
  { cle: "reglages", href: "/admin/reglages" },
] as const;

// Barre latérale sur ordinateur, barre d'onglets fixe en bas (58 px) sur mobile : un seul élément nav, mis en forme par le CSS.
// Entrée courante : barre rouge de 4 px (en haut de l'onglet sur mobile, à gauche sur ordinateur).
// compteurMessages : nombre de messages « nouveau » ; null (lecture impossible) ou 0 : aucun compteur affiché.
export function NavigationAdmin({ compteurMessages = null }: { compteurMessages?: number | null }) {
  const t = useTranslations("Admin.nav");
  const chemin = usePathname();
  return (
    <nav
      aria-label={t("libelle")}
      data-barre-admin=""
      className="fixed inset-x-0 bottom-0 z-30 flex h-[58px] border-t border-border bg-surface md:sticky md:inset-x-auto md:bottom-auto md:top-[calc(var(--spacing-entete)+16px)] md:h-auto md:w-56 md:shrink-0 md:flex-col md:rounded-lg md:border"
    >
      <ul className="flex w-full md:flex-col">
        {ENTREES.map(({ cle, href }) => {
          const courante = chemin === href || chemin.startsWith(`${href}/`);
          return (
            <li key={cle} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={courante ? "page" : undefined}
                className={`t-label flex min-h-touch flex-wrap items-center justify-center border-t-4 px-1 text-center text-text-primary no-underline md:justify-start md:border-l-4 md:border-t-0 md:px-4 md:text-left ${
                  courante ? "border-primary" : "border-transparent"
                }`}
              >
                {t(cle)}
                {cle === "messages" && compteurMessages ? (
                  <>
                    <span aria-hidden="true" className="t-small ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 text-on-primary">
                      {compteurMessages}
                    </span>
                    <span className="sr-only">{t("messagesNouveaux", { nombre: compteurMessages })}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
