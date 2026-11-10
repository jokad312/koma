"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { prixPourSaisie } from "@/lib/argent";
import { versSaisieBoutique } from "@/lib/dates";
import { proposerSlug } from "@/modules/catalogue/slug";
import { enregistrerEvenementAction, type EtatEvenement } from "@/modules/evenements/actions";
import type { Evenement, EntreeType, ImageEvenement, LieuType } from "@/modules/evenements/types";
import { ChampTexte, CLASSE_CHAMP } from "./ChampTexte";
import { ImagesEvenement } from "./ImagesEvenement";

type Champ = "titre_fr" | "titre_en" | "slug" | "texte" | "lieu" | "date" | "capacite" | "types";

// Code d'erreur serveur → champ concerné (null : message général).
function champDe(erreur: EtatEvenement): Champ | null {
  if (erreur.statut !== "erreur") return null;
  switch (erreur.erreur) {
    case "titre_invalide":
      return "titre_fr";
    case "slug_invalide":
    case "slug_pris":
      return "slug";
    case "texte_invalide":
      return "texte";
    case "lieu_invalide":
      return "lieu";
    case "date_invalide":
      return "date";
    case "capacite_invalide":
      return "capacite";
    case "type_pass_invalide":
    case "prix_invalide":
    case "quota_invalide":
    case "type_pass_introuvable":
      return "types";
    default:
      return null;
  }
}

type LigneType = EntreeType & { cle: string };

function versLigne(t: Evenement["types"][number]): LigneType {
  return {
    cle: t.id,
    id: t.id,
    nomFr: t.nomFr,
    nomEn: t.nomEn ?? "",
    prixUsd: prixPourSaisie(t.prixCents),
    quota: t.quota === null ? "" : String(t.quota),
    inclusFr: t.inclusFr ?? "",
    inclusEn: t.inclusEn ?? "",
    estStand: t.estStand,
  };
}

// Création et modification d'un Événement avec ses Types de pass (FR-52). Rien n'est écrit en dur : tout vient de la saisie.
// Dates et heures saisies et affichées à l'heure de Goma. Le succès n'apparaît qu'après la réponse réelle du serveur ;
// la saisie est conservée après un échec. Les photos s'ajoutent après la création, comme pour les Articles.
export function FormulaireEvenement({ evenement }: { evenement: Evenement | null }) {
  const t = useTranslations("Admin.evenements.formulaire");
  const router = useRouter();
  const base = useId();
  const [titreFr, setTitreFr] = useState(evenement?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(evenement?.titreEn ?? "");
  const [slug, setSlug] = useState(evenement?.slug ?? "");
  const [slugModifie, setSlugModifie] = useState(evenement !== null);
  const [descriptionFr, setDescriptionFr] = useState(evenement?.descriptionFr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(evenement?.descriptionEn ?? "");
  const [lieuType, setLieuType] = useState<LieuType | "">(evenement?.lieuType ?? "");
  const [lieuFr, setLieuFr] = useState(evenement?.lieuFr ?? "");
  const [lieuEn, setLieuEn] = useState(evenement?.lieuEn ?? "");
  const [debut, setDebut] = useState(versSaisieBoutique(evenement?.debutLe));
  const [fin, setFin] = useState(versSaisieBoutique(evenement?.finLe));
  const [venteOuvre, setVenteOuvre] = useState(versSaisieBoutique(evenement?.venteOuvreLe));
  const [venteFerme, setVenteFerme] = useState(versSaisieBoutique(evenement?.venteFermeLe));
  const [capacite, setCapacite] = useState(evenement?.capacite === null || evenement === null ? "" : String(evenement.capacite));
  const [images, setImages] = useState<ImageEvenement[]>(evenement?.images ?? []);
  const [types, setTypes] = useState<LigneType[]>(evenement?.types.map(versLigne) ?? []);
  const compteur = useRef(0);
  // Après chaque enregistrement le serveur relit l'événement : les Types prennent leurs vrais identifiants (jamais recréés à la sauvegarde suivante).
  const [derniereLecture, setDerniereLecture] = useState(evenement?.modifieLe ?? null);
  if ((evenement?.modifieLe ?? null) !== derniereLecture) {
    setDerniereLecture(evenement?.modifieLe ?? null);
    if (evenement) setTypes(evenement.types.map(versLigne));
  }
  const [etat, setEtat] = useState<EtatEvenement | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const refResume = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (etat?.statut === "erreur") refResume.current?.focus();
  }, [etat]);

  function majType(cle: string, partiel: Partial<LigneType>) {
    setTypes((avant) => avant.map((l) => (l.cle === cle ? { ...l, ...partiel } : l)));
  }

  function ajouterType() {
    compteur.current += 1;
    setTypes((avant) => [
      ...avant,
      { cle: `nouveau-${compteur.current}`, id: null, nomFr: "", nomEn: "", prixUsd: "", quota: "", inclusFr: "", inclusEn: "", estStand: false },
    ]);
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    enVol.current = true;
    setEtat(null);
    demarrer(async () => {
      try {
        const vide = (v: string) => (v.trim() === "" ? null : v);
        const resultat = await enregistrerEvenementAction({
          id: evenement?.id ?? null,
          evenement: {
            titreFr,
            titreEn: vide(titreEn),
            slug: vide(slug),
            descriptionFr: vide(descriptionFr),
            descriptionEn: vide(descriptionEn),
            lieuType: lieuType === "" ? null : lieuType,
            lieuFr: vide(lieuFr),
            lieuEn: vide(lieuEn),
            debut: vide(debut),
            fin: vide(fin),
            venteOuvre: vide(venteOuvre),
            venteFerme: vide(venteFerme),
            capacite: vide(capacite),
            images,
            types: types.map((type) => ({ id: type.id, nomFr: type.nomFr, nomEn: vide(type.nomEn ?? ""), prixUsd: type.prixUsd, quota: vide(type.quota ?? ""), inclusFr: vide(type.inclusFr ?? ""), inclusEn: vide(type.inclusEn ?? ""), estStand: type.estStand })),
          },
        });
        if (resultat.statut === "succes" && resultat.cree) {
          router.push(`/admin/evenements/${resultat.id}?cree=1`);
          return;
        }
        setEtat(resultat);
        if (resultat.statut === "succes") router.refresh();
      } catch {
        setEtat({ statut: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  const erreur = etat?.statut === "erreur" ? etat : null;
  const champFautif = etat ? champDe(etat) : null;
  const erreurDe = (champ: Champ) => (erreur && champFautif === champ ? t(`erreurs.${erreur.erreur}`) : null);
  const erreurGenerale = erreur && champFautif === null ? t(`erreurs.${erreur.erreur}`) : null;

  const champDate = (id: string, nom: string, libelle: string, aide: string, valeur: string, onChange: (v: string) => void, erreurChamp: string | null) => (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="t-label text-text-primary">
        {libelle}
      </label>
      <p id={`${id}-aide`} className="t-small text-text-secondary">
        {aide}
      </p>
      <input
        id={id}
        name={nom}
        type="datetime-local"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreurChamp ? true : undefined}
        aria-describedby={`${id}-aide${erreurChamp ? ` ${id}-erreur` : ""}`}
        className={CLASSE_CHAMP}
      />
      {erreurChamp ? (
        <p id={`${id}-erreur`} className="t-small text-danger">
          {erreurChamp}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      onSubmit={surEnvoi}
      onChange={() => setEtat((avant) => (avant?.statut === "succes" ? null : avant))}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      {erreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{erreurGenerale ?? t("resume")}</MessageEtat>
        </div>
      ) : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

      <ChampTexte id={`${base}-titre-fr`} name="titre_fr" libelle={t("titreFr.libelle")} aide={t("titreFr.aide")} valeur={titreFr} onChange={(v) => { setTitreFr(v); if (!slugModifie) setSlug(proposerSlug(v)); }} erreur={erreurDe("titre_fr")} />
      <ChampTexte id={`${base}-titre-en`} name="titre_en" libelle={t("titreEn.libelle")} aide={t("titreEn.aide")} valeur={titreEn} onChange={setTitreEn} erreur={erreurDe("titre_en")} />
      <ChampTexte id={`${base}-slug`} name="slug" libelle={t("slug.libelle")} aide={t("slug.aide")} valeur={slug} onChange={(v) => { setSlugModifie(true); setSlug(v); }} erreur={erreurDe("slug")} />
      <ChampTexte id={`${base}-description-fr`} name="description_fr" libelle={t("descriptionFr.libelle")} aide={t("descriptionFr.aide")} valeur={descriptionFr} onChange={setDescriptionFr} erreur={erreurDe("texte")} multiligne />
      <ChampTexte id={`${base}-description-en`} name="description_en" libelle={t("descriptionEn.libelle")} aide={t("descriptionEn.aide")} valeur={descriptionEn} onChange={setDescriptionEn} multiligne />

      <fieldset className="flex flex-col gap-4 border-t border-border pt-6">
        <legend className="t-h3">{t("lieu.titre")}</legend>
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={`${base}-lieu-type`} className="t-label text-text-primary">
            {t("lieu.typeLibelle")}
          </label>
          <select id={`${base}-lieu-type`} name="lieu_type" value={lieuType} onChange={(e) => setLieuType(e.target.value as LieuType | "")} className={CLASSE_CHAMP}>
            <option value="">{t("lieu.aucun")}</option>
            <option value="salle">{t("lieu.salle")}</option>
            <option value="plein_air">{t("lieu.pleinAir")}</option>
          </select>
        </div>
        <ChampTexte id={`${base}-lieu-fr`} name="lieu_fr" libelle={t("lieu.fr.libelle")} aide={t("lieu.fr.aide")} valeur={lieuFr} onChange={setLieuFr} erreur={erreurDe("lieu")} />
        <ChampTexte id={`${base}-lieu-en`} name="lieu_en" libelle={t("lieu.en.libelle")} valeur={lieuEn} onChange={setLieuEn} />
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-border pt-6">
        <legend className="t-h3">{t("dates.titre")}</legend>
        <p className="t-small text-text-secondary">{t("dates.fuseau")}</p>
        {champDate(`${base}-debut`, "debut", t("dates.debut.libelle"), t("dates.debut.aide"), debut, setDebut, erreurDe("date"))}
        {champDate(`${base}-fin`, "fin", t("dates.fin.libelle"), t("dates.fin.aide"), fin, setFin, null)}
        {champDate(`${base}-vente-ouvre`, "vente_ouvre", t("dates.venteOuvre.libelle"), t("dates.venteOuvre.aide"), venteOuvre, setVenteOuvre, null)}
        {champDate(`${base}-vente-ferme`, "vente_ferme", t("dates.venteFerme.libelle"), t("dates.venteFerme.aide"), venteFerme, setVenteFerme, null)}
        <ChampTexte id={`${base}-capacite`} name="capacite" libelle={t("capacite.libelle")} aide={t("capacite.aide")} valeur={capacite} onChange={setCapacite} erreur={erreurDe("capacite")} inputMode="numeric" />
      </fieldset>

      <section aria-labelledby={`${base}-types-titre`} className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 id={`${base}-types-titre`} className="t-h2">
          {t("types.titre")}
        </h2>
        <p className="t-small text-text-secondary">{t("types.aide")}</p>
        {erreurDe("types") ? <MessageEtat type="erreur">{erreurDe("types")}</MessageEtat> : null}
        {types.length === 0 ? <p className="t-body text-text-secondary">{t("types.vide")}</p> : null}
        <ol className="flex flex-col gap-4">
          {types.map((ligne, i) => (
            <li key={ligne.cle} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
              <fieldset className="flex flex-col gap-4">
                <legend className="t-label">{t("types.numero", { numero: i + 1 })}</legend>
                <ChampTexte id={`${base}-t${ligne.cle}-nom-fr`} name={`type_nom_fr_${i}`} libelle={t("types.nomFr")} valeur={ligne.nomFr} onChange={(v) => majType(ligne.cle, { nomFr: v })} />
                <ChampTexte id={`${base}-t${ligne.cle}-nom-en`} name={`type_nom_en_${i}`} libelle={t("types.nomEn")} valeur={ligne.nomEn ?? ""} onChange={(v) => majType(ligne.cle, { nomEn: v })} />
                <ChampTexte id={`${base}-t${ligne.cle}-prix`} name={`type_prix_${i}`} libelle={t("types.prix")} aide={t("types.prixAide")} valeur={ligne.prixUsd} onChange={(v) => majType(ligne.cle, { prixUsd: v })} inputMode="decimal" />
                <ChampTexte id={`${base}-t${ligne.cle}-quota`} name={`type_quota_${i}`} libelle={ligne.estStand ? t("types.quotaStand") : t("types.quota")} aide={ligne.estStand ? t("types.quotaStandAide") : t("types.quotaAide")} valeur={ligne.quota ?? ""} onChange={(v) => majType(ligne.cle, { quota: v })} inputMode="numeric" />
                <ChampTexte id={`${base}-t${ligne.cle}-inclus-fr`} name={`type_inclus_fr_${i}`} libelle={t("types.inclusFr")} valeur={ligne.inclusFr ?? ""} onChange={(v) => majType(ligne.cle, { inclusFr: v })} multiligne />
                <ChampTexte id={`${base}-t${ligne.cle}-inclus-en`} name={`type_inclus_en_${i}`} libelle={t("types.inclusEn")} valeur={ligne.inclusEn ?? ""} onChange={(v) => majType(ligne.cle, { inclusEn: v })} multiligne />
                <div className="flex items-start gap-3">
                  <input
                    id={`${base}-t${ligne.cle}-stand`}
                    type="checkbox"
                    checked={ligne.estStand}
                    onChange={(e) => majType(ligne.cle, { estStand: e.target.checked })}
                    aria-describedby={`${base}-t${ligne.cle}-stand-aide`}
                    className="mt-1 size-6 shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${base}-t${ligne.cle}-stand`} className="t-label text-text-primary">
                      {t("types.stand")}
                    </label>
                    <p id={`${base}-t${ligne.cle}-stand-aide`} className="t-small text-text-secondary">
                      {t("types.standAide")}
                    </p>
                  </div>
                </div>
              </fieldset>
              <div>
                <button
                  type="button"
                  onClick={() => setTypes((avant) => avant.filter((l) => l.cle !== ligne.cle))}
                  className="inline-flex min-h-touch items-center rounded-full border border-border-field bg-surface px-4 text-danger"
                >
                  {t("types.retirer", { numero: i + 1 })}
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <Bouton type="button" variante="secondaire" onClick={ajouterType}>
            {t("types.ajouter")}
          </Bouton>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <Bouton type="submit" enCours={enCours}>
          {enCours ? t("enCours") : t("enregistrer")}
        </Bouton>
      </div>

      {evenement ? (
        <section aria-labelledby={`${base}-images-titre`} className="flex flex-col gap-4 border-t border-border pt-6">
          <h2 id={`${base}-images-titre`} className="t-h2">
            {t("imagesTitre")}
          </h2>
          <p className="t-small text-text-secondary">{t("imagesAide")}</p>
          <ImagesEvenement images={images} onChange={setImages} desactive={enCours} />
        </section>
      ) : (
        <p className="t-small text-text-secondary">{t("imagesApresCreation")}</p>
      )}
    </form>
  );
}
