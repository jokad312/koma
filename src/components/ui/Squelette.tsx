import { useTranslations } from "next-intl";

type Props = { className?: string };

// Forme du contenu attendu : région aria-busy, texte « Chargement… » masqué. Jamais sur le héros.
export function Squelette({ className }: Props) {
  const t = useTranslations("Composants");
  return (
    <div aria-busy="true">
      <span className="sr-only">{t("chargement")}</span>
      <div aria-hidden="true" className={`squelette ${className ?? "h-24 w-full"}`} />
    </div>
  );
}
