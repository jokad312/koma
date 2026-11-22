"use client";

import { Archive, Check, ImageIcon, Pencil, PencilLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import type { ProduitListe } from "@/modules/catalogue/types";
import { ArchivageProduit } from "./ArchivageProduit";
import { PublierDepublierCarte } from "./PublierDepublierCarte";
import { ChampRecherche } from "./ui/ChampRecherche";
import { Panneau } from "./ui/Panneau";
import { Pastille } from "./ui/Pastille";
import { PastilleFiltre } from "./ui/PastilleFiltre";
import { nb } from "@/components/ui/Nombre";

// Minuscules sans accents : la recherche ne tient compte ni de la casse ni des accents.
const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

type Vue = "actifs" | "archives";

// Produits selon la maquette 03-produits (story 9.16 e, C1 à C17 d'INVENTAIRE.md) : barre (recherche, « N PRODUITS » annoncé en statut,
// UNIVERS, + NOUVEAU PRODUIT), grand panneau, cartes en grille (1 colonne sur téléphone, 2 à partir de 1280 px).
// Carte : vignette (photo ou icône image, jamais une image inventée), nom, PRIX, TÉLÉCHARGEMENTS (Kit) ou VENDUS (article physique), UNIVERS,
// type, état du stock ; trait ; crayon (Modifier), corbeille (Archiver, Q22) ou Restaurer, Publier / Dépublier, statut.
// Filtre « Archivés » (Q22) : un produit archivé est retiré de la liste par défaut et retrouvé ici.
export function ListeProduits({ produits }: { produits: readonly ProduitListe[] }) {
  const t = useTranslations("Admin.produits");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [recherche, setRecherche] = useState("");
  const [vue, setVue] = useState<Vue>("actifs");
  // Annonce après archivage ou restauration réels ; le focus passe au compteur (la carte quitte la vue, il ne doit pas tomber sur body).
  const [annonce, setAnnonce] = useState<{ action: "archive" | "restaure"; n: number } | null>(null);
  const compteur = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (annonce) compteur.current?.focus();
  }, [annonce]);
  const terminer = (action: "archive" | "restaure") => setAnnonce((a) => ({ action, n: (a?.n ?? 0) + 1 }));

  if (produits.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[22px] bg-admin-panneau p-5">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        <Bouton href="/admin/produits/nouveau">{t("vide.creer")}</Bouton>
      </div>
    );
  }

  const terme = normaliser(recherche.trim());
  const dansVue = produits.filter((p) => (vue === "archives") === (p.archiveLe !== null));
  const visibles = terme === "" ? dansVue : dansVue.filter((p) => normaliser(`${p.titreFr} ${t(`famille.${p.famille}`)} ${p.universFr ?? ""}`).includes(terme));
  const vide = terme !== "" ? t("grille.aucunResultat") : vue === "archives" ? t("grille.aucunArchive") : t("grille.aucunActif");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ChampRecherche
          libelle={t("grille.recherche")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t("grille.recherchePlaceholder")}
          autoComplete="off"
        />
        <p ref={compteur} tabIndex={-1} role="status" className="t-label uppercase text-text-primary">
          {t.rich("nombre", { nombre: visibles.length, nb })}
        </p>
        <p role="status" className="t-small text-text-secondary">
          {annonce ? t(annonce.action === "archive" ? "archivage.archiveOk" : "archivage.restaureOk") : null}
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <Link
            href="/admin/univers"
            className="t-label inline-flex min-h-touch items-center justify-center rounded-full bg-admin-univers px-5 uppercase text-admin-sur-univers no-underline"
          >
            {t("grille.univers")}
          </Link>
          <Bouton href="/admin/produits/nouveau" className="uppercase">
            {t("nouveauPlus")}
          </Bouton>
        </div>
      </div>

      <Panneau>
        <ul aria-label={t("grille.filtres")} className="mb-4 flex flex-wrap gap-3">
          {(["actifs", "archives"] as const).map((v) => (
            <li key={v}>
              <PastilleFiltre actif={vue === v} onClick={() => setVue(v)}>
                {t(`grille.vue.${v}`)}
              </PastilleFiltre>
            </li>
          ))}
        </ul>
        {visibles.length === 0 ? (
          <p className="t-body text-text-secondary">{vide}</p>
        ) : (
          <ul aria-label={t("grille.liste")} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {visibles.map((p) => (
              <CarteProduit key={p.id} produit={p} locale={locale} onTermine={terminer} />
            ))}
          </ul>
        )}
      </Panneau>
    </div>
  );
}

function CarteProduit({ produit: p, locale, onTermine }: { produit: ProduitListe; locale: "fr" | "en"; onTermine: (action: "archive" | "restaure") => void }) {
  const t = useTranslations("Admin.produits");
  const archive = p.archiveLe !== null;
  const publie = p.publieLe !== null;
  const statut = archive ? "archive" : publie ? "publie" : "brouillon";
  const IconeStatut = archive ? Archive : publie ? Check : PencilLine;
  // « Gratuit » est un mot (traduisible) ; seul un montant est exclu de la traduction du navigateur.
  const prix = p.prixCents === null ? t("prixAFixer") : t.rich("grille.prix", { valeur: p.prixCents === 0 ? t("grille.gratuit") : formaterUsd(p.prixCents, locale), nb: p.prixCents === 0 ? (mot) => mot : nb });
  const nombre = new Intl.NumberFormat(locale).format(p.compteur);

  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-admin-grille p-4 text-text-primary">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="grid h-[140px] w-full shrink-0 place-items-center overflow-hidden rounded-2xl bg-admin-champ sm:w-[148px]">
          {p.photo ? (
            // Adresse publique du bucket des photos de produit : <img> assumé (pas d'optimisation Next dans l'admin).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo.url} alt={p.photo.alt} loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-text-secondary">
              <ImageIcon aria-hidden="true" className="size-16" strokeWidth={1.5} />
              <span className="t-small">{t("grille.photoAbsente")}</span>
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
          <h2 className="t-label w-full rounded-2xl border border-admin-contour bg-admin-champ px-5 py-3 uppercase [overflow-wrap:anywhere]">{p.titreFr}</h2>
          <Pastille>{prix}</Pastille>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pastille>{p.famille === "kit" ? t.rich("grille.telechargements", { nombre, nb }) : t.rich("grille.vendus", { nombre, nb })}</Pastille>
        <Pastille>{t("grille.universPastille", { nom: p.universFr ?? t("grille.universAucun") })}</Pastille>
        <Pastille>{t(`famille.${p.famille}`)}</Pastille>
        <span className="t-label inline-flex min-h-9 items-center rounded-full border border-border-field px-4 py-1">{t(`grille.stock.${p.stock}`)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t-2 border-text-primary pt-3">
        <Link
          href={`/admin/produits/${p.id}`}
          aria-label={t("grille.modifierSur", { titre: p.titreFr })}
          className="inline-flex size-touch shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-admin-champ"
        >
          <Pencil aria-hidden="true" className="size-7" />
        </Link>
        <ArchivageProduit produitId={p.id} titre={p.titreFr} archive={archive} onTermine={onTermine} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {archive ? null : <PublierDepublierCarte produitId={p.id} publie={publie} titre={p.titreFr} />}
          <Pastille>
            <IconeStatut aria-hidden="true" className="mr-2 size-4" />
            {t(`statut.${statut}`)}
          </Pastille>
        </div>
      </div>
    </li>
  );
}
