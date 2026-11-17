"use client";

import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { ContenuArticle } from "@/components/blog/ContenuArticle";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { enregistrerArticleAction, type EtatArticle } from "@/modules/blog/actions";
import { proposerSlug } from "@/modules/catalogue/slug";
import { EXTRAIT_ARTICLE_MAX, IMAGE_ARTICLE_TAILLE_MAX, type Article, type ArticleImage, type ProduitLien } from "@/modules/blog/types";
import { ChampTexte, useClassesChamp } from "./ChampTexte";
import { ImagesArticle } from "./ImagesArticle";
import { PublicationArticle, StatutCreationArticle } from "./PublicationArticle";
import { useEnregistrementFenetre } from "./ui/FenetreFormulaire";

type Champ = "titre_fr" | "titre_en" | "texte_fr" | "texte_en" | "extrait_fr" | "extrait_en" | "slug" | "produit";

// Longueur réelle (un emoji compte pour un caractère), comme en base (char_length) et dans le schéma du serveur.
const longueur = (texte: string) => Array.from(texte.trim()).length;

// Code d'erreur serveur → champs du formulaire concernés (vide : message général). L'extrait trop long est rattaché au(x) champ(s) qui
// dépassaient AU MOMENT de l'envoi (les deux si besoin, le français si aucun ne dépasse ici) : le serveur reste seul juge, le navigateur ne fait
// qu'aider à placer le message, et la saisie faite après la réponse ne le déplace pas.
function champsDe(erreur: EtatArticle, extraitFr: string, extraitEn: string): Champ[] {
  if (erreur.statut !== "erreur") return [];
  if (erreur.erreur === "titre_invalide") return ["titre_fr"];
  if (erreur.erreur === "texte_invalide") return ["texte_fr"];
  if (erreur.erreur === "extrait_invalide") {
    const fautifs: Champ[] = [];
    if (longueur(extraitFr) > EXTRAIT_ARTICLE_MAX) fautifs.push("extrait_fr");
    if (longueur(extraitEn) > EXTRAIT_ARTICLE_MAX) fautifs.push("extrait_en");
    return fautifs.length > 0 ? fautifs : ["extrait_fr"];
  }
  if (erreur.erreur === "slug_invalide" || erreur.erreur === "slug_pris" || erreur.erreur === "slug_publie") return ["slug"];
  if (erreur.erreur === "produit_inexistant") return ["produit"];
  return [];
}

// Statut de l'article affiché dans la fenêtre (fiche) ; null à la création. peutPublier : rôle relu côté serveur (Admin), comme à la page 5.
export type StatutArticleFenetre = { publie: boolean; archive: boolean; titre: string; peutPublier: boolean };

// Rédaction d'un article : titre FR obligatoire, texte FR facultatif tant que l'article reste un brouillon, extrait, version EN et
// lien Produit facultatifs. L'aperçu emprunte exactement le rendu public (ContenuArticle). Le succès n'apparaît qu'après la
// réponse réelle du serveur ; la saisie est conservée après un échec.
// Story 9.16 h) (maquette 06, DA1 à DA7) : ordre de la maquette — TITRE (FR, EN), EXTRAIT (FR, EN, facultatif, compteur), CONTENU (FR, EN),
// image (zone d'ajout avec vignette), STATUT (menu) — puis l'adresse, le lien Produit, la liste des images et l'aperçu. Un seul <form> :
// la zone d'image n'a pas de formulaire propre et le menu STATUT n'a que des boutons « button ». « Enregistrer » de la fenêtre soumet ce
// formulaire par son identifiant (idFormulaire).
export function FormulaireArticle({
  article,
  produits,
  idFormulaire,
  statut = null,
}: {
  article: Article | null;
  produits: readonly ProduitLien[];
  idFormulaire?: string;
  statut?: StatutArticleFenetre | null;
}) {
  const t = useTranslations("Admin.blog.formulaire");
  const tz = useTranslations("Admin.blog.zones");
  const classes = useClassesChamp();
  const router = useRouter();
  const base = useId();
  const idForm = idFormulaire ?? `${base}-formulaire`;
  const [titreFr, setTitreFr] = useState(article?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(article?.titreEn ?? "");
  const [extraitFr, setExtraitFr] = useState(article?.extraitFr ?? "");
  const [extraitEn, setExtraitEn] = useState(article?.extraitEn ?? "");
  const [texteFr, setTexteFr] = useState(article?.texteFr ?? "");
  const [texteEn, setTexteEn] = useState(article?.texteEn ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  // Tant que l'adresse n'a pas été modifiée à la main, elle suit le titre français ; une adresse déjà
  // enregistrée n'est jamais recalculée (elle sert d'adresse publique).
  const [slugModifie, setSlugModifie] = useState(article !== null);
  const [lienProduitId, setLienProduitId] = useState(article?.lienProduitId ?? "");
  const [images, setImages] = useState<ArticleImage[]>(article?.images ?? []);
  const [etat, setEtat] = useState<EtatArticle | null>(null);
  // Champs fautifs figés à la réponse du serveur.
  const [fautifs, setFautifs] = useState<Champ[]>([]);
  // Envoi d'image en cours (zone d'ajout) : Enregistrer, Retirer et la sortie de la fenêtre sont bloqués.
  const [envoiImage, setEnvoiImage] = useState(false);
  const [enCours, demarrer] = useTransition();
  // Après une création réussie, le bouton reste occupé jusqu'à la redirection : pas de second envoi.
  const [redirige, setRedirige] = useState(false);
  const enVol = useRef(false);
  const refResume = useRef<HTMLDivElement>(null);
  const { enregistre, modifie, source } = useEnregistrementFenetre(enCours || redirige || envoiImage);
  // Ajout ou retrait d'image : la liste change sans événement de champ ; la fenêtre la compte comme une saisie à protéger.
  const changerImages = useCallback(
    (liste: ArticleImage[]) => {
      setImages(liste);
      modifie();
    },
    [modifie],
  );

  useEffect(() => {
    if (etat?.statut === "erreur") refResume.current?.focus();
  }, [etat]);

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current || envoiImage || redirige) return;
    enVol.current = true;
    setEtat(null);
    setFautifs([]);
    const envoyes = { extraitFr, extraitEn };
    demarrer(async () => {
      let redirection = false;
      try {
        const resultat = await enregistrerArticleAction({
          id: article?.id ?? null,
          article: {
            titreFr,
            texteFr,
            // Une saisie vide vaut « pas de version » : jamais une chaîne vide en base.
            titreEn: titreEn.trim() === "" ? null : titreEn,
            texteEn: texteEn.trim() === "" ? null : texteEn,
            // Story 9.16 h) : extrait facultatif ; sa longueur est vérifiée par le serveur, jamais seulement ici.
            extraitFr: extraitFr.trim() === "" ? null : extraitFr,
            extraitEn: extraitEn.trim() === "" ? null : extraitEn,
            slug: slug.trim() === "" ? null : slug,
            lienProduitId: lienProduitId === "" ? null : lienProduitId,
            images,
          },
        });
        if (resultat.statut === "succes" && resultat.cree) {
          // Création : la fiche d'édition prend la suite (images, publication) et affiche la confirmation.
          redirection = true;
          setRedirige(true);
          router.push(`/admin/blog/${resultat.id}?cree=1`);
          return;
        }
        setEtat(resultat);
        setFautifs(champsDe(resultat, envoyes.extraitFr, envoyes.extraitEn));
        if (resultat.statut === "succes") {
          // Saisie enregistrée : la fenêtre ne demande plus « Quitter sans enregistrer ? ».
          enregistre();
          router.refresh();
        }
      } catch {
        setEtat({ statut: "erreur", erreur: "generique" });
      } finally {
        if (!redirection) enVol.current = false;
      }
    });
  }

  const erreur = etat?.statut === "erreur" ? etat : null;
  const message = (code: string) => t(`erreurs.${code}`, { max: EXTRAIT_ARTICLE_MAX });
  const erreurDe = (champ: Champ) => (erreur && fautifs.includes(champ) ? message(erreur.erreur) : null);
  const erreurGenerale = erreur && fautifs.length === 0 ? message(erreur.erreur) : null;

  // Compteur de l'extrait, sous le champ (texte, jamais la couleur seule) ; au-delà de la limite, il le dit.
  const compteur = (id: string, valeur: string) => {
    const n = longueur(valeur);
    return (
      <p id={`${id}-compteur`} className={`t-small ${n > EXTRAIT_ARTICLE_MAX ? "text-danger" : "text-text-secondary"}`}>
        {n > EXTRAIT_ARTICLE_MAX ? t("extrait.trop", { nombre: n, max: EXTRAIT_ARTICLE_MAX }) : t("extrait.compteur", { nombre: n, max: EXTRAIT_ARTICLE_MAX })}
      </p>
    );
  };

  return (
    <form
      id={idForm}
      onSubmit={surEnvoi}
      // Le succès ne vaut que pour la saisie envoyée : dès qu'un champ change, il disparaît.
      onChange={() => setEtat((avant) => (avant?.statut === "succes" ? null : avant))}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      {...source}
    >
      {erreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{erreurGenerale ?? t("resume")}</MessageEtat>
        </div>
      ) : null}
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}

      {/* TITRE (DA2) */}
      <ChampTexte id={`${base}-titre-fr`} name="titre_fr" libelle={t("titreFr.libelle")} aide={t("titreFr.aide")} valeur={titreFr} onChange={(valeur) => { setTitreFr(valeur); if (!slugModifie) setSlug(proposerSlug(valeur)); }} erreur={erreurDe("titre_fr")} />
      <ChampTexte id={`${base}-titre-en`} name="titre_en" libelle={t("titreEn.libelle")} aide={t("titreEn.aide")} valeur={titreEn} onChange={setTitreEn} erreur={erreurDe("titre_en")} />

      {/* EXTRAIT (RÉSUMÉ COURT) (DA3, Q28) : facultatif, 300 caractères au plus, compteur. */}
      <ChampTexte
        id={`${base}-extrait-fr`}
        name="extrait_fr"
        libelle={t("extraitFr.libelle")}
        aide={t("extraitFr.aide", { max: EXTRAIT_ARTICLE_MAX })}
        valeur={extraitFr}
        onChange={setExtraitFr}
        erreur={erreurDe("extrait_fr")}
        multiligne
        sousLeChamp={compteur(`${base}-extrait-fr`, extraitFr)}
      />
      <ChampTexte
        id={`${base}-extrait-en`}
        name="extrait_en"
        libelle={t("extraitEn.libelle")}
        aide={t("extraitEn.aide", { max: EXTRAIT_ARTICLE_MAX })}
        valeur={extraitEn}
        onChange={setExtraitEn}
        erreur={erreurDe("extrait_en")}
        multiligne
        sousLeChamp={compteur(`${base}-extrait-en`, extraitEn)}
      />

      {/* CONTENU (DA4) : Markdown, aperçu plus bas. */}
      <ChampTexte id={`${base}-texte-fr`} name="texte_fr" libelle={t("texteFr.libelle")} aide={t("texteFr.aide")} valeur={texteFr} onChange={setTexteFr} erreur={erreurDe("texte_fr")} multiligne />
      <ChampTexte id={`${base}-texte-en`} name="texte_en" libelle={t("texteEn.libelle")} aide={t("texteEn.aide")} valeur={texteEn} onChange={setTexteEn} erreur={erreurDe("texte_en")} multiligne />
      <p className="t-small text-text-secondary">{t("markdown")}</p>

      {/* Image (DA5) : zone d'ajout avec vignette ; avant le premier enregistrement, un texte le dit (comme avant la refonte). */}
      <section aria-labelledby={`${base}-image`} className="flex flex-col gap-3">
        <h2 id={`${base}-image`} className={classes.etiquette}>
          {tz("image")}
        </h2>
        {article ? (
          <ImagesArticle images={images} onChange={changerImages} desactive={enCours} partie="ajout" onEnvoi={setEnvoiImage} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-admin-champ text-text-secondary">
              <ImageIcon aria-hidden="true" className="size-10" strokeWidth={1.5} />
            </div>
            <p className="t-body min-w-0 flex-1 text-text-primary">{tz("imagesApres", { max: IMAGE_ARTICLE_TAILLE_MAX / (1024 * 1024) })}</p>
          </div>
        )}
      </section>

      {/* STATUT (DA6, Q26) : menu sur la fiche ; Brouillon en lecture seule à la création. */}
      {article && statut ? (
        <PublicationArticle articleId={article.id} publie={statut.publie} archive={statut.archive} titre={statut.titre} peutPublier={statut.peutPublier} />
      ) : (
        <StatutCreationArticle />
      )}

      {/* Champs du code absents de la maquette (DA7), dans le même style. */}
      <ChampTexte id={`${base}-slug`} name="slug" libelle={t("slug.libelle")} aide={t("slug.aide")} valeur={slug} onChange={(valeur) => { setSlugModifie(true); setSlug(valeur); }} erreur={erreurDe("slug")} />

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${base}-produit`} className={classes.etiquette}>
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
          className={classes.champ}
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

      {article ? (
        <section aria-labelledby={`${base}-images-titre`} className="flex flex-col gap-4 border-t border-border pt-6">
          <h2 id={`${base}-images-titre`} className="t-h3">
            {t("imagesTitre")}
          </h2>
          <p className="t-small text-text-secondary">{t("imagesAide")}</p>
          <ImagesArticle images={images} onChange={changerImages} desactive={enCours || envoiImage} partie="liste" />
        </section>
      ) : (
        <p className="t-small text-text-secondary">{t("imagesApresCreation")}</p>
      )}

      <div className="flex flex-col gap-3">
        <Bouton type="submit" enCours={enCours || redirige || envoiImage}>
          {enCours || redirige ? t("enCours") : t("enregistrer")}
        </Bouton>
      </div>

      <section aria-labelledby={`${base}-apercu-titre`} className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 id={`${base}-apercu-titre`} className="t-h3">
          {t("apercu.titre")}
        </h2>
        <p className="t-small text-text-secondary">{t("apercu.aide")}</p>
        <div data-apercu="" className="rounded-2xl border border-border bg-admin-champ p-5">
          {texteFr.trim() === "" ? <p className="t-body text-text-secondary">{t("apercu.vide")}</p> : <ContenuArticle texte={texteFr} />}
        </div>
      </section>
    </form>
  );
}
