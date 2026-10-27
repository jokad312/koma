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
import { ChampTexte, CLASSE_CHAMP } from "./ChampTexte";
import { ChoixFamille, OPTION_RADIO } from "./ChoixFamille";

type Props = {
  univers: readonly UniversAdmin[];
  // Cosplays et accessoires sans Kit, plus celui du Kit édité.
  liables: readonly ProduitLiable[];
  // Kit à modifier ; absent : création d'un brouillon.
  produit?: ProduitAdmin | null;
  // Choix de la famille affiché en tête (création) ; absent : la famille du Kit existant s'affiche sans choix.
  choixFamille?: ReactNode;
};

// Création et modification d'un brouillon de Kit. Le succès n'apparaît qu'après la réponse de l'action serveur, la saisie est conservée
// après un échec (champs contrôlés), aucun choix ne déclenche d'action. Pas de tailles, de délai ni de stock : un Kit est numérique.
export function FormulaireKit({ univers, liables, produit = null, choixFamille }: Props) {
  const t = useTranslations("Admin.kits.formulaire");
  const tf = useTranslations("Admin.produits.famille");
  const locale = useLocale();
  const router = useRouter();
  const base = useId();

  const [titreFr, setTitreFr] = useState(produit?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(produit?.titreEn ?? "");
  const [slug, setSlug] = useState(produit?.slug ?? "");
  // Tant que l'adresse n'a pas été modifiée à la main, elle suit le titre français ; une adresse déjà enregistrée n'est jamais recalculée.
  const [slugModifie, setSlugModifie] = useState(produit !== null);
  const [descriptionFr, setDescriptionFr] = useState(produit?.descriptionFr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(produit?.descriptionEn ?? "");
  const [materielFr, setMaterielFr] = useState(produit?.materielFr ?? "");
  const [materielEn, setMaterielEn] = useState(produit?.materielEn ?? "");
  const [universId, setUniversId] = useState(produit?.universId ?? "");
  const [prix, setPrix] = useState(prixPourSaisie(produit?.prixCents ?? null));
  const [niveau, setNiveau] = useState<string>(produit?.niveau ?? "");
  const [lieId, setLieId] = useState(produit?.produitLieId ?? "");

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

  return (
    <form
      onSubmit={surEnvoi}
      // Le succès ne vaut que pour la saisie envoyée : dès qu'un champ change, il disparaît.
      onChange={() => setEtat((avant) => (avant?.statut === "succes" ? null : avant))}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      {erreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{erreurGlobale ? t(`erreurs.${code(erreurGlobale)}`) : t("resume")}</MessageEtat>
        </div>
      ) : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

      {choixFamille ?? <ChoixFamille base={base} famille="kit" />}

      <ChampTexte id={`${base}-titre-fr`} name="titre_fr" libelle={t("titreFr.libelle")} valeur={titreFr} onChange={changerTitreFr} erreur={erreurDe("titre_fr")} />
      <ChampTexte id={`${base}-titre-en`} name="titre_en" libelle={t("titreEn.libelle")} aide={t("titreEn.aide")} valeur={titreEn} onChange={setTitreEn} erreur={erreurDe("titre_en")} />
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
      <ChampTexte id={`${base}-description-fr`} name="description_fr" libelle={t("descriptionFr.libelle")} aide={t("descriptionFr.aide")} valeur={descriptionFr} onChange={setDescriptionFr} multiligne erreur={erreurDe("description_fr")} />
      <ChampTexte id={`${base}-description-en`} name="description_en" libelle={t("descriptionEn.libelle")} aide={t("descriptionEn.aide")} valeur={descriptionEn} onChange={setDescriptionEn} multiligne erreur={erreurDe("description_en")} />
      <ChampTexte id={`${base}-materiel-fr`} name="materiel_fr" libelle={t("materielFr.libelle")} aide={t("materielFr.aide")} valeur={materielFr} onChange={setMaterielFr} multiligne erreur={erreurDe("materiel_fr")} />
      <ChampTexte id={`${base}-materiel-en`} name="materiel_en" libelle={t("materielEn.libelle")} aide={t("materielEn.aide")} valeur={materielEn} onChange={setMaterielEn} multiligne erreur={erreurDe("materiel_en")} />

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

      <ChampTexte id={`${base}-prix`} name="prix" libelle={t("prix.libelle")} aide={t("prix.aide")} valeur={prix} inputMode="decimal" onChange={setPrix} erreur={erreurDe("prix")} />

      <fieldset className="flex flex-col gap-2" aria-describedby={`${base}-niveau-aide${erreurDe("niveau") ? ` ${base}-niveau-erreur` : ""}`}>
        <legend className="t-label mb-2 text-text-primary">{t("niveau.libelle")}</legend>
        <p id={`${base}-niveau-aide`} className="t-small text-text-secondary">
          {t("niveau.aide")}
        </p>
        {NIVEAUX_KIT.map((valeur) => (
          <label key={valeur} className={OPTION_RADIO}>
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
        <label htmlFor={`${base}-lie`} className="t-label text-text-primary">
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
          className={CLASSE_CHAMP}
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
  );
}
