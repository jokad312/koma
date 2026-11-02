import { useLocale, useTranslations } from "next-intl";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { KitLieFiche } from "@/modules/catalogue/types";

type Props = {
  // Kit lié publié (double option, story 3.4) : proposé par le bandeau de zone, avec un lien vers sa fiche.
  kit?: KitLieFiche | null;
};

// Zone de remise visible par tous, avant la zone d'achat : pas de détection de pays.
// Avec un Kit lié publié, le bandeau propose aussi le Kit (FR-6) : l'avertissement de zone ne doit pas
// priver le visiteur qui fabrique de son kit. Aucune détection de pays, aucun contenu inventé.
export function BandeauZone({ kit }: Props) {
  const t = useTranslations("Fiche");
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-col gap-2">
      <p className="t-small flex items-center gap-3 rounded-md border border-border bg-surface p-4 font-semibold text-text-primary">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zm0-8.5a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        <span>{t("bandeau")}</span>
      </p>
      {kit ? (
        <p className="t-small flex flex-wrap items-center gap-2 text-text-secondary">
          <Link href={cheminPublic(locale, `/kits/${kit.slug}`)} className="text-text-primary underline">
            {t("option.voirLeKit")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
