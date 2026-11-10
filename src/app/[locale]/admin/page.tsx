import { hasLocale } from "next-intl";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CartesTaches } from "@/components/admin/tableau/CartesTaches";
import { CommandesPayees } from "@/components/admin/tableau/CommandesPayees";
import { GraphiqueBarres } from "@/components/admin/tableau/GraphiqueBarres";
import { Indicateurs } from "@/components/admin/tableau/Indicateurs";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { formaterUsd, serieParJour, sommeMontants, totalPar } from "@/modules/tableau-de-bord/calculs";
import { joursFenetre, lirePeriode, PERIODES, type Periode } from "@/modules/tableau-de-bord/periode";
import { lireTableauDeBord } from "@/modules/tableau-de-bord/queries";

const CHEMIN = "/admin";
const PRESTATAIRES = ["pawapay", "maishapay", "polar"] as const;
const FAMILLES = ["cosplay", "accessoire", "kit", "pass", "livraison"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Tableau de bord (story 9.8, partie 2) : réservé à l'Admin. Le droit est vérifié sur la page elle-même (le layout ne suffit pas),
// puis chaque fonction d'agrégats le revérifie en base. La page ne lit que les cinq fonctions de la partie 1, les vues de la
// story 9.7 et les compteurs de tâches ; aucune donnée personnelle n'est lue ni affichée.
async function TableauSelonDroit({ locale, recherche }: { locale: Locale; recherche: Promise<{ [cle: string]: string | string[] | undefined }> }) {
  await exigerAdminPage(locale, CHEMIN, "admin.acceder");
  await exigerAdminPage(locale, CHEMIN, "chiffre_affaires.voir");
  const { auteur } = await exigerAdminPage(locale, CHEMIN, "paiements.graphiques");
  // searchParams est une donnée de requête : lu ici, sous Suspense. Sans paramètre : commandes d'aujourd'hui et graphiques sur 30 jours ;
  // ?periode=7 : 7 jours partout ; ?periode=30 : graphiques sur 30 jours.
  const parametres = await recherche;
  const brut = Array.isArray(parametres.periode) ? parametres.periode[0] : parametres.periode;
  const periode: Periode = lirePeriode(brut);
  const septJours = brut === "7";
  const t = await getTranslations("Admin.tableau");
  const format = await getLocale();
  const maintenant = new Date();
  const donnees = await lireTableauDeBord({ auteur, maintenant, commandesSurSeptJours: septJours });

  const jours = joursFenetre(periode, maintenant);
  const fenetre = new Set(jours);
  const usd = (c: number) => formaterUsd(c, format);
  const nom = (cle: string, liste: readonly string[], espace: "prestataires" | "familles") =>
    liste.includes(cle) ? t(`${espace}.${cle}` as `prestataires.${(typeof PRESTATAIRES)[number]}`) : cle;
  const paiements = donnees.paiements;
  const vide = paiements !== null && paiements.every((l) => !fenetre.has(l.jour));
  const libelleJour = (jour: string) => new Intl.DateTimeFormat(format, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));

  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="t-h1">{t("titre")}</h1>
          <p className="t-body text-text-secondary">{t("intro")}</p>
        </header>

        <CommandesPayees commandes={donnees.commandesPayees} septJours={septJours} />

        <section aria-labelledby="tableau-graphiques" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="tableau-graphiques" className="t-h2">
              {t("graphiques.titre")}
            </h2>
            <div role="group" aria-label={t("periode.libelle")} className="flex gap-2">
              {PERIODES.map((n) => (
                <Link
                  key={n}
                  href={`/admin?periode=${n}`}
                  aria-current={n === periode ? "page" : undefined}
                  className={`t-label inline-flex min-h-touch items-center rounded-lg border px-4 text-text-primary no-underline ${n === periode ? "border-primary" : "border-border"}`}
                >
                  {t(`periode.${n}`)}
                </Link>
              ))}
            </div>
          </div>
          {paiements === null ? (
            <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
          ) : vide ? (
            <>
              <p className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{t("graphiques.vide")}</p>
              {periode !== 7 ? (
                <Link href="/admin?periode=7" className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                  {t("graphiques.lienSept")}
                </Link>
              ) : null}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-ecart-cartes lg:grid-cols-2">
              <GraphiqueBarres
                id="graphique-prestataire"
                titre={t("graphiques.parPrestataire")}
                total={t("graphiques.total", { montant: usd(sommeMontants(paiements, fenetre)) })}
                barres={totalPar(paiements, "prestataire", fenetre).map((x) => ({ libelle: nom(x.cle, PRESTATAIRES, "prestataires"), valeur: x.montantCents, texteValeur: usd(x.montantCents) }))}
              />
              <GraphiqueBarres
                id="graphique-famille"
                titre={t("graphiques.parFamille")}
                barres={totalPar(paiements, "famille", fenetre).map((x) => ({ libelle: nom(x.cle, FAMILLES, "familles"), valeur: x.montantCents, texteValeur: usd(x.montantCents) }))}
              />
              <div className="lg:col-span-2">
                <GraphiqueBarres
                  id="graphique-jour"
                  titre={t("graphiques.parJour")}
                  barres={serieParJour(paiements, jours).map((p) => ({ libelle: libelleJour(p.jour), valeur: p.montantCents, texteValeur: usd(p.montantCents) }))}
                />
              </div>
            </div>
          )}
        </section>

        <CartesTaches cartes={donnees.taches} />
        <Indicateurs donnees={donnees} maintenant={maintenant} />
      </div>
    </CoqueAdmin>
  );
}

export default async function Admin({ params, searchParams }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    // La session est une donnée de requête : sous Suspense, le reste de la page reste statique.
    <Suspense fallback={<Squelette />}>
      <TableauSelonDroit locale={locale} recherche={searchParams} />
    </Suspense>
  );
}
