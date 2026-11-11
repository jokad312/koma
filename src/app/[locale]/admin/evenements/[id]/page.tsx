import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireEvenement } from "@/components/admin/FormulaireEvenement";
import { PublicationEvenement } from "@/components/admin/PublicationEvenement";
import { SectionAlertes } from "@/components/admin/SectionAlertes";
import { SectionCandidatures } from "@/components/admin/SectionCandidatures";
import { SectionBenevoles } from "@/components/admin/SectionBenevoles";
import { SectionGalerie } from "@/components/admin/SectionGalerie";
import { SectionVerrou } from "@/components/admin/SectionVerrou";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireNombresAlertes } from "@/modules/alertes/dependances";
import type { NombresAlertes } from "@/modules/alertes/types";
import { lireAccesBenevoles } from "@/modules/benevoles/dependances";
import type { AccesBenevole } from "@/modules/benevoles/types";
import type { CandidatureAdmin } from "@/modules/evenements/candidatures-admin";
import { lireCandidaturesAdmin } from "@/modules/evenements/candidatures-admin-queries";
import { lireEvenementAdmin, lireManquesPublication } from "@/modules/evenements/queries";
import type { Evenement } from "@/modules/evenements/types";
import { lireVerrouEvenement, type VerrouHorsLigne } from "@/modules/scan/queries";

// Les identifiants ne sont connus qu'à la requête. Un seul exemplaire factice permet à Next.js de préparer la coque statique de la route
// (la page lit la base sous Suspense et rend 404 pour un identifiant inconnu).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-4000-8000-000000000000" }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/evenements/[id]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: "/admin/evenements",
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Droit vérifié sur la page elle-même, puis lecture de l'Événement. Identifiant inconnu ou mal formé : 404.
async function EvenementSelonDroit({
  locale,
  id,
  searchParams,
}: {
  locale: Locale;
  id: string;
  searchParams: PageProps<"/[locale]/admin/evenements/[id]">["searchParams"];
}) {
  const { auteur } = await exigerAdminPage(locale, `/admin/evenements/${id}`, "evenements.gerer");
  const { cree: crees } = await searchParams;
  const cree = (Array.isArray(crees) ? crees[0] : crees) === "1";
  const t = await getTranslations("Admin.evenements");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let evenement: Evenement | null = null;
  let manques: string[] = [];
  let alertes: NombresAlertes | null = null;
  let lecture = true;
  try {
    evenement = await lireEvenementAdmin(id);
    if (evenement) manques = await lireManquesPublication(id);
  } catch {
    lecture = false;
    console.error("[evenements] lecture de l'événement impossible");
  }
  // Alertes « Me prévenir » (story 7.3) : une lecture en échec n'empêche pas d'éditer l'événement.
  let alertesLisibles = true;
  if (evenement) {
    try {
      alertes = await lireNombresAlertes(auteur, id);
    } catch {
      alertesLisibles = false;
      console.error("[alertes] lecture des alertes impossible");
    }
  }
  // Accès bénévoles de CET Événement (story 7.7, Admin seulement) : une lecture en échec n'empêche pas d'éditer l'événement.
  let benevoles: AccesBenevole[] | null = null;
  if (evenement) {
    try {
      benevoles = await lireAccesBenevoles(auteur, id);
    } catch {
      console.error("[benevoles] lecture des accès impossible");
    }
  }
  // Verrou hors ligne de CET Événement (story 7.8, Admin seulement) : une lecture en échec n'empêche pas d'éditer l'événement.
  let verrou: VerrouHorsLigne | null = null;
  let verrouLisible = true;
  if (evenement) {
    try {
      verrou = await lireVerrouEvenement(auteur, id);
    } catch {
      verrouLisible = false;
      console.error("[scan-hors-ligne] lecture du Verrou impossible");
    }
  }
  // Candidatures Stand de CET Événement (story 7.11, Admin seulement) : une lecture en échec n'empêche pas d'éditer l'événement.
  let candidatures: CandidatureAdmin[] | null = null;
  if (evenement) {
    try {
      candidatures = await lireCandidaturesAdmin(auteur, id);
    } catch {
      console.error("[candidatures-stand] lecture des candidatures impossible");
    }
  }
  if (lecture && !evenement) notFound();
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("pageEdition.titre")}</h1>
        <p>
          <Link href="/admin/evenements" className="t-label inline-flex min-h-touch items-center underline">
            {t("pageEdition.retour")}
          </Link>
        </p>
        {cree ? <MessageEtat type="succes">{t("pageEdition.cree")}</MessageEtat> : null}
        {evenement ? (
          <>
            <PublicationEvenement evenementId={evenement.id} publie={evenement.publieLe !== null} manques={manques} />
            {alertes ? <SectionAlertes evenementId={evenement.id} nombres={alertes} /> : null}
            {alertesLisibles ? null : <MessageEtat type="erreur">{t("alertes.erreurLecture")}</MessageEtat>}
            {benevoles ? <SectionBenevoles evenementId={evenement.id} acces={benevoles} /> : <MessageEtat type="erreur">{t("benevoles.erreurLecture")}</MessageEtat>}
            {verrouLisible ? <SectionVerrou evenementId={evenement.id} verrou={verrou} /> : <MessageEtat type="erreur">{t("verrou.erreurLecture")}</MessageEtat>}
            {candidatures ? <SectionCandidatures candidatures={candidatures} /> : <MessageEtat type="erreur">{t("candidatures.erreurLecture")}</MessageEtat>}
            <SectionGalerie evenementId={evenement.id} lien={evenement.galerieUrl ?? null} />
            <FormulaireEvenement evenement={evenement} />
          </>
        ) : (
          <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
        )}
      </div>
    </CoqueAdmin>
  );
}

export default async function EvenementAEditer({ params, searchParams }: PageProps<"/[locale]/admin/evenements/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <EvenementSelonDroit locale={locale} id={id} searchParams={searchParams} />
    </Suspense>
  );
}
