import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Pagination de l'admin (story 9.16 b, maquettes B10 et CP9 ; décision Q18) : ‹ › et « page X / Y ». La page donne l'adresse de chaque page (paramètre de
// son adresse) ; aucune lecture en base ici. Première ou dernière page : la flèche correspondante est inactive (ni lien ni clic), annoncée comme telle.
// Une seule page : rien n'est affiché.
const FLECHE = "inline-flex size-11 items-center justify-center rounded-full border border-border-field text-text-primary no-underline";
const FLECHE_INACTIVE = "inline-flex size-11 items-center justify-center rounded-full border border-border-field text-text-secondary";

export function Pagination({ page, total, adresse }: { page: number; total: number; adresse: (page: number) => string }) {
  const t = useTranslations("Admin.ui");
  if (total <= 1) return null;
  const courante = Math.min(Math.max(1, Math.trunc(page)), total);

  function fleche(sens: "precedente" | "suivante") {
    const cible = sens === "precedente" ? courante - 1 : courante + 1;
    const Icone = sens === "precedente" ? ChevronLeft : ChevronRight;
    if (cible < 1 || cible > total) {
      return (
        <span role="link" aria-disabled="true" aria-label={t(sens)} className={FLECHE_INACTIVE}>
          <Icone aria-hidden="true" className="size-6" />
        </span>
      );
    }
    return (
      <Link href={adresse(cible)} aria-label={t(sens)} className={FLECHE}>
        <Icone aria-hidden="true" className="size-6" />
      </Link>
    );
  }

  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-center gap-4 text-text-primary">
      {fleche("precedente")}
      <p className="t-small">{t("page", { page: courante, total })}</p>
      {fleche("suivante")}
    </nav>
  );
}
