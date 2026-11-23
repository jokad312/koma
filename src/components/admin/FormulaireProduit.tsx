"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { prixPourSaisie } from "@/lib/argent";
import { enregistrerProduit, type EtatProduit } from "@/modules/catalogue/actions";
import { proposerSlug } from "@/modules/catalogue/slug";
import { TAILLES, taillesDeLaFamille } from "@/modules/catalogue/types";
import type { ChampProduit, CouleurVariante, EntreeVariante, ProduitAdmin, ProduitLiable, Taille, UniversAdmin } from "@/modules/catalogue/types";
import { ChampTexte, useClassesChamp } from "./ChampTexte";
import { ChoixFamille } from "./ChoixFamille";
import { EditeurCouleurs, erreursDesCouleurs, type ErreurCouleurLocale, type EtatCouleur } from "./EditeurCouleurs";
import { EditeurVariantes, VARIANTES_VIDES, type EtatVariante, type EtatVariantes } from "./EditeurVariantes";
import { FormulaireKit, type ValeursCommunes } from "./FormulaireKit";
import { useEnregistrementFenetre } from "./ui/FenetreFormulaire";
import { ZonesEnTete } from "./ZonesEnTete";

type Props = {
  univers: readonly UniversAdmin[];
  // Cosplays et accessoires qu'un nouveau Kit peut lier (famille « kit », création seulement).
  liables?: readonly ProduitLiable[];
  // Produit à modifier ; absent : création d'un brouillon. La famille d'un produit existant ne change plus.
  produit?: ProduitAdmin | null;
  // Couleurs déjà utilisées (autocomplétion des couleurs d'un Vêtement).
  couleursUtilisees?: readonly CouleurVariante[];
  // Story 9.16 f : identifiant du formulaire principal (soumis par « Enregistrer » de la fenêtre) et zones de la maquette placées entre les champs du
  // haut et le reste (image, statut). Absentes à la création : zones « après le premier enregistrement ».
  idFormulaire?: string;
  milieu?: ReactNode;
};

function etatDepuis(v: ProduitAdmin["variantes"][number]): EtatVariante {
  return { id: v.id, actif: true, stock: String(v.stock), surCommande: v.fabricationSurCommande, delai: v.delaiFabricationJours === null ? "" : String(v.delaiFabricationJours) };
}

// Variantes sans couleur (cosplay, accessoire, autre article, vêtement sans couleur).
function variantesDepuis(produit: ProduitAdmin | null | undefined): EtatVariantes {
  const etat = { ...VARIANTES_VIDES } as EtatVariantes;
  for (const v of produit?.variantes ?? []) if (!v.couleur) etat[v.taille] = etatDepuis(v);
  return etat;
}

// Couleurs d'un Vêtement, dans l'ordre de leur nom français, chacune avec ses tailles.
function couleursDepuis(produit: ProduitAdmin | null | undefined): EtatCouleur[] {
  const parNom = new Map<string, EtatCouleur>();
  for (const v of produit?.variantes ?? []) {
    if (!v.couleur) continue;
    const cle = v.couleur.fr.toLowerCase();
    const c = parNom.get(cle) ?? { cle: `c${parNom.size}`, fr: v.couleur.fr, en: v.couleur.en ?? "", hex: v.couleur.hex ?? "", variantes: { ...VARIANTES_VIDES } };
    c.variantes = { ...c.variantes, [v.taille]: etatDepuis(v) };
    parNom.set(cle, c);
  }
  return [...parNom.values()].sort((a, b) => a.fr.localeCompare(b.fr));
}

// Ce qui part au serveur pour un groupe de tailles : seules les tailles cochées et proposées par la famille (« Taille unique » toujours).
function entreesDepuis(famille: string, etat: EtatVariantes, couleur: EtatCouleur | null): EntreeVariante[] {
  return TAILLES.filter((taille) => taillesDeLaFamille(famille).includes(taille) && (taille === "unique" || etat[taille].actif)).map((taille) => ({
    // Variante déjà enregistrée : son identifiant, pour une mise à jour sur place (renommer une couleur garde commandes et paniers).
    ...(etat[taille].id ? { id: etat[taille].id } : {}),
    taille,
    stock: etat[taille].stock,
    surCommande: etat[taille].surCommande,
    delai: etat[taille].delai,
    ...(couleur ? { couleurFr: couleur.fr, couleurEn: couleur.en, couleurHex: couleur.hex } : {}),
  }));
}

// Création et modification d'un brouillon de produit physique. Le succès n'apparaît qu'après la réponse de l'action serveur,
// la saisie est conservée après un échec (champs contrôlés, jamais remontés), aucun choix ne déclenche d'action.
export function FormulaireProduit({ univers, liables = [], produit = null, couleursUtilisees = [], idFormulaire, milieu }: Props) {
  const t = useTranslations("Admin.produits.formulaire");
  const locale = useLocale();
  const router = useRouter();
  const base = useId();
  const classes = useClassesChamp();
  const idForm = idFormulaire ?? `${base}-formulaire`;

  const [famille, setFamille] = useState<string>(produit?.famille ?? "");
  const [titreFr, setTitreFr] = useState(produit?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(produit?.titreEn ?? "");
  const [slug, setSlug] = useState(produit?.slug ?? "");
  // Tant que l'adresse n'a pas été modifiée à la main, elle suit le titre français ; une adresse déjà enregistrée n'est jamais recalculée.
  const [slugModifie, setSlugModifie] = useState(produit !== null);
  const [descriptionFr, setDescriptionFr] = useState(produit?.descriptionFr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(produit?.descriptionEn ?? "");
  const [universId, setUniversId] = useState(produit?.universId ?? "");
  const [prix, setPrix] = useState(prixPourSaisie(produit?.prixCents ?? null));
  const [delai, setDelai] = useState(produit?.delaiFabricationJours != null ? String(produit.delaiFabricationJours) : "");
  const [variantes, setVariantes] = useState<EtatVariantes>(() => variantesDepuis(produit));
  const [couleurs, setCouleurs] = useState<EtatCouleur[]>(() => couleursDepuis(produit));
  // Numéro de la prochaine couleur ajoutée (clé locale, jamais envoyée au serveur).
  const [prochaine, setProchaine] = useState(0);
  // Erreurs relevées avant l'envoi, par couleur (clé locale).
  const [erreursCouleurs, setErreursCouleurs] = useState<Record<string, ErreurCouleurLocale>>({});
  // Vêtement avec au moins une couleur : la grille tailles × couleurs remplace les tailles sans couleur.
  const avecCouleurs = famille === "vetement" && couleurs.length > 0;

  const [etat, setEtat] = useState<EtatProduit | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  // Après une création réussie, le bouton reste occupé jusqu'à la redirection : pas de second envoi.
  const [redirige, setRedirige] = useState(false);
  const refResume = useRef<HTMLDivElement>(null);
  const { enregistre, source } = useEnregistrementFenetre(enCours || redirige);
  // Saisie commune rendue par le formulaire du Kit (création), pour le retour vers une autre famille.
  const changerCommun = useCallback((v: Partial<ValeursCommunes>) => {
    if (v.titreFr !== undefined) setTitreFr(v.titreFr);
    if (v.titreEn !== undefined) setTitreEn(v.titreEn);
    if (v.slug !== undefined) setSlug(v.slug);
    if (v.slugModifie !== undefined) setSlugModifie(v.slugModifie);
    if (v.descriptionFr !== undefined) setDescriptionFr(v.descriptionFr);
    if (v.descriptionEn !== undefined) setDescriptionEn(v.descriptionEn);
    if (v.universId !== undefined) setUniversId(v.universId);
    if (v.prix !== undefined) setPrix(v.prix);
  }, []);

  // Après un échec, le focus va au résumé d'erreur (annoncé en alerte).
  useEffect(() => {
    if (etat?.statut === "erreur") refResume.current?.focus();
  }, [etat]);

  function changerTitreFr(valeur: string) {
    setTitreFr(valeur);
    if (!slugModifie) setSlug(proposerSlug(valeur));
  }

  function changerVariante(taille: Taille, partiel: Partial<EtatVariante>) {
    setVariantes((avant) => ({ ...avant, [taille]: { ...avant[taille], ...partiel } }));
  }

  function ajouterCouleur() {
    setCouleurs((avant) => [...avant, { cle: `n${prochaine}`, fr: "", en: "", hex: "", variantes: { ...VARIANTES_VIDES } }]);
    setProchaine((n) => n + 1);
  }

  function changerCouleur(cle: string, partiel: Partial<Pick<EtatCouleur, "fr" | "en" | "hex">>) {
    setCouleurs((avant) => avant.map((c) => (c.cle === cle ? { ...c, ...partiel } : c)));
  }

  function changerVarianteCouleur(cle: string, taille: Taille, partiel: Partial<EtatVariante>) {
    setCouleurs((avant) => avant.map((c) => (c.cle === cle ? { ...c, variantes: { ...c.variantes, [taille]: { ...c.variantes[taille], ...partiel } } } : c)));
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    // Vêtement : une couleur sans nom français ou sans aucune taille cochée n'est jamais jetée en silence ; l'envoi est refusé et
    // l'erreur s'affiche sur la couleur concernée.
    const locales = avecCouleurs ? erreursDesCouleurs(couleurs) : {};
    setErreursCouleurs(locales);
    if (Object.keys(locales).length > 0) {
      setEtat({ statut: "erreur", erreur: "couleur_invalide" });
      return;
    }
    enVol.current = true;
    setEtat(null);
    demarrer(async () => {
      let redirection = false;
      try {
        const resultat = await enregistrerProduit({
          id: produit?.id ?? "",
          famille,
          slug,
          titreFr,
          titreEn,
          descriptionFr,
          descriptionEn,
          universId,
          prix,
          delai,
          // Seules les tailles cochées et proposées par la famille partent (« Sur mesure » : cosplay ; « Taille unique » : autre article).
          // Vêtement en couleurs : chaque couleur envoie ses tailles avec son nom et sa pastille.
          variantes: avecCouleurs ? couleurs.flatMap((c) => entreesDepuis(famille, c.variantes, c)) : entreesDepuis(famille, variantes, null),
        });
        if (resultat.statut === "succes" && resultat.cree) {
          // Création : redirection vers la fiche d'édition, qui affiche la confirmation. Le bouton reste en cours jusque-là.
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
  // Message d'un champ : seulement si l'erreur lui est rattachée.
  const erreurDe = (champ: ChampProduit): string | null => {
    if (!erreur || erreur.champ !== champ) return null;
    if (erreur.erreur === "slug_pris") return erreur.slugPropose ? t("erreurs.slug_pris_propose", { adresse: erreur.slugPropose }) : t("erreurs.slug_pris");
    return t(`erreurs.${erreur.erreur}`);
  };
  const erreurDeVariantes = erreur?.champ === "variantes" ? { code: erreur.erreur, taille: erreur.taille, couleur: erreur.couleur } : null;
  const erreurGlobale = erreur && !erreur.champ ? erreur.erreur : null;
  const nomUnivers = (u: UniversAdmin) => (locale === "en" ? u.nomEn : u.nomFr);

  // Famille « kit » (création) : le formulaire du Kit prend la suite, avec le choix de la famille et la saisie commune déjà faite (titres, descriptions,
  // adresse, univers, prix), reprise à l'aller et rendue au retour vers une autre famille. Ce qui est propre au Kit (matériel, niveau, Kit lié) est
  // perdu si l'on quitte la famille Kit avant d'enregistrer.
  if (famille === "kit" && produit === null) {
    return (
      <FormulaireKit
        univers={univers}
        liables={liables}
        idFormulaire={idForm}
        initial={{ titreFr, titreEn, slug, slugModifie, descriptionFr, descriptionEn, universId, prix }}
        onCommun={changerCommun}
        choixFamille={<ChoixFamille base={base} famille={famille} onChange={setFamille} />}
      />
    );
  }

  const effacerSucces = () => setEtat((avant) => (avant?.statut === "succes" ? null : avant));

  // Ordre de la maquette (story 9.16 f) : nom, description, prix, univers ; puis les zones de la maquette (image, statut) ; puis tous les autres champs.
  // Deux formulaires, une seule saisie : le premier porte l'identifiant soumis par « Enregistrer » de la fenêtre ; le second (après les zones, qui ont
  // leurs propres formulaires et ne peuvent pas y être imbriquées) se soumet aussi par la touche Entrée ou son bouton. Les deux envoient toute la saisie.
  return (
    // Le succès ne vaut que pour la saisie envoyée : dès qu'un champ des formulaires du produit change, il disparaît (pas ceux des zones).
    <div className="flex max-w-2xl flex-col gap-6">
      <form id={idForm} onSubmit={surEnvoi} onChange={effacerSucces} noValidate className="flex flex-col gap-6" {...source}>
        {erreur ? (
          <div ref={refResume} tabIndex={-1} className="outline-none">
            <MessageEtat type="erreur">{erreurGlobale ? t(`erreurs.${erreurGlobale}`) : t("resume")}</MessageEtat>
          </div>
        ) : null}
        {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

        <ChampTexte
          id={`${base}-titre-fr`}
          name="titre_fr"
          libelle={t("titreFr.libelle")}
          valeur={titreFr}
          onChange={changerTitreFr}
          erreur={erreurDe("titre_fr") ?? erreurDe("titre_en")}
        />
        {/* Champs anglais retirés (site en français uniquement, 2026-11-22) : la valeur anglaise déjà enregistrée repart telle quelle. */}
        <ChampTexte
          id={`${base}-description-fr`}
          name="description_fr"
          libelle={t("descriptionFr.libelle")}
          aide={t("descriptionFr.aide")}
          valeur={descriptionFr}
          onChange={setDescriptionFr}
          multiligne
          erreur={erreurDe("description_fr") ?? erreurDe("description_en")}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <ChampTexte
            id={`${base}-prix`}
            name="prix"
            libelle={t("prix.libelle")}
            aide={t("prix.aide")}
            valeur={prix}
            inputMode="decimal"
            onChange={setPrix}
            erreur={erreurDe("prix")}
          />
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

      {milieu ?? <ZonesEnTete produit={null} kit={false} />}

      <form onSubmit={surEnvoi} onChange={effacerSucces} noValidate aria-label={t("suite")} className="flex flex-col gap-6" {...source}>
        <ChoixFamille base={base} famille={famille} onChange={produit ? undefined : setFamille} erreur={erreurDe("famille")} desactive={enCours || redirige} />
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
        <ChampTexte
          id={`${base}-delai`}
          name="delai"
          libelle={t("delai.libelle")}
          aide={t("delai.aide")}
          valeur={delai}
          inputMode="numeric"
          onChange={setDelai}
          erreur={erreurDe("delai")}
        />

        {famille === "vetement" ? (
          <EditeurCouleurs
            couleurs={couleurs}
            suggestions={couleursUtilisees}
            onAjouter={ajouterCouleur}
            onRetirer={(cle) => setCouleurs((avant) => avant.filter((c) => c.cle !== cle))}
            onChangerCouleur={changerCouleur}
            onChangerVariante={changerVarianteCouleur}
            erreur={erreurDeVariantes}
            erreursLocales={erreursCouleurs}
          />
        ) : null}
        {avecCouleurs ? null : (
          <EditeurVariantes famille={famille} valeur={variantes} onChange={changerVariante} erreur={erreurDeVariantes && !erreurDeVariantes.couleur ? erreurDeVariantes : null} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="submit" enCours={enCours || redirige}>
            {enCours || redirige ? t("enCours") : t("enregistrer")}
          </Bouton>
        </div>
      </form>
    </div>
  );
}
