import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { DetailCommandeAdmin } from "@/components/admin/DetailCommandeAdmin";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite, lireNumeroWhatsappOuNull } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireCommandeAdmin, type CommandeAdminDetail } from "@/modules/commande/admin-queries";

// Page d'administration rendue à la demande : jamais indexée, le numéro n'est pas dans le titre.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/commandes/[numero]">): Promise<Metadata> {
  const { locale, numero } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  return construireMetadata({ locale, chemin: `/admin/commandes/${encodeURIComponent(numero)}`, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function DetailSelonDroit({ locale, numero }: { locale: Locale; numero: string }) {
  await exigerAdminPage(locale, `/admin/commandes/${encodeURIComponent(numero)}`, "commandes.voir");
  const t = await getTranslations("Admin.commandes");
  let commande: CommandeAdminDetail | null = null;
  try {
    commande = await lireCommandeAdmin(numero);
  } catch {
    console.error("[commande] lecture admin du détail impossible");
    return (
      <CoqueAdmin>
        <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
      </CoqueAdmin>
    );
  }
  if (!commande) notFound();
  return (
    <CoqueAdmin>
      <DetailCommandeAdmin commande={commande} locale={locale} numeroWhatsappAbsent={(await lireNumeroWhatsappOuNull()) === null} />
    </CoqueAdmin>
  );
}

export default async function DetailCommandeAdminPage({ params }: PageProps<"/[locale]/admin/commandes/[numero]">) {
  const { locale, numero } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!/^KS-[0-9]{4}-[0-9]{6,}$/.test(numero)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <DetailSelonDroit locale={locale} numero={numero} />
    </Suspense>
  );
}
