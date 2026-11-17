"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { prixPourSaisie } from "@/lib/argent";
import { enregistrerKit, type EtatProduit } from "@/modules/catalogue/actions";
import { proposerSlug } from "@/modules/catalogue/slug";
import { NIVEAUX_KIT } from "@/modules/catalogue/types";
import type { ChampProduit, ProduitAdmin, ProduitLiable, UniversAdmin } from "@/modules/catalogue/types";
import { ChampTexte, useClassesChamp } from "./ChampTexte";
import { ChoixFamille } from "./ChoixFamille";
import { useEnregistrementFenetre } from "./ui/FenetreFormulaire";
import { ZonesEnTete } from "./ZonesEnTete";

// Saisie commune à toutes les familles, reprise quand la famille Kit est choisie à la création (story 9.16 f).
export type ValeursCommunes = {
  titreFr: string;
  titreEn: string;
  slug: string;
  slugModifie: boolean;
  descriptionFr: string;
  descriptionEn: string;
  universId: string;
  prix: string;
};

type Props = {
  univers: readonly UniversAdmin[];
  // Cosplays et accessoires sans Kit, plus celui du Kit édité.
  liables: readonly ProduitLiable[];
  // Kit à modifier ; absent : création d'un brouillon.
  produit?: ProduitAdmin | null;
  // Choix de la famille (création) ; absent : la famille du Kit existant s'affiche sans choix.
  choixFamille?: ReactNode;
  // Story 9.16 f : identifiant du formulaire principal (soumis par « Enregistrer » de la fenêtre) ; zones de la maquette placées entre les champs du
  // haut et le reste (fichiers, image, statut ; absentes à la création) ; saisie commune reprise du formulaire des autres familles, et rendue.
  idFormulaire?: string;
  milieu?: ReactNode;
  initial?: Partial<ValeursCommunes>;
  onCommun?: (valeurs: ValeursCommunes) => void;
};

// Création et modification d'un brouillon de Kit. Le succès n'apparaît qu'après la réponse de l'action serveur, la saisie est conservée
// après un échec (champs contrôlés), aucun choix ne déclenche d'action. Pas de tailles, de délai ni de stock : un Kit est numérique.
export function FormulaireKit({ univers, liables, produit = null, choixFamille, idFormulaire, milieu, initial, onCommun }: Props) {
  const t = useTranslations("Admin.kits.formulaire");
  const tf = useTranslations("Admin.produits.famille");
  const tfo = useTranslations("Admin.kits.fichiers.formats");
  const locale = useLocale();
  const router = useRouter();
  const base = useId();
  const classes = useClassesChamp();
  const idForm = idFormulaire ?? `${base}-formulaire`;

  const [titreFr, setTitreFr] = useState(produit?.titreFr ?? initial?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(produit?.titreEn ?? initial?.titreEn ?? "");
  const [slug, setSlug] = useState(produit?.slug ?? initial?.slug ?? "");
  // Tant que l'adresse n'a pas été modifiée à la main, elle suit le titre français ; une adresse déjà enregistrée n'est jamais recalculée.
  const [slugModifie, setSlugModifie] = useState(produit !== null || (initial?.slugModifie ?? false));
  const [descriptionFr, setDescriptionFr] = useState(produit?.descriptionFr ?? initial?.descriptionFr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(produit?.descriptionEn ?? initial?.descriptionEn ?? "");
  const [materielFr, setMaterielFr] = useState(produit?.materielFr ?? "");
  const [materielEn, setMaterielEn] = useState(produit?.materielEn ?? "");
  const [universId, setUniversId] = useState(produit?.universId ?? initial?.universId ?? "");
  const [prix, setPrix] = useState(produit ? prixPourSaisie(produit.prixCents) : (initial?.prix ?? prixPourSaisie(null)));
  const [niveau, setNiveau] = useState<string>(produit?.niveau ?? "");
  const [lieId, setLieId] = useState(produit?.produitLieId ?? "");

  const [etat, setEtat] = useState<EtatProduit | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  // Après une création réussie, le bouton reste occupé jusqu'à la redirection : pas de second envoi.
  const [redirige, setRedirige] = useState(false);
  const refResume = useRef<HTMLDivElement>(null);
  const { enregistre, source } = useEnregistrementFenetre(enCours || redirige);

  // Saisie commune rendue au formulaire des autres familles (création), pour un retour vers Cosplay, Accessoire, Vêtement ou Autre article.
  const refCommun = useRef(onCommun);
  useEffect(() => {
    refCommun.current = onCommun;
  });
  useEffect(() => {
    refCommun.current?.({ titreFr, titreEn, slug, slugModifie, descriptionFr, descriptionEn, universId, prix });
  }, [titreFr, titreEn, slug, slugModifie, descriptionFr, descriptionEn, universId, prix]);

  // Après un échec, le focus va au résumé d'erreur (annoncé en alerte).
  useEffect(() => {
    if (etat?.statut === "erreur") refResume.current?.focus();
  }, [etat]);

  function changerTitreFr(valeur: string) {
    setTitreFr(valeur);
    if (!slugModifie) setSlug(proposerSlug(valeur));
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    enVol.current = true;
    setEtat(null);
    demarrer(async () => {
      let redirection = false;
      try {
        const resultat = await enregistrerKit({
          id: produit?.id ?? "",
          slug,
          titreFr,
          titreEn,
          descriptionFr,
          descriptionEn,
          materielFr,
          materielEn,
          universId,
          prix,
          niveau,
          produitLieId: lieId,
        });
        if (resultat.statut === "succes" && resultat.cree) {
          // Création : redirection vers la fiche d'édition, qui affiche la confirmation et la section des fichiers.
          redirection = true;
          setRedirige(true);
          router.push(`/admin/produits/${resultat.id}?cree=1`);
          return;
        }
        setEtat(resultat);
        if (resultat.statut === "succes") {
          // Saisie enregistrée : la fenêtre ne demande plus « Quitter sans enregistrer ? ».
          enregistre();
          router.refresh();
        }
      } catch {
        // Réseau coupé : jamais un faux succès, la saisie est conservée.
        setEtat({ statut: "erreur", erreur: "generique" });
      } finally {
        if (!redirection) enVol.current = false;
      }
    });
  }

  const erreur = etat?.statut === "erreur" ? etat : null;
  // Un code d'erreur absent des messages retombe sur le message générique.
  const code = (c: string) => (c in (t.raw("erreurs") as object) ? c : "generique");
  // Message d'un champ : seulement si l'erreur lui est rattachée.
  const erreurDe = (champ: ChampProduit): string | null => {
    if (!erreur || erreur.champ !== champ) return null;
    if (erreur.erreur === "slug_pris") return erreur.slugPropose ? t("erreurs.slug_pris_propose", { adresse: erreur.slugPropose }) : t("erreurs.slug_pris");
    return t(`erreurs.${code(erreur.erreur)}`);
  };
  const erreurGlobale = erreur && !erreur.champ ? erreur.erreur : null;
  const nomUnivers = (u: UniversAdmin) => (locale === "en" ? u.nomEn : u.nomFr);
  // TYPE DE FICHIER (maquette D10, décision Q24) : aucun champ à saisir ; les formats sont déduits des fichiers joints (et de la vidéo complète).
  const formats = [...new Set((produit?.fichiers ?? []).map((f) => f.format))].map((f) => tfo(f));
  if (produit?.video) formats.push(t("typeFichier.video"));
  const effacerSucces = () => setEtat((avant) => (avant?.statut === "succes" ? null : avant));

  // Ordre de la maquette (story 9.16 f) : nom, description, prix et type de fichier, univers ; puis les zones de la maquette (fichiers, image, statut) ;
  // puis tous les autres champs. Deux formulaires, une seule saisie (voir FormulaireProduit) : le premier porte l'identifiant soumis par « Enregistrer ».
  return (
    // Le succès ne vaut que pour la saisie envoyée : dès qu'un champ des formulaires du Kit change, il disparaît (pas ceux des zones).
    <div className="flex max-w-2xl flex-col gap-6">
      <form id={idForm} onSubmit={surEnvoi} onChange={effacerSucces} noValidate className="flex flex-col gap-6" {...source}>
        {erreur ? (
          <div ref={refResume} tabIndex={-1} className="outline-none">
            <MessageEtat type="erreur">{erreurGlobale ? t(`erreurs.${code(erreurGlobale)}`) : t("resume")}</MessageEtat>
          </div>
        ) : null}
        {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

        <ChampTexte id={`${base}-titre-fr`} name="titre_fr" libelle={t("titreFr.libelle")} valeur={titreFr} onChange={changerTitreFr} erreur={erreurDe("titre_fr")} />
        <ChampTexte id={`${base}-titre-en`} name="titre_en" libelle={t("titreEn.libelle")} aide={t("titreEn.aide")} valeur={titreEn} onChange={setTitreEn} erreur={erreurDe("titre_en")} />
        <ChampTexte id={`${base}-description-fr`} name="description_fr" libelle={t("descriptionFr.libelle")} aide={t("descriptionFr.aide")} valeur={descriptionFr} onChange={setDescriptionFr} multiligne erreur={erreurDe("description_fr")} />
        <ChampTexte id={`${base}-description-en`} name="description_en" libelle={t("descriptionEn.libelle")} aide={t("descriptionEn.aide")} valeur={descriptionEn} onChange={setDescriptionEn} multiligne erreur={erreurDe("description_en")} />
        <div className="grid gap-6 sm:grid-cols-2">
          <ChampTexte id={`${base}-prix`} name="prix" libelle={t("prix.libelle")} aide={t("prix.aide")} valeur={prix} inputMode="decimal" onChange={setPrix} erreur={erreurDe("prix")} />

          {/* Lecture seule : une valeur affichée, jamais un champ à saisir. */}
          <dl className="flex w-full flex-col gap-2">
            <dt className={classes.etiquette}>{t("typeFichier.libelle")}</dt>
            <dd className="t-body text-text-primary">{formats.length > 0 ? formats.join(", ") : t("typeFichier.aucun")}</dd>
            <dd className="t-small text-text-secondary">{t("typeFichier.aide")}</dd>
          </dl>
        </div>
        {univers.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className={classes.etiquette}>{t("univers.libelle")}</p>
            <MessageEtat type="information">{t("univers.vide")}</MessageEtat>
            <Bouton variante="secondaire" href="/admin/univers">
              {t("univers.lienVide")}
            </Bouton>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <label htmlFor={`${base}-univers`} className={classes.etiquette}>
              {t("univers.libelle")}
            </label>
            <select
              id={`${base}-univers`}
              name="univers"
              value={universId}
              onChange={(e) => setUniversId(e.target.value)}
              aria-invalid={erreurDe("univers") ? true : undefined}
              aria-describedby={erreurDe("univers") ? `${base}-univers-erreur` : undefined}
              className={classes.champ}
            >
              <option value="">{t("univers.aucun")}</option>
              {univers.map((u) => (
                <option key={u.id} value={u.id}>
                  {nomUnivers(u)}
                </option>
              ))}
            </select>
            {erreurDe("univers") ? (
              <p id={`${base}-univers-erreur`} className="t-small text-danger">
                {erreurDe("univers")}
              </p>
            ) : null}
          </div>
        )}

      </form>

      {milieu ?? <ZonesEnTete produit={null} kit />}

      <form onSubmit={surEnvoi} onChange={effacerSucces} noValidate aria-label={t("suite")} className="flex flex-col gap-6" {...source}>
        {/* Pendant l'envoi, la famille ne change pas : le formulaire du Kit n'est jamais retiré en plein enregistrement (pas de double création). */}
        <fieldset disabled={enCours || redirige} className="contents">
          {choixFamille ?? <ChoixFamille base={base} famille="kit" />}
        </fieldset>

        <ChampTexte
          id={`${base}-slug`}
          name="slug"
          libelle={t("slug.libelle")}
          aide={t("slug.aide")}
          valeur={slug}
          onChange={(v) => {
            setSlugModifie(true);
            setSlug(v);
          }}
          erreur={erreurDe("slug")}
          sousLeChamp={
            erreur?.erreur === "slug_pris" && erreur.slugPropose ? (
              <Bouton
                variante="secondaire"
                onClick={() => {
                  setSlugModifie(true);
                  setSlug(erreur.slugPropose ?? "");
                  setEtat(null);
                }}
              >
                {t("slug.utiliser", { adresse: erreur.slugPropose })}
              </Bouton>
            ) : null
          }
        />
        <ChampTexte id={`${base}-materiel-fr`} name="materiel_fr" libelle={t("materielFr.libelle")} aide={t("materielFr.aide")} valeur={materielFr} onChange={setMaterielFr} multiligne erreur={erreurDe("materiel_fr")} />
        <ChampTexte id={`${base}-materiel-en`} name="materiel_en" libelle={t("materielEn.libelle")} aide={t("materielEn.aide")} valeur={materielEn} onChange={setMaterielEn} multiligne erreur={erreurDe("materiel_en")} />

        <fieldset className="flex flex-col gap-2" aria-describedby={`${base}-niveau-aide${erreurDe("niveau") ? ` ${base}-niveau-erreur` : ""}`}>
          <legend className={`${classes.etiquette} mb-2`}>{t("niveau.libelle")}</legend>
          <p id={`${base}-niveau-aide`} className="t-small text-text-secondary">
            {t("niveau.aide")}
          </p>
          {NIVEAUX_KIT.map((valeur) => (
            <label key={valeur} className={classes.option}>
              <input type="radio" name="niveau" value={valeur} checked={niveau === valeur} onChange={() => setNiveau(valeur)} className="peer sr-only" />
              <svg aria-hidden="true" viewBox="0 0 16 16" className="invisible size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:visible">
                <path d="M3 8.5 6.5 12 13 4.5" />
              </svg>
              {t(`niveau.options.${valeur}`)}
            </label>
          ))}
          {erreurDe("niveau") ? (
            <p id={`${base}-niveau-erreur`} className="t-small text-danger">
              {erreurDe("niveau")}
            </p>
          ) : null}
        </fieldset>

        <div className="flex w-full flex-col gap-2">
          <label htmlFor={`${base}-lie`} className={classes.etiquette}>
            {t("lie.libelle")}
          </label>
          <p id={`${base}-lie-aide`} className="t-small text-text-secondary">
            {t("lie.aide")}
          </p>
          <select
            id={`${base}-lie`}
            name="produit_lie"
            value={lieId}
            onChange={(e) => setLieId(e.target.value)}
            aria-invalid={erreurDe("kit_lie") ? true : undefined}
            aria-describedby={`${base}-lie-aide${erreurDe("kit_lie") ? ` ${base}-lie-erreur` : ""}`}
            className={classes.champ}
          >
            <option value="">{t("lie.aucun")}</option>
            {liables.map((c) => (
              <option key={c.id} value={c.id}>
                {t("lie.option", { titre: c.titreFr, famille: tf(c.famille) })}
              </option>
            ))}
          </select>
          {erreurDe("kit_lie") ? (
            <p id={`${base}-lie-erreur`} className="t-small text-danger">
              {erreurDe("kit_lie")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="submit" enCours={enCours || redirige}>
            {enCours || redirige ? t("enCours") : t("enregistrer")}
          </Bouton>
        </div>
      </form>
    </div>
  );
}
