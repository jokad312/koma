import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { EnvoiPhoto } from "@/components/admin/EnvoiPhoto";
import { FichiersKit } from "@/components/admin/FichiersKit";
import { FormulaireKit } from "@/components/admin/FormulaireKit";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { GaleriePhotos } from "@/components/admin/GaleriePhotos";
import { PublicationProduit } from "@/components/admin/PublicationProduit";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireProduitAdmin, lireProduitsLiables, lireUniversAdmin } from "@/modules/catalogue/queries";
import { idSchema } from "@/modules/catalogue/schemas";
import type { ProduitAdmin, ProduitLiable, UniversAdmin } from "@/modules/catalogue/types";

// Les identifiants de produits ne sont connus qu'à la requête (jamais à la compilation). Un seul exemplaire, jamais un vrai produit
// (la page lit la base sous Suspense et rend 404 pour un identifiant inconnu), permet à Next.js de préparer la coque statique de la route :
// sans lui, lire la langue dans params au niveau de la page bloque la compilation (Cache Components).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-4000-8000-000000000000" }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/produits/[id]">): Promise<Metadata> {
  // Seule la langue est lue : l'identifiant est une donnée de requête, lue sous Suspense dans la page.
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: "/admin/produits",
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Droit vérifié sur la page elle-même, puis lecture du produit et des univers. Identifiant inconnu ou mal formé : 404.
async function ProduitSelonDroit({
  locale,
  id,
  searchParams,
}: {
  locale: Locale;
  id: string;
  searchParams: PageProps<"/[locale]/admin/produits/[id]">["searchParams"];
}) {
  await exigerAdminPage(locale, `/admin/produits/${id}`, "produits.modifier");
  const { cree: crees } = await searchParams;
  const cree = (Array.isArray(crees) ? crees[0] : crees) === "1";
  const t = await getTranslations("Admin.produits");
  const tp = await getTranslations("Admin.produits.photos");
  const tk = await getTranslations("Admin.kits");
  if (!idSchema.safeParse(id).success) notFound();
  let produit: ProduitAdmin | null = null;
  let univers: UniversAdmin[] | null = null;
  let liables: ProduitLiable[] = [];
  let lecture = true;
  try {
    [produit, univers] = await Promise.all([lireProduitAdmin(id), lireUniversAdmin()]);
    // Un Kit propose les cosplays et accessoires sans Kit, plus celui qu'il lie déjà.
    if (produit?.famille === "kit") liables = await lireProduitsLiables(produit.id);
  } catch {
    lecture = false;
    console.error("[catalogue] lecture du produit impossible");
  }
  if (lecture && !produit) notFound();
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("pageEdition.titre")}</h1>
        <p>
          <Link href="/admin/produits" className="t-label inline-flex min-h-touch items-center underline">
            {t("pageEdition.retour")}
          </Link>
        </p>
        {cree ? <MessageEtat type="succes">{t("pageEdition.cree")}</MessageEtat> : null}
        {produit && univers && produit.famille === "kit" ? (
          <>
            {/* La publication d'un Kit (vidéo, fichiers, sous-titres) est définie par la story 3.2 : la base la refuse d'ici là. */}
            <MessageEtat type="information">{tk("pageEdition.publicationBientot")}</MessageEtat>
            <FormulaireKit univers={univers} liables={liables} produit={produit} />
            <section aria-labelledby="fichiers-titre" className="flex max-w-2xl flex-col gap-4">
              <h2 id="fichiers-titre" className="t-h2">
                {tk("fichiers.titre")}
              </h2>
              <FichiersKit produitId={produit.id} fichiers={produit.fichiers} />
            </section>
          </>
        ) : produit && univers ? (
          <>
            <PublicationProduit produitId={produit.id} publie={produit.publieLe !== null} />
            <FormulaireProduit univers={univers} produit={produit} />
            <section aria-labelledby="photos-titre" className="flex max-w-2xl flex-col gap-4">
              <h2 id="photos-titre" className="t-h2">
                {tp("titre")}
              </h2>
              <p className="t-body text-text-secondary">{tp("intro")}</p>
              <GaleriePhotos photos={produit.photos} />
              <EnvoiPhoto produitId={produit.id} />
            </section>
          </>
        ) : (
          <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
        )}
      </div>
    </CoqueAdmin>
  );
}

export default async function ProduitAEditer({ params, searchParams }: PageProps<"/[locale]/admin/produits/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ProduitSelonDroit locale={locale} id={id} searchParams={searchParams} />
    </Suspense>
  );
}
