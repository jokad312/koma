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
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { FAMILLES_FILTRE, filtreValide, listerCommandesAdmin, PRESTATAIRES_FILTRE, STATUTS_FILTRE, TAILLE_PAGE_ADMIN, ZONES_FILTRE, type FiltresCommandes } from "@/modules/commande/admin-queries";

const CHEMIN = "/admin/commandes";

// Page d'administration rendue à la demande : jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/commandes">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le client service. Filtres et pagination lus dans l'adresse,
// chacun contre une liste fermée (jamais une valeur libre transmise à la base).
async function CommandesSelonDroit({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/admin/commandes">["searchParams"] }) {
  await exigerAdminPage(locale, CHEMIN, "commandes.voir");
  const t = await getTranslations("Admin.commandes");
  const q = await searchParams;
  const filtres: FiltresCommandes = {
    statut: filtreValide(q.statut, STATUTS_FILTRE),
    famille: filtreValide(q.famille, FAMILLES_FILTRE),
    prestataire: filtreValide(q.prestataire, PRESTATAIRES_FILTRE),
    zone: filtreValide(q.zone, ZONES_FILTRE),
  };
  const brut = Number(Array.isArray(q.n) ? q.n[0] : q.n);
  const nombre = Number.isInteger(brut) && brut >= TAILLE_PAGE_ADMIN && brut <= 240 && brut % TAILLE_PAGE_ADMIN === 0 ? brut : TAILLE_PAGE_ADMIN;
  let lue = null;
  try {
    lue = await listerCommandesAdmin(filtres, nombre);
  } catch {
    console.error("[commande] lecture admin impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        {lue ? <ListeCommandesAdmin commandes={lue.commandes} total={lue.total} filtres={filtres} nombre={nombre} locale={locale} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
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
