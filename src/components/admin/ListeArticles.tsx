"use client";

import { Archive, Check, Eye, ImageIcon, Pencil, PencilLine } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import { FILTRES_ARTICLES, type ArticleListe, type FiltreArticles } from "@/modules/blog/types";
import { ActionsArticle, type FinAction } from "./ActionsArticle";
import { Panneau } from "./ui/Panneau";
import { Pastille } from "./ui/Pastille";
import { PastilleFiltre } from "./ui/PastilleFiltre";
import { nb } from "@/components/ui/Nombre";

const FUSEAU_BOUTIQUE = "Africa/Lubumbashi";

export function filtrerArticles(articles: readonly ArticleListe[], filtre: FiltreArticles): ArticleListe[] {
  return articles.filter((a) => {
    if (filtre === "archives") return a.archiveLe !== null;
    if (a.archiveLe !== null) return false;
    if (filtre === "publies") return a.publieLe !== null;
    if (filtre === "brouillons") return a.publieLe === null;
    return true;
  });
}

// Blog selon la maquette 05-blog (story 9.16 g, CB1 à CB10 d'INVENTAIRE.md) : « ÉCRIRE UN ARTICLE », grand panneau avec « N ARTICLES » (annoncé
// en statut) et les filtres TOUS, PUBLIÉS, BROUILLONS, ARCHIVÉS (Q26/Q27 : filtrage de la liste déjà lue, filtre gardé dans l'adresse), cartes
// en grille (1 colonne sur téléphone, 2 à partir de 1280 px). « Tous » = tous les articles non archivés (même convention que les produits).
// peutPublier (rôle Admin lu par la page) : Publier, Dépublier, Archiver et Restaurer ne sont rendus que pour l'Admin (la base les refuse à l'Assistant).
export function ListeArticles({
  articles,
  filtreInitial,
  peutPublier,
}: {
  articles: readonly ArticleListe[];
  filtreInitial: FiltreArticles;
  peutPublier: boolean;
}) {
  const t = useTranslations("Admin.blog");
  const [filtre, setFiltre] = useState<FiltreArticles>(filtreInitial);
  // Annonce après une action réelle, effacée au début de chaque action et au changement de filtre (une même annonce répétée est relue).
  // Le focus passe au compteur seulement après archivage ou restauration : la carte quitte la vue, il ne doit pas tomber sur body.
  // Après Publier ou Dépublier, la carte reste : le focus ne bouge pas.
  const [annonce, setAnnonce] = useState<{ action: FinAction; n: number } | null>(null);
  const compteur = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (annonce && (annonce.action === "archive" || annonce.action === "restaure")) compteur.current?.focus();
  }, [annonce]);
  const terminer = (action: FinAction) => setAnnonce((a) => ({ action, n: (a?.n ?? 0) + 1 }));
  const commencer = () => setAnnonce(null);

  function choisir(v: FiltreArticles) {
    setFiltre(v);
    setAnnonce(null);
    // Le filtre est écrit dans l'adresse (lien partageable, rechargement) sans relire la base ; replaceState : pas d'entrée d'historique.
    const url = new URL(window.location.href);
    if (v === "tous") url.searchParams.delete("filtre");
    else url.searchParams.set("filtre", v);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[22px] bg-admin-panneau p-5">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        {peutPublier ? <Bouton href="/admin/blog/nouveau">{t("vide.ecrire")}</Bouton> : null}
      </div>
    );
  }

  const visibles = filtrerArticles(articles, filtre);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="t-small mr-auto text-text-secondary">
          {annonce ? t(`archivage.${annonce.action}Ok`) : null}
        </p>
        {/* Point 3 (2026-11-21) : écrire un article est réservé à l'Admin (la base refuse l'Assistant). */}
        {peutPublier ? (
          <Bouton href="/admin/blog/nouveau" className="uppercase">
            {t("nouveau")}
          </Bouton>
        ) : null}
      </div>

      <Panneau>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p ref={compteur} tabIndex={-1} role="status" className="t-label uppercase text-text-primary">
            {t.rich("nombre", { nombre: visibles.length, nb })}
          </p>
          <ul aria-label={t("filtres.libelle")} className="flex flex-wrap gap-3">
            {FILTRES_ARTICLES.map((v) => (
              <li key={v}>
                <PastilleFiltre actif={filtre === v} onClick={() => choisir(v)}>
                  {t(`filtres.${v}`)}
                </PastilleFiltre>
              </li>
            ))}
          </ul>
        </div>
        {visibles.length === 0 ? (
          <p className="t-body text-text-secondary">{t(`grille.aucun.${filtre}`)}</p>
        ) : (
          <ul aria-label={t("grille.liste")} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {visibles.map((a) => (
              <CarteArticle key={a.id} article={a} peutPublier={peutPublier} onCommence={commencer} onTermine={terminer} />
            ))}
          </ul>
        )}
      </Panneau>
    </div>
  );
}

function CarteArticle({
  article: a,
  peutPublier,
  onCommence,
  onTermine,
}: {
  article: ArticleListe;
  peutPublier: boolean;
  onCommence: () => void;
  onTermine: (action: FinAction) => void;
}) {
  const t = useTranslations("Admin.blog");
  const format = useFormatter();
  const archive = a.archiveLe !== null;
  const publie = !archive && a.publieLe !== null;
  const statut = archive ? "archive" : publie ? "publie" : "brouillon";
  const IconeStatut = archive ? Archive : publie ? Check : PencilLine;
  // Date courte (CB7) : publication, sinon dernière modification ; l'année n'est écrite que si elle n'est pas l'année en cours.
  const date = new Date(a.publieLe ?? a.modifieLe);
  const annee = (d: Date) => format.dateTime(d, { year: "numeric", timeZone: FUSEAU_BOUTIQUE });
  const dateCourte = format.dateTime(date, {
    day: "numeric",
    month: "short",
    ...(annee(date) === annee(new Date()) ? {} : { year: "numeric" }),
    timeZone: FUSEAU_BOUTIQUE,
  });

  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-admin-grille p-4 text-text-primary">
      <div className="grid h-[200px] w-full place-items-center overflow-hidden rounded-2xl bg-admin-champ sm:h-[260px]">
        {a.vignette ? (
          // Adresse publique du bucket des images : <img> assumé (pas d'optimisation Next dans l'admin).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.vignette.url} alt={a.vignette.alt} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-secondary">
            <ImageIcon aria-hidden="true" className="size-16" strokeWidth={1.5} />
            <span className="t-small">{t("grille.imageAbsente")}</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {publie ? (
          <span className="t-label inline-flex min-h-9 items-center rounded-full bg-primary px-4 py-1 uppercase text-on-primary">
            <IconeStatut aria-hidden="true" className="mr-2 size-4" />
            {t(`statut.${statut}`)}
          </span>
        ) : (
          <Pastille>
            <IconeStatut aria-hidden="true" className="mr-2 size-4" />
            <span className="uppercase">{t(`statut.${statut}`)}</span>
          </Pastille>
        )}
        <p className="t-body">
          <span className="sr-only">{t(a.publieLe ? "grille.publieLe" : "grille.modifieLe")} </span>
          <time dateTime={date.toISOString()}>{dateCourte}</time>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="t-h3 [overflow-wrap:anywhere]">{a.titreFr}</h2>
        {a.extrait ? <p className="t-body text-text-secondary [overflow-wrap:anywhere]">{a.extrait}</p> : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t-2 border-text-primary pt-3">
        <Link
          href={`/admin/blog/${a.id}`}
          aria-label={peutPublier ? t("grille.modifierSur", { titre: a.titreFr }) : t("lecture.lireSur", { titre: a.titreFr })}
          className="inline-flex size-touch shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-admin-champ"
        >
          {peutPublier ? <Pencil aria-hidden="true" className="size-7" /> : <Eye aria-hidden="true" className="size-7" />}
        </Link>
        {peutPublier ? (
          <ActionsArticle articleId={a.id} titre={a.titreFr} publie={publie} archive={archive} onCommence={onCommence} onTermine={onTermine} />
        ) : null}
      </div>
    </li>
  );
}
