import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireCouleursUtilisees, lireProduitsLiables, lireUniversAdmin } from "@/modules/catalogue/queries";
import type { CouleurVariante, ProduitLiable, UniversAdmin } from "@/modules/catalogue/types";

const CHEMIN = "/admin/produits/nouveau";
// Formulaire principal, soumis par « Enregistrer » de la fenêtre.
const ID_FORMULAIRE = "formulaire-produit";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/produits/nouveau">): Promise<Metadata> {
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

// Droit vérifié sur la page elle-même, puis lecture des univers par le client service.
async function NouveauSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "produits.modifier");
  const t = await getTranslations("Admin.produits");
  let univers: UniversAdmin[] | null = null;
  let liables: ProduitLiable[] | null = null;
  let couleurs: CouleurVariante[] = [];
  try {
    [univers, liables] = await Promise.all([lireUniversAdmin(), lireProduitsLiables(null)]);
  } catch {
    console.error("[catalogue] lecture des univers impossible");
  }
  // L'autocomplétion des couleurs n'est qu'une aide : sans elle, la création continue avec une liste vide.
  try {
    couleurs = await lireCouleursUtilisees();
  } catch {
    console.error("[catalogue] lecture des couleurs impossible");
  }
  return (
    <CoqueAdmin>
      {/* Story 9.16 f (Q23) : la page reste sur sa route, dessinée en fenêtre ; Échap et la croix ramènent à la liste. */}
      {/* Sans formulaire rendu (lecture impossible), pas de bouton « Enregistrer » dans l'en-tête. */}
      <FenetreFormulaire titre={t("pageNouveau.titre")} retour="/admin/produits" idFormulaire={univers && liables ? ID_FORMULAIRE : undefined}>
        <div className="flex flex-col gap-6">
          <p className="t-body text-text-secondary">{t("pageNouveau.intro")}</p>
          {/* Sans lecture des univers, le formulaire n'est pas montré : il prétendrait qu'aucun univers n'existe. */}
          {univers && liables ? (
            <FormulaireProduit univers={univers} liables={liables} couleursUtilisees={couleurs} idFormulaire={ID_FORMULAIRE} />
          ) : (
            <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
          )}
        </div>
      </FenetreFormulaire>
    </CoqueAdmin>
  );
}

export default async function NouveauProduit({ params }: PageProps<"/[locale]/admin/produits/nouveau">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <NouveauSelonDroit locale={locale} />
    </Suspense>
  );
}
