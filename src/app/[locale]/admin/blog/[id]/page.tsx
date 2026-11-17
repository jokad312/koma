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
import { lireArticleAdmin } from "@/modules/blog/queries";
import type { Article, ProduitLien } from "@/modules/blog/types";
import { lireProduitsAdmin } from "@/modules/catalogue/queries";

const ID_FORMULAIRE = "formulaire-article";

// Page d'administration rendue à la demande : l'identifiant est une donnée de requête, jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/[id]">): Promise<Metadata> {
  // Seule la langue est lue : l'identifiant est une donnée de requête, lue sous Suspense dans la page.
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: "/admin/blog",
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Droit vérifié sur la page elle-même, puis lecture de l'article et des produits. Identifiant inconnu ou mal formé : 404.
async function ArticleSelonDroit({
  locale,
  id,
  searchParams,
}: {
  locale: Locale;
  id: string;
  searchParams: PageProps<"/[locale]/admin/blog/[id]">["searchParams"];
}) {
  const { auteur } = await exigerAdminPage(locale, `/admin/blog/${id}`, "blog.gerer");
  // Publier, dépublier, archiver et restaurer sont réservés à l'Admin en base : rôle relu côté serveur (même règle que la page 5).
  const peutPublier = auteur.role === "admin";
  const { cree: crees } = await searchParams;
  const cree = (Array.isArray(crees) ? crees[0] : crees) === "1";
  const t = await getTranslations("Admin.blog");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let article: Article | null = null;
  let produits: ProduitLien[] | null = null;
  let lecture = true;
  try {
    const [lu, liste] = await Promise.all([lireArticleAdmin(id), lireProduitsAdmin()]);
    article = lu;
    produits = produitsPourLien(liste, lu?.lienProduitId ?? null);
  } catch {
    lecture = false;
    console.error("[blog] lecture de l'article impossible");
  }
  if (lecture && !article) notFound();
  return (
    <CoqueAdmin>
      {/* Story 9.16 h (Q23) : la page reste sur sa route, dessinée en fenêtre (maquette 06) ; Échap et la croix ramènent à la liste. */}
      {/* Le menu STATUT (publication, dépublication, archivage, restauration) est dans la fenêtre, après l'image (DA6). */}
      <FenetreFormulaire titre={t("pageEdition.titre")} retour="/admin/blog" idFormulaire={article && produits ? ID_FORMULAIRE : undefined}>
        <div className="flex flex-col gap-6">
          {cree ? <MessageEtat type="succes">{t("pageEdition.cree")}</MessageEtat> : null}
          {article && produits ? (
            <FormulaireArticle
              article={article}
              produits={produits}
              idFormulaire={ID_FORMULAIRE}
              statut={{
                publie: article.publieLe !== null,
                archive: article.archiveLe !== null,
                titre: (locale === "en" ? article.titreEn : null) || article.titreFr,
                peutPublier,
              }}
            />
          ) : (
            <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
          )}
        </div>
      </FenetreFormulaire>
    </CoqueAdmin>
  );
}

export default async function ArticleAEditer({ params, searchParams }: PageProps<"/[locale]/admin/blog/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ArticleSelonDroit locale={locale} id={id} searchParams={searchParams} />
    </Suspense>
  );
}
