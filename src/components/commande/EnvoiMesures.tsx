import { useTranslations } from "next-intl";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { formaterDateBoutique } from "@/lib/dates";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";

// Envoi des mesures du Sur-mesure sur WhatsApp (story 6.4) : le site ne collecte ni ne stocke aucune mesure. Le bouton ouvre WhatsApp vers le numéro réglé
// (jamais en dur) avec un message prérempli qui porte le numéro de commande. Numéro absent : message qui invite à contacter, jamais de numéro de repli.
// Quand l'admin a confirmé la réception (story 6.5), la date est affichée et le délai de fabrication court à partir d'elle.
export function EnvoiMesures({ numero, numeroWhatsapp, mesuresRecuesLe, locale }: { numero: string; numeroWhatsapp: string | null; mesuresRecuesLe: string | null; locale: "fr" | "en" }) {
  const t = useTranslations("Commande.mesures");
  const recue = formaterDateBoutique(mesuresRecuesLe, locale);
  if (recue) {
    return (
      <section aria-labelledby="commande-mesures" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 id="commande-mesures" className="t-h2">
          {t("titre")}
        </h2>
        <p className="t-body text-text-primary">{t("recues", { date: recue })}</p>
      </section>
    );
  }
  const lien = lienWhatsapp(numeroWhatsapp, t("message", { numero }));
  return (
    <section aria-labelledby="commande-mesures" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="commande-mesures" className="t-h2">
        {t("titre")}
      </h2>
      {lien ? (
        <div className="flex flex-col items-start gap-2">
          <a href={lien} target="_blank" rel="noopener noreferrer" className={CLASSES_SECONDAIRE}>
            {t("bouton")}
            <span className="sr-only">{t("nouvelOnglet")}</span>
          </a>
          <p className="t-small text-text-secondary">{t("delai")}</p>
        </div>
      ) : (
        <MessageEtat type="attention">{t("absent")}</MessageEtat>
      )}
    </section>
  );
}
