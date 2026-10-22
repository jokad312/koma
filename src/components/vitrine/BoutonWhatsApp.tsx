import { useTranslations } from "next-intl";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";

// Bouton secondaire vers WhatsApp, dans un nouvel onglet. Absent (null) si aucun numéro n'est réglé.
export function BoutonWhatsApp({ numero }: { numero: string | null }) {
  const t = useTranslations("Whatsapp");
  const lien = lienWhatsapp(numero);
  if (!lien) return null;
  return (
    <a href={lien} target="_blank" rel="noopener noreferrer" className={CLASSES_SECONDAIRE}>
      {t("ecrire")}
      <span className="sr-only">{t("nouvelOnglet")}</span>
    </a>
  );
}
