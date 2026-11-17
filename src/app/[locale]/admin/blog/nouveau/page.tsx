import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireArticle } from "@/components/admin/FormulaireArticle";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { produitsPourLien } from "@/modules/blog/produits-lien";
import type { ProduitLien } from "@/modules/blog/types";
import { lireProduitsAdmin } from "@/modules/catalogue/queries";

const CHEMIN = "/admin/blog/nouveau";
const ID_FORMULAIRE = "formulaire-article";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/nouveau">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: CHEMIN,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Droit vérifié sur la page elle-même, puis lecture des produits proposés pour le lien.
async function NouvelArticleSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "blog.gerer");
  const t = await getTranslations("Admin.blog");
  let produits: ProduitLien[] | null = null;
  try {
    produits = produitsPourLien(await lireProduitsAdmin());
  } catch {
    console.error("[blog] lecture des produits impossible");
  }
  return (
    <CoqueAdmin>
      {/* Story 9.16 h (Q23) : la page reste sur sa route, dessinée en fenêtre (maquette 06) ; Échap et la croix ramènent à la liste. */}
      {/* Sans formulaire rendu (lecture impossible), pas de bouton « Enregistrer » dans l'en-tête. */}
      <FenetreFormulaire titre={t("pageNouveau.titre")} retour="/admin/blog" idFormulaire={produits ? ID_FORMULAIRE : undefined}>
        {/* Sans lecture des produits, le formulaire n'est pas montré : le lien Produit prétendrait qu'aucun produit n'existe. */}
        {produits ? (
          <FormulaireArticle article={null} produits={produits} idFormulaire={ID_FORMULAIRE} />
        ) : (
          <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
        )}
      </FenetreFormulaire>
    </CoqueAdmin>
  );
}

export default async function NouvelArticle({ params }: PageProps<"/[locale]/admin/blog/nouveau">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <NouvelArticleSelonDroit locale={locale} />
    </Suspense>
  );
}
