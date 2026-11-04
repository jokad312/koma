import { getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireCodesPromoAdmin } from "@/modules/promo/queries";
import { CoqueAdmin } from "./CoqueAdmin";
import { FormulaireCodePromo } from "./FormulaireCodePromo";
import { ListeCodesPromo } from "./ListeCodesPromo";

// Contenu de la page /admin/codes-promo. Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le
// client service. Une lecture impossible affiche un message sobre, jamais une liste vide.
export async function CodesPromoSelonDroit({ locale, chemin }: { locale: Locale; chemin: string }) {
  await exigerAdminPage(locale, chemin, "codes_promo.gerer");
  const t = await getTranslations("Admin.codesPromo");
  let codes = null;
  try {
    codes = await lireCodesPromoAdmin();
  } catch {
    console.error("[promo] lecture des codes promo impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        <FormulaireCodePromo />
        {codes ? <ListeCodesPromo codes={codes} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}
