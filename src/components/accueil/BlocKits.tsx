import { getTranslations } from "next-intl/server";
import { CarteProduit } from "@/components/catalogue/CarteProduit";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireKits } from "@/modules/accueil/kits";

// Bloc 3 « Kits » de l'accueil (FR-2) : les Kits publiés, le Kit gratuit en évidence quand il existe et est publié.
// Aucun Kit publié : le bloc n'existe pas (aucun titre, aucun texte, aucun espace).
export async function BlocKits({ locale, niveau = 2 }: { locale: Locale; niveau?: 2 | 3 }) {
  const produits = await lireKits(locale);
  const gratuit = produits.find((k) => k.prixCents === 0);
  const aAfficher = gratuit ? [gratuit, ...produits.filter((k) => k.id !== gratuit.id)] : produits;
  if (aAfficher.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.kits" });
  return (
    <section aria-labelledby="accueil-kits" className="flex flex-col gap-4">
      <div id="accueil-kits">
        <TitreVitrine niveau={niveau}>{t("titre")}</TitreVitrine>
      </div>
      <ul className="grid grid-cols-2 gap-ecart-cartes lg:grid-cols-4">
        {aAfficher.map((p) => (
          <li key={p.id}>
            <CarteProduit produit={p} niveau={niveau === 2 ? 3 : 4} />
          </li>
        ))}
      </ul>
      <Link href={cheminPublic(locale, "/kits")} className="t-label inline-flex min-h-touch items-center self-start text-text-primary underline">
        {t("voirTout")}
      </Link>
    </section>
  );
}
