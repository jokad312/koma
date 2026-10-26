import { getTranslations } from "next-intl/server";
import { CarteProduit } from "@/components/catalogue/CarteProduit";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireCosplaysRecents } from "@/modules/accueil/cosplays-recents";

// Bloc 2 « Fait main à Goma » : les derniers cosplays publiés, lus à chaque requête (badge de disponibilité).
// Aucun cosplay ou lecture en erreur : le bloc n'existe pas (aucun titre, aucun espace).
export async function BlocCosplaysRecents({ locale }: { locale: Locale }) {
  const produits = await lireCosplaysRecents(locale);
  if (produits.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.cosplaysRecents" });
  return (
    <section aria-labelledby="accueil-cosplays-recents" className="flex flex-col gap-4">
      <div id="accueil-cosplays-recents">
        <TitreVitrine niveau={2}>{t("titre")}</TitreVitrine>
      </div>
      <ul className="grid grid-cols-2 gap-ecart-cartes lg:grid-cols-4">
        {produits.map((p) => (
          <li key={p.id}>
            <CarteProduit produit={p} />
          </li>
        ))}
      </ul>
      <Link href={cheminPublic(locale, "/cosplays")} className="t-label inline-flex min-h-touch items-center self-start text-text-primary underline">
        {t("voirTout")}
      </Link>
    </section>
  );
}
