"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cheminRetourValide } from "@/lib/auth/retour";
import type { Locale } from "@/i18n/routing";

const CLASSES = "t-small inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-text-primary no-underline";

// « Se connecter » : la page quittée est transmise comme chemin de retour (revalidé côté serveur à l'arrivée).
export function LienConnexion() {
  const t = useTranslations("Compte");
  const locale = useLocale() as Locale;
  const chemin = usePathname();
  const retour = cheminRetourValide(chemin, locale);
  const requete = retour === `/${locale}` ? undefined : { retour };

  return (
    <Link href={{ pathname: "/connexion", query: requete }} className={CLASSES}>
      {t("seConnecter")}
    </Link>
  );
}
