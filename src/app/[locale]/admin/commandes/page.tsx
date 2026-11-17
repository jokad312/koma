import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { ListeCommandesAdmin } from "@/components/admin/ListeCommandesAdmin";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { droitAutorise, exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import {
  FAMILLES_FILTRE,
  filtreValide,
  lireRevenuPaye,
  listerCommandesAdmin,
  pageValide,
  PRESTATAIRES_FILTRE,
  rechercheValide,
  STATUTS_FILTRE,
  ZONES_FILTRE,
  type FiltresCommandes,
  type PageCommandesAdmin,
} from "@/modules/commande/admin-queries";

const CHEMIN = "/admin/commandes";

// Page d'administration rendue à la demande : jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/commandes">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par la fonction commandes_admin_liste (droit revérifié en base).
// Filtres, recherche et page lus dans l'adresse, chacun contrôlé (listes fermées, texte borné, entier borné). La carte REVENU PAYÉ n'est lue et
// rendue que pour qui a le droit chiffre_affaires.voir (l'Admin) ; l'Assistant voit les trois autres cartes et la même liste.
async function CommandesSelonDroit({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/admin/commandes">["searchParams"] }) {
  const { auteur } = await exigerAdminPage(locale, CHEMIN, "commandes.voir");
  const t = await getTranslations("Admin.commandes");
  const q = await searchParams;
  const filtres: FiltresCommandes = {
    statut: filtreValide(q.statut, STATUTS_FILTRE),
    famille: filtreValide(q.famille, FAMILLES_FILTRE),
    prestataire: filtreValide(q.prestataire, PRESTATAIRES_FILTRE),
    zone: filtreValide(q.zone, ZONES_FILTRE),
    q: rechercheValide(q.q),
  };
  const voitRevenu = droitAutorise(auteur.role, "chiffre_affaires.voir");
  let lue: PageCommandesAdmin | null = null;
  let revenu: number | null | undefined;
  try {
    [lue, revenu] = await Promise.all([listerCommandesAdmin(auteur, filtres, pageValide(q.page)), voitRevenu ? lireRevenuPaye(auteur).catch(() => null) : Promise.resolve(undefined)]);
  } catch {
    console.error("[commande] lecture admin impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1 uppercase">{t("titre")}</h1>
        {lue ? <ListeCommandesAdmin liste={lue} filtres={filtres} revenu={revenu} locale={locale} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function CommandesAdmin({ params, searchParams }: PageProps<"/[locale]/admin/commandes">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <CommandesSelonDroit locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}
