"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { prixPourSaisie } from "@/lib/argent";
import { enregistrerProduit, type EtatProduit } from "@/modules/catalogue/actions";
import { proposerSlug } from "@/modules/catalogue/slug";
import { TAILLES } from "@/modules/catalogue/types";
import type { ChampProduit, ProduitAdmin, ProduitLiable, Taille, UniversAdmin } from "@/modules/catalogue/types";
import { ChampTexte, CLASSE_CHAMP } from "./ChampTexte";
import { ChoixFamille } from "./ChoixFamille";
import { EditeurVariantes, VARIANTES_VIDES, type EtatVariante, type EtatVariantes } from "./EditeurVariantes";
import { FormulaireKit } from "./FormulaireKit";

type Props = {
  univers: readonly UniversAdmin[];
  // Cosplays et accessoires qu'un nouveau Kit peut lier (famille « kit », création seulement).
  liables?: readonly ProduitLiable[];
  // Produit à modifier ; absent : création d'un brouillon. La famille d'un produit existant ne change plus.
  produit?: ProduitAdmin | null;
};

function variantesDepuis(produit: ProduitAdmin | null | undefined): EtatVariantes {
  const etat = { ...VARIANTES_VIDES } as EtatVariantes;
  for (const v of produit?.variantes ?? []) {
    etat[v.taille] = {
      actif: true,
      stock: String(v.stock),
      surCommande: v.fabricationSurCommande,
      delai: v.delaiFabricationJours === null ? "" : String(v.delaiFabricationJours),
    };
  }
  return etat;
}

// Création et modification d'un brouillon de produit physique. Le succès n'apparaît qu'après la réponse de l'action serveur,
// la saisie est conservée après un échec (champs contrôlés, jamais remontés), aucun choix ne déclenche d'action.
export function FormulaireProduit({ univers, liables = [], produit = null }: Props) {
  const t = useTranslations("Admin.produits.formulaire");
  const locale = useLocale();
  const router = useRouter();
  const base = useId();

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

  const [etat, setEtat] = useState<EtatProduit | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  // Après une création réussie, le bouton reste occupé jusqu'à la redirection : pas de second envoi.
  const [redirige, setRedirige] = useState(false);
  const refResume = useRef<HTMLDivElement>(null);

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

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
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
          // Seules les tailles cochées partent ; « Sur mesure » n'existe que pour un cosplay.
          variantes: TAILLES.filter((taille) => variantes[taille].actif && (taille !== "sur_mesure" || famille === "cosplay")).map((taille) => ({
            taille,
            stock: variantes[taille].stock,
            surCommande: variantes[taille].surCommande,
            delai: variantes[taille].delai,
          })),
        });
        if (resultat.statut === "succes" && resultat.cree) {
          // Création : redirection vers la fiche d'édition, qui affiche la confirmation. Le bouton reste en cours jusque-là.
          redirection = true;
          setRedirige(true);
          router.push(`/admin/produits/${resultat.id}?cree=1`);
          return;
        }
        setEtat(resultat);
        if (resultat.statut === "succes") router.refresh();
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
  const erreurDeVariantes = erreur?.champ === "variantes" ? { code: erreur.erreur, taille: erreur.taille } : null;
  const erreurGlobale = erreur && !erreur.champ ? erreur.erreur : null;
  const nomUnivers = (u: UniversAdmin) => (locale === "en" ? u.nomEn : u.nomFr);

  // Famille « kit » (création) : le formulaire du Kit prend la suite, le choix de la famille reste en tête.
  if (famille === "kit" && produit === null) {
    return (
      <FormulaireKit
        univers={univers}
        liables={liables}
        choixFamille={<ChoixFamille base={base} famille={famille} onChange={setFamille} />}
      />
    );
  }

  return (
    <form
      onSubmit={surEnvoi}
      // Le succès ne vaut que pour la saisie envoyée : dès qu'un champ change, il disparaît.
      onChange={() => setEtat((avant) => (avant?.statut === "succes" ? null : avant))}
      noValidate className="flex max-w-2xl flex-col gap-6">
      {erreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{erreurGlobale ? t(`erreurs.${erreurGlobale}`) : t("resume")}</MessageEtat>
        </div>
      ) : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

      <ChoixFamille base={base} famille={famille} onChange={produit ? undefined : setFamille} erreur={erreurDe("famille")} />

      <ChampTexte
        id={`${base}-titre-fr`}
        name="titre_fr"
        libelle={t("titreFr.libelle")}
        valeur={titreFr}
        onChange={changerTitreFr}
        erreur={erreurDe("titre_fr")}
      />
      <ChampTexte
        id={`${base}-titre-en`}
        name="titre_en"
        libelle={t("titreEn.libelle")}
        aide={t("titreEn.aide")}
        valeur={titreEn}
        onChange={setTitreEn}
        erreur={erreurDe("titre_en")}
      />
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
        id={`${base}-description-fr`}
        name="description_fr"
        libelle={t("descriptionFr.libelle")}
        aide={t("descriptionFr.aide")}
        valeur={descriptionFr}
        onChange={setDescriptionFr}
        multiligne
        erreur={erreurDe("description_fr")}
      />
      <ChampTexte
        id={`${base}-description-en`}
        name="description_en"
        libelle={t("descriptionEn.libelle")}
        aide={t("descriptionEn.aide")}
        valeur={descriptionEn}
        onChange={setDescriptionEn}
        multiligne
        erreur={erreurDe("description_en")}
      />

      {univers.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="t-label text-text-primary">{t("univers.libelle")}</p>
          <MessageEtat type="information">{t("univers.vide")}</MessageEtat>
          <Bouton variante="secondaire" href="/admin/univers">
            {t("univers.lienVide")}
          </Bouton>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={`${base}-univers`} className="t-label text-text-primary">
            {t("univers.libelle")}
          </label>
          <select
            id={`${base}-univers`}
            name="univers"
            value={universId}
            onChange={(e) => setUniversId(e.target.value)}
            aria-invalid={erreurDe("univers") ? true : undefined}
            aria-describedby={erreurDe("univers") ? `${base}-univers-erreur` : undefined}
            className={CLASSE_CHAMP}
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

      <EditeurVariantes famille={famille} valeur={variantes} onChange={changerVariante} erreur={erreurDeVariantes} />

      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="submit" enCours={enCours || redirige}>
          {enCours || redirige ? t("enCours") : t("enregistrer")}
        </Bouton>
      </div>
    </form>
  );
}
