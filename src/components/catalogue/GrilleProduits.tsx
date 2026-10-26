"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cheminPublic } from "@/i18n/adresses";
import type { Locale } from "@/i18n/routing";
import { adresseAvecRequete, requeteAvecCurseur } from "@/modules/catalogue/adresse";
import type { CarteProduit as Donnees, FamillePhysique } from "@/modules/catalogue/types";
import { chargerPlusProduits } from "@/modules/catalogue/voir-plus";
import { CarteProduit } from "./CarteProduit";
import { VoirPlus } from "./VoirPlus";

const DOSSIER: Record<FamillePhysique, string> = { cosplay: "/cosplays", accessoire: "/accessoires" };

type Props = {
  famille: FamillePhysique;
  produits: Donnees[];
  // Requête (sans « ? ») de la page suivante, curseur compris ; null s'il n'en reste plus.
  requeteSuite: string | null;
  // Requête de filtres et de tri, sans curseur (pour reconstruire la suite).
  requeteBase: string;
  // Identité de la liste affichée (filtres, tri, curseur) : quand elle change, la liste repart des produits reçus du serveur.
  cle: string;
};

// La liste : les 12 premiers produits arrivent rendus par le serveur ; « Voir plus » en ajoute 12 à la fois (Server Action),
// met à jour l'adresse (replaceState : le bouton Précédent garde son sens) et place le focus sur le premier produit ajouté.
// Le nombre affiché est annoncé en role="status".
export function GrilleProduits({ famille, produits, requeteSuite, requeteBase, cle }: Props) {
  const t = useTranslations("Catalogue");
  const locale = useLocale() as Locale;
  const [liste, setListe] = useState(produits);
  const [suite, setSuite] = useState(requeteSuite);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  // La région d'état reste montée (pas de key sur ce composant) : seul son texte change quand la liste change.
  const [cleVue, setCleVue] = useState(cle);
  if (cle !== cleVue) {
    setCleVue(cle);
    setListe(produits);
    setSuite(requeteSuite);
    setEnCours(false);
    setErreur(false);
  }
  // Produit à focaliser après le prochain rendu (le premier ajouté par « Voir plus »).
  const aFocaliser = useRef<string | null>(null);
  const grille = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const id = aFocaliser.current;
    if (!id) return;
    aFocaliser.current = null;
    grille.current?.querySelector<HTMLElement>(`[data-carte="${id}"] a`)?.focus();
  }, [liste]);

  const chemin = cheminPublic(locale, DOSSIER[famille]);

  async function charger() {
    if (!suite) return;
    setEnCours(true);
    setErreur(false);
    try {
      const resultat = await chargerPlusProduits(famille, suite, locale);
      if (!resultat.ok) {
        setErreur(true);
        return;
      }
      const dejaVus = new Set(liste.map((p) => p.id));
      const nouveaux = resultat.produits.filter((p) => !dejaVus.has(p.id));
      // Rien de nouveau : ni adresse réécrite, ni changement de lien ; le focus reste sur « Voir plus ».
      if (nouveaux.length === 0) return;
      aFocaliser.current = nouveaux[0].id;
      setListe([...liste, ...nouveaux]);
      // L'adresse reflète la liste affichée : le lien du bouton porte le curseur cumulé (n = produits affichés avant ce clic),
      // donc recharger cette adresse (ou ouvrir le lien sans JavaScript) affiche la même liste.
      window.history.replaceState(null, "", `/${locale}${adresseAvecRequete(chemin, suite)}`);
      setSuite(resultat.suite ? requeteAvecCurseur(requeteBase, resultat.suite) : null);
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="t-small text-text-secondary">
        {suite ? t("resultatsSuite", { n: liste.length }) : t("resultats", { n: liste.length })}
      </p>
      <h2 id="catalogue-liste" className="sr-only">
        {t("liste")}
      </h2>
      <ul ref={grille} aria-labelledby="catalogue-liste" className="grid grid-cols-2 gap-ecart-cartes lg:grid-cols-4">
        {liste.map((p) => (
          <li key={p.id}>
            <CarteProduit produit={p} />
          </li>
        ))}
      </ul>
      {suite ? <VoirPlus href={adresseAvecRequete(chemin, suite)} enCours={enCours} erreur={erreur} onCharger={charger} /> : null}
    </div>
  );
}
