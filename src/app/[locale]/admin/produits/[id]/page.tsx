import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ChapitresKit } from "@/components/admin/ChapitresKit";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FichiersKit } from "@/components/admin/FichiersKit";
import { FormulaireKit } from "@/components/admin/FormulaireKit";
import { FormulaireProduit } from "@/components/admin/FormulaireProduit";
import { GaleriePhotos } from "@/components/admin/GaleriePhotos";
import { SousTitresExtraitKit } from "@/components/admin/SousTitresExtraitKit";
import { SousTitresKit } from "@/components/admin/SousTitresKit";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import { VideoKit } from "@/components/admin/VideoKit";
import { ZonesEnTete, type ProduitEnTete } from "@/components/admin/ZonesEnTete";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { bunnyConfigure } from "@/lib/bunny/config";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireCouleursUtilisees, lireProduitAdmin, lireProduitsLiables, lireUniversAdmin } from "@/modules/catalogue/queries";
import { idSchema } from "@/modules/catalogue/schemas";
import type { CouleurVariante, ProduitAdmin, ProduitLiable, UniversAdmin } from "@/modules/catalogue/types";

// Formulaire principal, soumis par « Enregistrer » de la fenêtre.
const ID_FORMULAIRE = "formulaire-produit";

// Page d'administration rendue à la demande : l'identifiant est une donnée de requête, jamais indexée.
export const instant = false;

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
  let couleurs: CouleurVariante[] = [];
  let lecture = true;
  try {
    [produit, univers] = await Promise.all([lireProduitAdmin(id), lireUniversAdmin()]);
    // Un Vêtement propose en autocomplétion les couleurs déjà utilisées (story 9.15) ; un échec ne bloque pas la page (liste vide).
    if (produit?.famille === "vetement") {
      couleurs = await lireCouleursUtilisees().catch(() => {
        console.error("[catalogue] lecture des couleurs impossible");
        return [];
      });
    }
    // Un Kit propose les cosplays et accessoires sans Kit, plus celui qu'il lie déjà.
    if (produit?.famille === "kit") liables = await lireProduitsLiables(produit.id);
  } catch {
    lecture = false;
    console.error("[catalogue] lecture du produit impossible");
  }
  if (lecture && !produit) notFound();
  // Présence des variables Bunny (jamais leur valeur) : sans elles, l'envoi de vidéo est désactivé et expliqué.
  const bunnyPrive = bunnyConfigure("prive");
  const bunnyPublic = bunnyConfigure("public");
  // Zones de la maquette placées entre les champs du haut et le reste (story 9.16 f) : fichiers du Kit, image (photo principale en vignette), STATUT.
  const enTete: ProduitEnTete | null = produit
    ? { id: produit.id, titre: (locale === "en" ? produit.titreEn : null) || produit.titreFr, publie: produit.publieLe !== null, archive: Boolean(produit.archiveLe), photo: produit.photos[0] ?? null }
    : null;
  const photos = produit ? (
    <section aria-labelledby="photos-titre" className="flex max-w-2xl flex-col gap-4">
      <h2 id="photos-titre" className="t-h2">
        {tp("titre")}
      </h2>
      <p className="t-body text-text-secondary">{tp("intro")}</p>
      <GaleriePhotos photos={produit.photos} />
    </section>
  ) : null;
  return (
    <CoqueAdmin>
      {/* Story 9.16 f (Q23) : la page reste sur sa route, dessinée en fenêtre ; Échap et la croix ramènent à la liste. */}
      {/* Sans formulaire rendu (lecture impossible), pas de bouton « Enregistrer » dans l'en-tête. */}
      <FenetreFormulaire titre={t("pageEdition.titre")} retour="/admin/produits" idFormulaire={produit && univers && enTete ? ID_FORMULAIRE : undefined}>
        <div className="flex flex-col gap-8">
          {cree ? <MessageEtat type="succes">{t("pageEdition.cree")}</MessageEtat> : null}
          {produit && univers && enTete && produit.famille === "kit" ? (
            <>
              <FormulaireKit univers={univers} liables={liables} produit={produit} idFormulaire={ID_FORMULAIRE} milieu={<ZonesEnTete produit={enTete} kit />} />
              <section aria-labelledby="fichiers-titre" className="flex max-w-2xl flex-col gap-4">
                <h2 id="fichiers-titre" className="t-h2">
                  {tk("fichiers.titre")}
                </h2>
                {/* La zone d'ajout est en tête de la fenêtre (maquette D12) ; ici, la liste, le remplacement et la suppression. */}
                <FichiersKit produitId={produit.id} fichiers={produit.fichiers} ajout={false} />
              </section>
              <VideoKit produitId={produit.id} genre="complete" dureeSecondes={produit.video?.dureeSecondes ?? null} extraitPresent={false} bunnyConfigure={bunnyPrive} />
              <VideoKit
                produitId={produit.id}
                genre="extrait"
                dureeSecondes={produit.video?.dureeSecondes ?? null}
                extraitPresent={produit.video?.extrait ?? false}
                bunnyConfigure={bunnyPublic}
              />
              {produit.video?.extrait ? (
                <SousTitresExtraitKit produitId={produit.id} sansParole={produit.video.extraitSansParole} langues={produit.video.extraitSousTitres} />
              ) : null}
              <ChapitresKit produitId={produit.id} chapitres={produit.chapitres} dureeSecondes={produit.video?.dureeSecondes ?? null} />
              <SousTitresKit produitId={produit.id} sousTitres={produit.sousTitres} />
              {photos}
            </>
          ) : produit && univers && enTete ? (
            <>
              <FormulaireProduit univers={univers} produit={produit} couleursUtilisees={couleurs} idFormulaire={ID_FORMULAIRE} milieu={<ZonesEnTete produit={enTete} kit={false} />} />
              {photos}
            </>
          ) : (
            <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
          )}
        </div>
      </FenetreFormulaire>
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
