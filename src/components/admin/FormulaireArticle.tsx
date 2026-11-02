"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { ContenuArticle } from "@/components/blog/ContenuArticle";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { enregistrerArticleAction, type EtatArticle } from "@/modules/blog/actions";
import { proposerSlug } from "@/modules/catalogue/slug";
import type { Article, ArticleImage, ProduitLien } from "@/modules/blog/types";
import { ChampTexte } from "./ChampTexte";
import { ImagesArticle } from "./ImagesArticle";

type Champ = "titre_fr" | "titre_en" | "texte_fr" | "texte_en" | "slug" | "produit";

// Code d'erreur serveur → champ du formulaire concerné (null : message général).
function champDe(erreur: EtatArticle): Champ | null {
  if (erreur.statut !== "erreur") return null;
  if (erreur.erreur === "titre_invalide") return "titre_fr";
  if (erreur.erreur === "texte_invalide") return "texte_fr";
  if (erreur.erreur === "slug_invalide" || erreur.erreur === "slug_pris") return "slug";
  if (erreur.erreur === "produit_inexistant") return "produit";
  return null;
}

// Rédaction d'un article : titre FR obligatoire, texte FR facultatif tant que l'article reste un brouillon, version EN et
// lien Produit facultatifs. L'aperçu emprunte exactement le rendu public (ContenuArticle). Le succès n'apparaît qu'après la
// réponse réelle du serveur ; la saisie est conservée après un échec.
export function FormulaireArticle({ article, produits }: { article: Article | null; produits: readonly ProduitLien[] }) {
  const t = useTranslations("Admin.blog.formulaire");
  const router = useRouter();
  const base = useId();
  const [titreFr, setTitreFr] = useState(article?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(article?.titreEn ?? "");
  const [texteFr, setTexteFr] = useState(article?.texteFr ?? "");
  const [texteEn, setTexteEn] = useState(article?.texteEn ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  // Tant que l'adresse n'a pas été modifiée à la main, elle suit le titre français ; une adresse déjà
  // enregistrée n'est jamais recalculée (elle sert d'adresse publique).
  const [slugModifie, setSlugModifie] = useState(article !== null);
  const [lienProduitId, setLienProduitId] = useState(article?.lienProduitId ?? "");
  const [images, setImages] = useState<ArticleImage[]>(article?.images ?? []);
  const [etat, setEtat] = useState<EtatArticle | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const refResume = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (etat?.statut === "erreur") refResume.current?.focus();
  }, [etat]);

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    enVol.current = true;
    setEtat(null);
    demarrer(async () => {
      try {
        const resultat = await enregistrerArticleAction({
          id: article?.id ?? null,
          article: {
            titreFr,
            texteFr,
            // Une saisie vide vaut « pas de version » : jamais une chaîne vide en base.
            titreEn: titreEn.trim() === "" ? null : titreEn,
            texteEn: texteEn.trim() === "" ? null : texteEn,
            slug: slug.trim() === "" ? null : slug,
            lienProduitId: lienProduitId === "" ? null : lienProduitId,
            images,
          },
        });
        if (resultat.statut === "succes" && resultat.cree) {
          // Création : la fiche d'édition prend la suite (images, publication) et affiche la confirmation.
          router.push(`/admin/blog/${resultat.id}?cree=1`);
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
          <MessageEtat type="erreur">{erreurGenerale ?? t("resume")}</MessageEtat>
        </div>
      ) : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

      <ChampTexte id={`${base}-titre-fr`} name="titre_fr" libelle={t("titreFr.libelle")} aide={t("titreFr.aide")} valeur={titreFr} onChange={(valeur) => { setTitreFr(valeur); if (!slugModifie) setSlug(proposerSlug(valeur)); }} erreur={erreurDe("titre_fr")} />
      <ChampTexte id={`${base}-texte-fr`} name="texte_fr" libelle={t("texteFr.libelle")} aide={t("texteFr.aide")} valeur={texteFr} onChange={setTexteFr} erreur={erreurDe("texte_fr")} multiligne />
      <ChampTexte id={`${base}-titre-en`} name="titre_en" libelle={t("titreEn.libelle")} aide={t("titreEn.aide")} valeur={titreEn} onChange={setTitreEn} erreur={erreurDe("titre_en")} />
      <ChampTexte id={`${base}-texte-en`} name="texte_en" libelle={t("texteEn.libelle")} aide={t("texteEn.aide")} valeur={texteEn} onChange={setTexteEn} erreur={erreurDe("texte_en")} multiligne />
      <ChampTexte id={`${base}-slug`} name="slug" libelle={t("slug.libelle")} aide={t("slug.aide")} valeur={slug} onChange={(valeur) => { setSlugModifie(true); setSlug(valeur); }} erreur={erreurDe("slug")} />

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${base}-produit`} className="t-label text-text-primary">
          {t("lienProduit.libelle")}
        </label>
        <p id={`${base}-produit-aide`} className="t-small text-text-secondary">
          {t("lienProduit.aide")}
        </p>
        <select
          id={`${base}-produit`}
          name="lien_produit_id"
          value={lienProduitId}
          onChange={(e) => setLienProduitId(e.target.value)}
          aria-invalid={erreurDe("produit") ? true : undefined}
          aria-describedby={`${base}-produit-aide${erreurDe("produit") ? ` ${base}-produit-erreur` : ""}`}
          className="t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary"
        >
          <option value="">{t("lienProduit.aucun")}</option>
          {produits.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titreFr}
            </option>
          ))}
        </select>
        {erreurDe("produit") ? (
          <p id={`${base}-produit-erreur`} className="t-small text-danger">
            {erreurDe("produit")}
          </p>
        ) : null}
      </div>

      <p className="t-small text-text-secondary">{t("markdown")}</p>

      <div className="flex flex-col gap-3">
        <Bouton type="submit" enCours={enCours}>
          {enCours ? t("enCours") : t("enregistrer")}
        </Bouton>
      </div>

      {article ? (
        <section aria-labelledby={`${base}-images-titre`} className="flex flex-col gap-4 border-t border-border pt-6">
          <h2 id={`${base}-images-titre`} className="t-h2">
            {t("imagesTitre")}
          </h2>
          <p className="t-small text-text-secondary">{t("imagesAide")}</p>
          <ImagesArticle images={images} onChange={setImages} desactive={enCours} />
        </section>
      ) : (
        <p className="t-small text-text-secondary">{t("imagesApresCreation")}</p>
      )}

      <section aria-labelledby={`${base}-apercu-titre`} className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 id={`${base}-apercu-titre`} className="t-h2">
          {t("apercu.titre")}
        </h2>
        <p className="t-small text-text-secondary">{t("apercu.aide")}</p>
        <div data-apercu="" className="rounded-lg border border-border bg-surface p-5">
          {texteFr.trim() === "" ? <p className="t-body text-text-secondary">{t("apercu.vide")}</p> : <ContenuArticle texte={texteFr} />}
        </div>
      </section>
    </form>
  );
}
