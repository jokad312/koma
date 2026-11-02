import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Une seule entrée existe pour l'instant : « Mon compte » mène à la bibliothèque.
export default async function Compte({ params }: PageProps<"/[locale]/compte">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  redirect(`/${locale}/compte/bibliotheque`);
}
