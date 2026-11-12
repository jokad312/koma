"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import type { ProduitListe } from "@/modules/catalogue/types";
import { PastilleStatut } from "./PastilleStatut";
import { PublierDepublierCarte } from "./PublierDepublierCarte";

// Minuscules sans accents : la recherche ne tient compte ni de la casse ni des accents.
const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

// Produits en grille de cartes (story 9.10) : 1 colonne sur téléphone, 2 à 4 selon la largeur. Recherche en haut (nom, famille, univers) et compteur annoncé en statut.
// Carte : image (ou « Pas de photo », jamais une image inventée), nom, famille et univers, prix, statut, état du stock, Modifier et Publier / Dépublier.
// La carte entière est cliquable par UN SEUL lien (le nom, étendu sur toute la carte) ; le bouton Publier / Dépublier reste un contrôle distinct au-dessus.
export function ListeProduits({ produits }: { produits: readonly ProduitListe[] }) {
  const t = useTranslations("Admin.produits");
  const locale = useLocale() === "en" ? "en" : "fr";
  const id = useId();
  const [recherche, setRecherche] = useState("");

  if (produits.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        <Bouton href="/admin/produits/nouveau">{t("vide.creer")}</Bouton>
      </div>
    );
  }

  const prix = (cents: number | null) => (cents === null ? t("prixAFixer") : formaterUsd(cents, locale));
  const terme = normaliser(recherche.trim());
  const visibles = terme === "" ? produits : produits.filter((p) => normaliser(`${p.titreFr} ${t(`famille.${p.famille}`)} ${p.universFr ?? ""}`).includes(terme));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor={`${id}-recherche`} className="sr-only">
            {t("grille.recherche")}
          </label>
          <input
            id={`${id}-recherche`}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("grille.recherchePlaceholder")}
            autoComplete="off"
            className="min-h-touch w-full rounded-md border border-border-field bg-surface px-4 text-text-primary"
          />
        </div>
        <p role="status" className="t-small text-text-secondary">
          {t("nombre", { nombre: visibles.length })}
        </p>
      </div>

      {visibles.length === 0 ? (
        <p className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{t("grille.aucunResultat")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-ecart-cartes sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibles.map((p) => (
            <li key={p.id} className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary">
              <div className="aspect-[4/3] w-full bg-background">
                {p.photo ? (
                  // Adresse publique du bucket des photos de produit : <img> assumé (pas d'optimisation Next dans l'admin).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo.url} alt={p.photo.alt} loading="lazy" className="size-full object-cover" />
                ) : (
                  <div className="t-small grid size-full place-items-center text-text-secondary">{t("grille.photoAbsente")}</div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="t-h3">
                  <Link href={`/admin/produits/${p.id}`} className="inline-flex min-h-touch items-center underline after:absolute after:inset-0 after:content-['']">
                    {p.titreFr}
                  </Link>
                </h2>
                <p className="t-small text-text-secondary">{[t(`famille.${p.famille}`), p.universFr].filter(Boolean).join(" · ")}</p>
                <p className="t-body text-text-primary">{prix(p.prixCents)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <PastilleStatut publie={p.publieLe !== null} libelle={t(p.publieLe === null ? "statut.brouillon" : "statut.publie")} />
                  <span className="t-small rounded-full border border-border px-3 py-1 text-text-primary">{t(`grille.stock.${p.stock}`)}</span>
                </div>
                <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-2">
                  {/* Libellé visuel de l'action : le clic tombe sur le lien étendu de la carte (un seul lien par carte). */}
                  <span aria-hidden="true" className="t-label inline-flex min-h-touch items-center rounded-full border border-border-field px-4 text-text-primary">
                    {t("grille.modifier")}
                  </span>
                  <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                    <PublierDepublierCarte produitId={p.id} publie={p.publieLe !== null} titre={p.titreFr} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
