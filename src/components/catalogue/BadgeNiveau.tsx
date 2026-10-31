import { useTranslations } from "next-intl";
import type { NiveauKit } from "@/modules/catalogue/types";

// Niveau d'un Kit (Débutant / Intermédiaire / Avancé) : texte seul, jamais porté par la couleur. Serveur et navigateur (« Voir plus »).
export function BadgeNiveau({ niveau }: { niveau: NiveauKit }) {
  const t = useTranslations("Kit");
  return <p className="t-small text-text-primary">{t("niveauLibelle", { niveau: t(`niveau.${niveau}`) })}</p>;
}
