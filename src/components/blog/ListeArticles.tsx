"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { VoirPlus } from "@/components/catalogue/VoirPlus";
import type { Locale } from "@/i18n/routing";
import { adresseAvecCurseur, serialiserCurseur } from "@/modules/blog/adresse";
import type { CarteArticle as Donnees } from "@/modules/blog/types";
import { chargerPlusArticles } from "@/modules/blog/voir-plus";
import { CarteArticle } from "./CarteArticle";

type Props = {
  articles: Donnees[];
  // Curseur de la page suivante ; null s'il n'y en a plus.
  suite: string | null;
  // Identité de la liste affichée (première page ou curseur) : quand elle change, la liste repart des articles reçus du serveur.
  cle: string;
};

// La liste du Blog : les 12 premiers Articles arrivent rendus par le serveur ; « Voir plus » en ajoute 12 à la fois (Server Action),
// met à jour l'adresse (replaceState : le bouton Précédent garde son sens) et place le focus sur la première carte ajoutée.
export function ListeArticles({ articles, suite, cle }: Props) {
  const t = useTranslations("Blog.voirPlus");
  const locale = useLocale() as Locale;
  const [liste, setListe] = useState(articles);
  const [curseurSuite, setCurseurSuite] = useState(suite);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [cleVue, setCleVue] = useState(cle);
  if (cle !== cleVue) {
    setCleVue(cle);
    setListe(articles);
    setCurseurSuite(suite);
    setEnCours(false);
    setErreur(false);
  }
  // Article à focaliser après le prochain rendu (le premier ajouté par « Voir plus »).
  const aFocaliser = useRef<string | null>(null);
  const grille = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const id = aFocaliser.current;
    if (!id) return;
    aFocaliser.current = null;
    grille.current?.querySelector<HTMLElement>(`[data-carte="${id}"] a`)?.focus();
  }, [liste]);

  async function charger() {
    if (!curseurSuite) return;
    setEnCours(true);
    setErreur(false);
    try {
      const resultat = await chargerPlusArticles(curseurSuite, locale);
      if (!resultat.ok) {
        setErreur(true);
        return;
      }
      const dejaVus = new Set(liste.map((a) => a.id));
      const nouveaux = resultat.articles.filter((a) => !dejaVus.has(a.id));
      // Rien de nouveau : ni adresse réécrite, ni changement de lien ; le focus reste sur « Voir plus ».
      if (nouveaux.length === 0) return;
      aFocaliser.current = nouveaux[0].id;
      setListe([...liste, ...nouveaux]);
      // L'adresse reflète la liste affichée : recharger cette adresse (ou ouvrir le lien sans JavaScript) affiche la même liste.
      window.history.replaceState(null, "", adresseAvecCurseur(locale, curseurSuite));
      setCurseurSuite(resultat.suite);
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ul ref={grille} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {liste.map((article) => (
          <li key={article.id}>
            <CarteArticle article={article} />
          </li>
        ))}
      </ul>
      {curseurSuite ? (
        <VoirPlus
          href={`/blog?${serialiserCurseur(curseurSuite)}`}
          enCours={enCours}
          erreur={erreur}
          onCharger={charger}
          textes={{ libelle: t("libelle"), enCours: t("enCours") }}
        />
      ) : null}
    </div>
  );
}
