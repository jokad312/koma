import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adresseAvecRequete, aFiltreOuTri, compterFiltres, sansCurseur, serialiserRequete } from "@/modules/catalogue/adresse";
import { TRIS_CATALOGUE } from "@/modules/catalogue/types";
import type { FiltreDisponibilite, ParamsCatalogue, TranchePrix, UniversChoix } from "@/modules/catalogue/types";
import { DetailsFiltres } from "./DetailsFiltres";

type Props = {
  locale: Locale;
  // Adresse de la page, propre à la langue (sans préfixe de langue).
  chemin: string;
  params: ParamsCatalogue;
  univers: UniversChoix[];
  tranches: TranchePrix[];
};

const PILULE =
  "t-small inline-flex min-h-touch items-center rounded-full border px-4 no-underline aria-[current=true]:border-2 aria-[current=true]:border-primary aria-[current=true]:font-semibold border-border-field bg-surface text-text-primary";

type Choix = { cle: string; libelle: string; actif: boolean; href: string };

// Filtres en liens (aucun JavaScript requis) : une pilule de 44 px par choix, aria-current sur le choix actif.
// Changer un filtre ou le tri ramène à la première page (le curseur n'est jamais conservé).
export async function FiltresCatalogue({ locale, chemin, params, univers, tranches }: Props) {
  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const lien = (changement: Partial<ParamsCatalogue>) =>
    adresseAvecRequete(chemin, serialiserRequete({ ...sansCurseur(params), ...changement }));

  const groupes: Array<{ cle: string; titre: string; choix: Choix[] }> = [];

  if (univers.length > 0) {
    groupes.push({
      cle: "univers",
      titre: t("filtres.univers"),
      choix: [
        { cle: "tous", libelle: t("filtres.tous"), actif: params.univers === null, href: lien({ univers: null }) },
        ...univers.map((u) => ({ cle: u.id, libelle: u.nom, actif: params.univers === u.id, href: lien({ univers: u.id }) })),
      ],
    });
  }

  if (tranches.length > 0) {
    groupes.push({
      cle: "prix",
      titre: t("filtres.prix"),
      choix: [
        { cle: "tous", libelle: t("filtres.tous"), actif: params.prixBas === null, href: lien({ prixBas: null, prixHaut: null }) },
        ...tranches.map((tr) => ({
          cle: String(tr.ordre),
          libelle: locale === "fr" ? tr.libelleFr : tr.libelleEn,
          actif: params.prixBas === tr.basCents && params.prixHaut === tr.hautCents,
          href: lien({ prixBas: tr.basCents, prixHaut: tr.hautCents }),
        })),
      ],
    });
  }

  const dispos: Array<{ cle: FiltreDisponibilite; libelle: string }> = [
    { cle: "en_stock", libelle: t("filtres.enStock") },
    { cle: "sur_commande", libelle: t("filtres.surCommande") },
  ];
  groupes.push({
    cle: "dispo",
    titre: t("filtres.disponibilite"),
    choix: [
      { cle: "tous", libelle: t("filtres.tous"), actif: params.dispo === null, href: lien({ dispo: null }) },
      ...dispos.map((d) => ({ cle: d.cle, libelle: d.libelle, actif: params.dispo === d.cle, href: lien({ dispo: d.cle }) })),
    ],
  });

  groupes.push({
    cle: "tri",
    titre: t("filtres.tri"),
    choix: TRIS_CATALOGUE.map((tri) => ({ cle: tri, libelle: t(`tri.${tri}`), actif: params.tri === tri, href: lien({ tri }) })),
  });

  return (
    <div className="flex flex-col gap-3">
      <DetailsFiltres resume={t("filtres.ouvrir", { n: compterFiltres(params) })}>
        {groupes.map((g) => (
          <section key={g.cle} aria-labelledby={`filtre-${g.cle}`} className="flex flex-col gap-2">
            <h2 id={`filtre-${g.cle}`} className="t-label">
              {g.titre}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {g.choix.map((c) => (
                <li key={c.cle}>
                  <Link href={c.href} aria-current={c.actif ? "true" : undefined} className={PILULE}>
                    {c.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DetailsFiltres>
      {aFiltreOuTri(params) ? <EffacerFiltres chemin={chemin} libelle={t("filtres.effacer")} /> : null}
    </div>
  );
}

// « Effacer les filtres » : retour à la page de base (sans filtre, tri par défaut, première page).
export function EffacerFiltres({ chemin, libelle }: { chemin: string; libelle: string }) {
  return (
    <Link href={chemin} className="t-small inline-flex min-h-touch w-fit items-center text-text-primary underline">
      {libelle}
    </Link>
  );
}
