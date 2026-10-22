import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

// Aucune page admin n'est indexée. Le layout ne vérifie aucun droit : chaque page appelle src/lib/auth/droits.ts
// et rend elle-même la coquille (navigation) une fois le droit confirmé.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return children;
}
