import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";

// Au lancement, la seule page admin est Réglages : /admin y redirige, après la vérification du droit.
async function VersReglages({ locale }: { locale: Locale }): Promise<never> {
  await exigerAdminPage(locale, "/admin");
  redirect(`/${locale}/admin/reglages`);
}

export default async function Admin({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // La session est une donnée de requête : sous Suspense, le reste de la page reste statique.
  return (
    <Suspense fallback={<Squelette />}>
      <VersReglages locale={locale} />
    </Suspense>
  );
}
