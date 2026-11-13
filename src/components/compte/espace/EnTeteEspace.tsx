import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { initiales } from "@/modules/espace/pseudo";

// a. « Bonjour [pseudo] » (H1 de la page) et la pastille des initiales (décorative : le nom est déjà dans le titre).
export async function EnTeteEspace({ pseudo, locale }: { pseudo: string | null; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Espace" });
  const lettres = initiales(pseudo);
  return (
    <div className="flex items-center gap-4">
      {lettres ? (
        <span aria-hidden="true" className="t-h3 inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          {lettres}
        </span>
      ) : null}
      <h1 className="t-h1 min-w-0 break-words">{pseudo ? t("bonjour", { pseudo }) : t("bonjourSansNom")}</h1>
    </div>
  );
}
