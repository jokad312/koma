import { getTranslations } from "next-intl/server";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { lireNomSite } from "@/lib/reglages";
import { analyserRequeteMurs, type RequeteBrute } from "@/modules/communaute/adresse";
import { lireMurs, listerMurs } from "@/modules/communaute/queries";
import type { Locale } from "@/i18n/routing";
import { ListeMurs } from "./ListeMurs";

// Bloc 4 « Ils le portent » de l'accueil (FR-2, FR-40, UX-DR19) : le mur public des photos et Réalisations validées.
// Aucune photo publiée : le bloc n'existe pas (aucun titre, aucun texte, aucun espace).
// Sans JavaScript, « Voir plus » est un lien /<langue>?curseur=… : la page montre alors les entrées qui suivent ce curseur (lecture sans cache).
// Une erreur de lecture masque le bloc (jamais une liste vide inventée, jamais une page d'accueil en erreur).
export async function BlocMur({ locale, requete }: { locale: Locale; requete?: Promise<RequeteBrute> }) {
  let page;
  try {
    const curseur = requete ? analyserRequeteMurs(await requete) : null;
    page = curseur ? await lireMurs(curseur) : await listerMurs();
  } catch {
    console.error("[communaute] lecture du mur impossible : bloc masqué");
    return null;
  }
  if (page.murs.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.mur" });
  const nomSite = await lireNomSite();
  return (
    <section id="galerie" aria-labelledby="accueil-galerie" className="flex scroll-mt-24 flex-col gap-4">
      <div id="accueil-galerie">
        <TitreVitrine niveau={2}>{t("titre")}</TitreVitrine>
      </div>
      <ListeMurs cle={`debut|${page.murs[0].id}|${page.suite ?? "fin"}`} murs={page.murs} suite={page.suite} nomSite={nomSite} />
    </section>
  );
}
