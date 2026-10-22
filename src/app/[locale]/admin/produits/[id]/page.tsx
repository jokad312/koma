import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireProduitAdmin, lireUniversAdmin } from "@/modules/catalogue/queries";
import { idSchema } from "@/modules/catalogue/schemas";
import type { ProduitAdmin, UniversAdmin } from "@/modules/catalogue/types";

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
  if (!idSchema.safeParse(id).success) notFound();
  let produit: ProduitAdmin | null = null;
  let univers: UniversAdmin[] | null = null;
  let lecture = true;
  try {
    [produit, univers] = await Promise.all([lireProduitAdmin(id), lireUniversAdmin()]);
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
        {produit && univers ? <FormulaireProduit univers={univers} produit={produit} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
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
