import { getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { verifierDesinscription } from "@/modules/preferences/lien-desinscription";
import { ConfirmationDesinscription } from "./ConfirmationDesinscription";

// Contenu de la page /desinscription (story 9.4, décision de Jonathan du 2026-11-10) : ouvrir le lien ne change RIEN (antivirus et aperçus
// ouvrent les liens tout seuls). La signature est seulement vérifiée pour proposer le bouton ; la désinscription n'a lieu qu'au POST signé.
export async function ResultatDesinscription({ locale, c, s }: { locale: Locale; c: unknown; s: unknown }) {
  const t = await getTranslations({ locale, namespace: "Desinscription" });
  const compte = Array.isArray(c) ? c[0] : c;
  const signature = Array.isArray(s) ? s[0] : s;
  let valide = false;
  try {
    valide = verifierDesinscription(compte, signature);
  } catch {
    // Clé de désinscription absente ou trop courte : problème de configuration du serveur, jamais montré comme un lien invalide.
    console.error("[preferences] vérification du lien de désinscription impossible (configuration)");
    return <MessageEtat type="erreur">{t("indisponible")}</MessageEtat>;
  }
  return (
    <div className="flex flex-col items-start gap-3">
      {valide ? <ConfirmationDesinscription c={compte as string} s={signature as string} /> : <MessageEtat type="attention">{t("invalide")}</MessageEtat>}
      <p className="t-body text-text-primary">{t("reactiver")}</p>
      <Link href="/compte/preferences" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
        {t("lienPreferences")}
      </Link>
    </div>
  );
}
