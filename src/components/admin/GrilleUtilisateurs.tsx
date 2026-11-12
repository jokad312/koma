"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { formaterDateBoutique } from "@/lib/dates";
import type { UtilisateurAdmin } from "@/modules/admin/utilisateurs";

const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

// Initiales du nom, ou du début de l'email masqué (« ab*** » → « AB »).
function initiales(u: UtilisateurAdmin): string {
  const source = (u.nom ?? u.emailMasque ?? "").replace(/\*.*$/, "");
  const mots = source.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (mots.length >= 2 ? `${mots[0][0]}${mots[1][0]}` : (mots[0] ?? "").slice(0, 2)).toLocaleUpperCase() || "?";
}

// Utilisateurs en grille de cartes (story 9.10), lecture seule : aucun lien, aucun changement de rôle. Recherche en haut (nom, email masqué, rôle) et compteur annoncé en statut.
export function GrilleUtilisateurs({ utilisateurs }: { utilisateurs: readonly UtilisateurAdmin[] }) {
  const t = useTranslations("Admin.utilisateurs");
  const locale = useLocale() === "en" ? "en" : "fr";
  const id = useId();
  const [recherche, setRecherche] = useState("");

  if (utilisateurs.length === 0) return <p role="status" className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{t("vide")}</p>;

  const terme = normaliser(recherche.trim());
  const roleTexte = (u: UtilisateurAdmin) => (u.role ? t(`roles.${u.role}`) : t("roles.aucun"));
  const visibles = terme === "" ? utilisateurs : utilisateurs.filter((u) => normaliser(`${u.nom ?? ""} ${u.emailMasque ?? ""} ${roleTexte(u)}`).includes(terme));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor={`${id}-recherche`} className="sr-only">
            {t("recherche")}
          </label>
          <input
            id={`${id}-recherche`}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("recherchePlaceholder")}
            autoComplete="off"
            className="min-h-touch w-full rounded-md border border-border-field bg-surface px-4 text-text-primary"
          />
        </div>
        <p role="status" className="t-small text-text-secondary">
          {t("nombre", { nombre: visibles.length })}
        </p>
      </div>

      {visibles.length === 0 ? (
        <p className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{t("aucunResultat")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-ecart-cartes sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibles.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="t-label inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                  {initiales(u)}
                </span>
                <div className="min-w-0">
                  <h2 className="t-h3 truncate">{u.nom ?? u.emailMasque ?? t("sansNom")}</h2>
                  {u.nom && u.emailMasque ? <p className="t-small truncate text-text-secondary">{u.emailMasque}</p> : null}
                </div>
              </div>
              <p className="t-small text-text-secondary">{u.inscritLe ? t("inscritLe", { date: formaterDateBoutique(u.inscritLe, locale) ?? u.inscritLe }) : t("inscritInconnu")}</p>
              <div>
                <span className="t-small rounded-full border border-border px-3 py-1 text-text-primary">{roleTexte(u)}</span>
              </div>
              <dl className="t-small grid grid-cols-2 gap-2 border-t border-border pt-3">
                <div>
                  <dt className="text-text-secondary">{t("commandes")}</dt>
                  <dd className="t-body text-text-primary">{u.commandes}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{t("pass")}</dt>
                  <dd className="t-body text-text-primary">{u.pass}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
