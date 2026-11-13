import { getLocale, getTranslations } from "next-intl/server";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { compterPanier } from "@/modules/panier/queries";

const CLASSES = "lien-panier t-small relative inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-full border border-border-field bg-surface px-3 text-text-primary no-underline";

function IconePanier() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

// Lien Panier de l'en-tête. Sans nombre (repli statique, avant la lecture du cookie) : « Panier » seul.
export async function LienPanier({ nombre }: { nombre: number | null }) {
  const t = await getTranslations("Navigation.panier");
  const locale = (await getLocale()) as Locale;
  return (
    <Link href={cheminPublic(locale, "/panier")} className={CLASSES} data-libelle={t("lien")} aria-label={nombre === null ? t("lien") : t("libelle", { count: nombre })}>
      <IconePanier />
      {nombre !== null && nombre > 0 ? <span aria-hidden="true">{nombre}</span> : null}
    </Link>
  );
}

// Lit le cookie du Panier (donnée de requête) : sous Suspense, le reste de l'en-tête reste statique.
export async function ZonePanier() {
  return <LienPanier nombre={await compterPanier()} />;
}
