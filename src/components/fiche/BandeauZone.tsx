import { useTranslations } from "next-intl";

// Zone de remise visible par tous, avant la zone d'achat : pas de détection de pays.
export function BandeauZone() {
  const t = useTranslations("Fiche");
  return (
    <p className="t-small flex items-center gap-3 rounded-md border border-border bg-surface p-4 font-semibold text-text-primary">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zm0-8.5a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
      <span>{t("bandeau")}</span>
    </p>
  );
}
