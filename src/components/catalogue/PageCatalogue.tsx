import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { filArianeJsonLd } from "@/lib/seo/jsonld";
import { construireMetadata } from "@/lib/seo/metadata";
import { urlLocalisee } from "@/lib/seo/url";
import { aFiltreOuTri, analyserRequete, encoderCurseur, sansCurseur, serialiserRequete, type RequeteBrute } from "@/modules/catalogue/adresse";
import { listerCatalogue, lireTranchesPrix, lireUniversPublics } from "@/modules/catalogue/queries";
import type { FamillePhysique } from "@/modules/catalogue/types";
import { FiltresCatalogue } from "./FiltresCatalogue";
import { GrilleProduits } from "./GrilleProduits";

// Dossier interne de chaque catalogue (l'adresse de chaque langue vient de src/i18n/adresses.ts) et clé des textes de métadonnées.
const CATALOGUES: Record<FamillePhysique, { chemin: string; cleMeta: "cosplays" | "accessoires" }> = {
  cosplay: { chemin: "/cosplays", cleMeta: "cosplays" },
  accessoire: { chemin: "/accessoires", cleMeta: "accessoires" },
};

const SEPARATEUR_FIL = "›";

type Props = { famille: FamillePhysique; locale: Locale; searchParams: Promise<RequeteBrute> };

// Métadonnées d'un catalogue. Page filtrée ou triée : noindex, follow, canonique vers la page de base.
// Page à curseur sans filtre : indexable, canonique propre (avec son curseur). Lit searchParams : métadonnées servies à la requête.
export async function metadataCatalogue({ famille, locale, searchParams }: Props): Promise<Metadata> {
  const { chemin, cleMeta } = CATALOGUES[famille];
  const t = await getTranslations({ locale, namespace: `Metadata.${cleMeta}` });
  const params = analyserRequete(await searchParams);
  const filtree = aFiltreOuTri(params);
  // Curseur périmé (plus rien après lui) ou lecture impossible : la page affichée est la première, donc le canonique est la page de base.
  let curseurValide = !filtree && params.curseur !== null;
  if (curseurValide) {
    try {
      curseurValide = (await listerCatalogue(famille, params, locale)).produits.length > 0;
    } catch {
      curseurValide = false;
    }
  }
  const requete = curseurValide && params.curseur ? serialiserRequete(sansCurseur(params), encoderCurseur(params.tri, params.curseur)) : "";
  return construireMetadata({
    locale,
    chemin,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: !filtree,
    suivreLesLiens: true,
    requete,
  });
}

export async function PageCatalogue({ famille, locale, searchParams }: Props) {
  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const { chemin } = CATALOGUES[famille];
  const titre = t(`titre.${famille}`);

  return (
    <section className="flex flex-col gap-6">
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: t("fil.accueil"), url: urlLocalisee(locale) },
          { nom: titre, url: urlLocalisee(locale, chemin) },
        ])}
      />
      <nav aria-label={t("fil.navigation")}>
        <ol className="t-small flex flex-wrap items-center gap-2 text-text-secondary">
          <li>
            <Link href="/" className="inline-flex min-h-touch items-center text-text-primary underline">
              {t("fil.accueil")}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li aria-current="page">{titre}</li>
        </ol>
      </nav>
      <TitreVitrine niveau={1}>{titre}</TitreVitrine>
      <Suspense fallback={<Squelette className="h-96 w-full" />}>
        <ContenuCatalogue famille={famille} locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

// Filtres, nombre de résultats et grille : lus à chaque requête (le badge dépend du stock et de la capacité : AD-17).
async function ContenuCatalogue({ famille, locale, searchParams }: Props) {
  // La lecture de l'adresse reste hors du try : elle sert de signal de rendu à la requête.
  const params = analyserRequete(await searchParams);
  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const chemin = cheminPublic(locale, CATALOGUES[famille].chemin);

  let page;
  let univers;
  let tranches;
  // Paramètres réellement servis : un curseur périmé (plus rien après lui) ramène à la première page.
  let servis = params;
  try {
    [page, univers, tranches] = await Promise.all([
      listerCatalogue(famille, params, locale, { cumul: true }),
      lireUniversPublics(locale),
      lireTranchesPrix(),
    ]);
    if (page.produits.length === 0 && params.curseur) {
      servis = { ...params, curseur: null };
      page = await listerCatalogue(famille, servis, locale);
    }
  } catch {
    // Jamais une liste vide inventée : message sobre, rien d'autre sur la page.
    console.error("[catalogue] lecture impossible");
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }

  // Aucun produit publié : une phrase courte, pas de filtre.
  if (page.produits.length === 0 && !aFiltreOuTri(servis)) {
    return <p className="t-body text-text-secondary">{t("vide")}</p>;
  }

  const requeteBase = serialiserRequete(sansCurseur(params));
  const requeteSuite = page.suite ? serialiserRequete(sansCurseur(params), page.suite) : null;

  return (
    <div className="flex flex-col gap-6">
      <FiltresCatalogue locale={locale} chemin={chemin} params={params} univers={univers} tranches={tranches} />
      {page.produits.length === 0 ? (
        <p role="status" className="t-body text-text-secondary">
          {t("videFiltres")}
        </p>
      ) : (
        <GrilleProduits
          cle={`${requeteBase}|${servis.curseur ? "curseur" : "debut"}|${page.produits[0].id}`}
          famille={famille}
          produits={page.produits}
          requeteSuite={requeteSuite}
          requeteBase={requeteBase}
        />
      )}
    </div>
  );
}
