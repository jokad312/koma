import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { EvenementComplet } from "@/components/festival/EvenementComplet";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { extraireTexte } from "@/modules/blog/texte";
import { lireEvenementPublie } from "@/modules/evenements/queries-publiques";

type Props = PageProps<"/[locale]/festival/[slug]">;

// Adresse dynamique (l'Événement est lu à chaque requête) : la route est rendue à la demande, ce qui permet une vraie 404.
export const instant = false;

// Une seule lecture par requête, partagée par les métadonnées et la page.
// Une adresse mal formée n'atteint jamais la base ni le cache : 404 sans entrée de cache pour des adresses forgées.
const ADRESSE_VALIDE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const lireEvenement = cache(async (locale: "fr" | "en", slug: string) => (slug.length <= 80 && ADRESSE_VALIDE.test(slug) ? lireEvenementPublie(locale, slug) : null));

// Titre, description (extrait du programme, sinon le titre), première photo en Open Graph, hreflang fr et en.
// Événement inconnu ou non publié : 404. Lecture impossible : page non indexée.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  let evenement;
  try {
    evenement = await lireEvenement(locale, slug);
  } catch {
    console.error("[festival] lecture impossible");
    return { robots: { index: false, follow: false } };
  }
  if (!evenement) notFound();
  const premiere = evenement.images[0];
  return construireMetadata({
    locale,
    chemin: `/festival/${slug}`,
    titre: evenement.titre,
    description: (evenement.programme ? extraireTexte(evenement.programme) : null) ?? evenement.titre,
    nomSite: await lireNomSite(),
    ...(premiere ? { image: { url: premiere.url, alt: premiere.alt } } : {}),
  });
}

export default async function PageEvenement({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Festival" });

  let evenement;
  try {
    evenement = await lireEvenement(locale, slug);
  } catch {
    // Jamais une page inventée : message sobre, rien d'autre sur la page.
    console.error("[festival] lecture impossible");
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }
  if (!evenement) notFound();

  return <EvenementComplet evenement={evenement} locale={locale} />;
}
