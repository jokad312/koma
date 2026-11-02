import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { lireKitBibliotheque, type DetailKitBibliotheque } from "@/modules/bibliotheque/queries";
import { tailleLisible } from "@/modules/catalogue/fichiers-kit";
import { BoutonTelecharger } from "./BoutonTelecharger";
import { LecteurVideoKit } from "./LecteurVideoKit";
import { CHEMIN_BIBLIOTHEQUE, versConnexionBibliotheque } from "./PageBibliotheque";

// Un Kit de la bibliothèque : ses fichiers actuels (un fichier ajouté ou remplacé après l'achat apparaît ici sans rien racheter, FR-30).
// Un Kit sans accès pour ce Compte donne une 404, comme un Kit inconnu.
export async function PageKitBibliotheque({ locale, slug }: { locale: Locale; slug: string }) {
  const session = await lireSessionVerifiee();
  if (!session) versConnexionBibliotheque(locale, `/${slug}`);
  const t = await getTranslations({ locale, namespace: "Bibliotheque" });
  const tk = await getTranslations({ locale, namespace: "Kit.fichiers" });

  let kit: DetailKitBibliotheque | null;
  try {
    kit = await lireKitBibliotheque(session.compteId, slug);
  } catch {
    console.error("[bibliotheque] lecture d'un kit impossible");
    return <MessageEtat type="erreur">{t("indisponible")}</MessageEtat>;
  }
  if (!kit) notFound();

  const titre = (locale === "en" ? kit.titre.en : null) ?? kit.titre.fr;
  return (
    <div className="flex flex-col gap-6">
      <Link href={CHEMIN_BIBLIOTHEQUE} className="t-small underline underline-offset-4">
        {t("detail.retour")}
      </Link>
      <h2 className="t-h2">{titre}</h2>
      {kit.video ? (
        <section aria-labelledby="video-titre" className="flex flex-col gap-4">
          <h3 id="video-titre" className="t-h3">
            {t("video.titre")}
          </h3>
          <LecteurVideoKit
            produitId={kit.produitId}
            slug={kit.slug}
            titre={titre}
            locale={locale}
            dureeSecondes={kit.video.dureeSecondes}
            chapitres={kit.video.chapitres.map((c) => ({ id: c.id, titre: locale === "en" ? c.titre.en : c.titre.fr, debutSecondes: c.debutSecondes }))}
            sousTitres={kit.video.sousTitres}
          />
        </section>
      ) : null}
      <section aria-labelledby="fichiers-titre" className="flex flex-col gap-4">
        <h3 id="fichiers-titre" className="t-h3">
          {t("detail.fichiers")}
        </h3>
        {kit.fichiers.length === 0 ? (
          <p>{t("detail.aucunFichier")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {kit.fichiers.map((f) => {
              const { valeur, unite } = tailleLisible(f.tailleOctets, locale);
              return (
                <li key={f.id}>
                  <BoutonTelecharger
                    fichierId={f.id}
                    nom={locale === "en" ? f.nom.en : f.nom.fr}
                    format={tk(`formats.${f.format}`)}
                    taille={tk(`taille.${unite}`, { valeur })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
