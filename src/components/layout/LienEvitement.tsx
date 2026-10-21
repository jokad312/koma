import { getTranslations } from "next-intl/server";
import { ID_CONTENU } from "./constantes";

// Premier élément focalisable de chaque page : invisible jusqu'au focus.
export async function LienEvitement() {
  const t = await getTranslations("LienEvitement");
  return (
    <a
      href={`#${ID_CONTENU}`}
      className="t-button sr-only rounded-full bg-text-primary px-5 py-3 text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60]"
    >
      {t("texte")}
    </a>
  );
}
