import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ChampRecherche } from "@/components/admin/ui/ChampRecherche";
import { FenetreFormulaire } from "@/components/admin/ui/FenetreFormulaire";
import { Pagination } from "@/components/admin/ui/Pagination";
import { Panneau } from "@/components/admin/ui/Panneau";
import { PastilleFiltre } from "@/components/admin/ui/PastilleFiltre";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import {
  adresseCodes,
  FILTRES_CODES,
  filtrerCodes,
  filtreCodesValide,
  idCodeValide,
  pageCodesValide,
  paginerCodes,
  RECHERCHE_CODES_MAX,
  rechercheCodesValide,
  type ParametresCodes,
} from "@/modules/promo/liste";
import { lireCodesPromoAdmin } from "@/modules/promo/queries";
import type { CodePromo } from "@/modules/promo/types";
import { CoqueAdmin } from "./CoqueAdmin";
import { AnnoncesCodesPromo } from "./AnnoncesCodesPromo";
import { FormulaireCodePromo } from "./FormulaireCodePromo";
import { ListeCodesPromo } from "./ListeCodesPromo";
import { nb } from "@/components/ui/Nombre";

const ID_FORMULAIRE = "formulaire-code-promo";

// Contenu de la page /admin/codes-promo selon la maquette 07-codes-promo (story 9.16 i, CP1 à CP9). Droit vérifié sur la page elle-même (le layout ne
// suffit pas), puis lecture par le client service. Une lecture impossible affiche un message sobre, jamais une liste vide.
// Filtre (TOUS, ACTIFS, INACTIFS), recherche (code, affilié) et page sont lus dans l'adresse et appliqués à la liste lue (aucune nouvelle requête) :
// la page marche sans JavaScript (formulaire GET, liens). « + NOUVEAU CODE » (?nouveau=1) et le crayon (?modifier=<id>) ouvrent les formulaires existants
// dans une fenêtre sur la même route (Q23) ; Échap et × ramènent à la liste avec ses filtres.
export async function CodesPromoSelonDroit({
  locale,
  chemin,
  recherche = {},
}: {
  locale: Locale;
  chemin: string;
  recherche?: Record<string, string | string[] | undefined>;
}) {
  await exigerAdminPage(locale, chemin, "codes_promo.gerer");
  const t = await getTranslations("Admin.codesPromo");
  let codes: CodePromo[] | null = null;
  try {
    codes = await lireCodesPromoAdmin();
  } catch {
    console.error("[promo] lecture des codes promo impossible");
  }

  const demandes = {
    filtre: filtreCodesValide(recherche.filtre),
    q: rechercheCodesValide(recherche.q),
  };
  const filtres = codes ? filtrerCodes(codes, demandes.filtre, demandes.q) : [];
  const page = paginerCodes(filtres, pageCodesValide(recherche.page));
  // Page ramenée à la dernière existante PARTOUT (liste, retour de la fenêtre, liens) : jamais « ?page=9 » gardé pour 2 pages.
  const parametres: ParametresCodes = { ...demandes, page: page.page };
  const retour = adresseCodes(parametres);
  const nouveau = recherche.nouveau === "1";
  const idModifie = nouveau ? undefined : idCodeValide(recherche.modifier);
  const modifie = idModifie && codes ? codes.find((c) => c.id === idModifie) : undefined;
  // Fenêtre ouverte : fond plein écran « sans la liste derrière » (Q23 a) ; la liste n'est pas rendue.
  const fenetreOuverte = nouveau || Boolean(idModifie);
  const avecRecherche = Boolean(parametres.q);

  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="t-h1 uppercase">{t("titre")}</h1>
          <Link
            href={adresseCodes(parametres, { nouveau: true })}
            className="t-label inline-flex min-h-touch items-center gap-2 rounded-full bg-primary px-6 py-3 uppercase text-on-primary no-underline"
          >
            <Plus aria-hidden="true" className="size-5" />
            {t("nouveau")}
          </Link>
        </div>
        <p className="t-body text-text-secondary">{t("intro")}</p>

        {fenetreOuverte ? null : codes ? (
          <Panneau>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <form method="get" role="search" aria-label={t("recherche.libelle")} className="flex w-full min-w-0 max-w-[480px] flex-wrap items-center gap-3">
                  {parametres.filtre !== "tous" ? <input type="hidden" name="filtre" value={parametres.filtre} /> : null}
                  {/* 200 px au moins : à 390 px, « Rechercher » passe à la ligne au lieu d'écraser le champ. */}
                  <div className="min-w-[200px] flex-1">
                    <ChampRecherche
                      key={retour}
                      libelle={t("recherche.libelle")}
                      placeholder={t("recherche.indication")}
                      name="q"
                      defaultValue={parametres.q ?? ""}
                      maxLength={RECHERCHE_CODES_MAX}
                      enterKeyHint="search"
                    />
                  </div>
                  <button type="submit" className="t-label inline-flex min-h-touch items-center rounded-full border border-border-field px-5 text-text-primary">
                    {t("recherche.lancer")}
                  </button>
                </form>
                <ul aria-label={t("filtres.libelle")} className="flex flex-wrap gap-2">
                  {FILTRES_CODES.map((f) => (
                    <li key={f}>
                      <PastilleFiltre
                        actif={parametres.filtre === f}
                        href={adresseCodes({
                          ...parametres,
                          filtre: f,
                          page: 1,
                        })}
                      >
                        {t(`filtres.${f}`)}
                      </PastilleFiltre>
                    </li>
                  ))}
                </ul>
              </div>
              <AnnoncesCodesPromo
                compteur={t.markup("nombre", { nombre: filtres.length, nb: (n) => n })}
                affichage={t.rich("nombre", { nombre: filtres.length, nb })}
                apresCompteur={
                  avecRecherche ? (
                    <Link
                      href={adresseCodes({
                        ...parametres,
                        q: undefined,
                        page: 1,
                      })}
                      className="t-body inline-flex min-h-touch items-center text-text-primary underline"
                    >
                      {t("recherche.effacer")}
                    </Link>
                  ) : null
                }
              >
                {codes.length === 0 ? (
                  <p className="t-body text-text-secondary">{t("vide")}</p>
                ) : filtres.length === 0 ? (
                  <p className="t-body text-text-secondary">{t("aucunResultat")}</p>
                ) : (
                  <ListeCodesPromo codes={page.lignes} debut={page.debut} parametres={{ ...parametres, page: page.page }} locale={locale} />
                )}
              </AnnoncesCodesPromo>
              <Pagination page={page.page} total={page.pages} adresse={(n) => adresseCodes({ ...parametres, page: n })} />
            </div>
          </Panneau>
        ) : (
          <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
        )}

        {nouveau ? (
          <FenetreFormulaire titre={t("creation.titre")} retour={retour} idFormulaire={ID_FORMULAIRE}>
            <FormulaireCodePromo idFormulaire={ID_FORMULAIRE} />
          </FenetreFormulaire>
        ) : null}
        {idModifie ? (
          <FenetreFormulaire titre={t("modification.titre")} retour={retour} idFormulaire={modifie ? ID_FORMULAIRE : undefined}>
            {modifie ? (
              <FormulaireCodePromo key={modifie.id} code={modifie} idFormulaire={ID_FORMULAIRE} />
            ) : (
              <MessageEtat type="erreur">{codes ? t("erreurs.introuvable") : t("erreurLecture")}</MessageEtat>
            )}
          </FenetreFormulaire>
        ) : null}
      </div>
    </CoqueAdmin>
  );
}
