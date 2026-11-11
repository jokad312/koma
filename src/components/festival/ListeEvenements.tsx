"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { VoirPlus } from "@/components/catalogue/VoirPlus";
import type { Locale } from "@/i18n/routing";
import { adresseAvecAffiches } from "@/modules/evenements/adresse";
import type { CarteEvenement as Donnees } from "@/modules/evenements/types";
import { chargerPlusEvenements } from "@/modules/evenements/voir-plus";
import { CarteEvenement } from "./CarteEvenement";

type Props = {
  evenements: Donnees[];
  // Nombre d'Événements montrés quand on demande la suite ; null s'il n'y en a plus.
  suite: number | null;
  // Identité de la liste affichée : quand elle change, la liste repart des Événements reçus du serveur.
  cle: string;
};

// La liste du Festival : les Événements à venir puis les passés. Les 12 premiers arrivent rendus par le serveur ; « Voir plus » en ajoute
// 12 à la fois (Server Action), met à jour l'adresse (replaceState) et place le focus sur la première carte ajoutée.
// Sans Événement à venir : message, les passés restent affichés. Aucun Événement du tout : le message seul.
export function ListeEvenements({ evenements, suite, cle }: Props) {
  const t = useTranslations("Festival");
  const locale = useLocale() as Locale;
  const [liste, setListe] = useState(evenements);
  const [suiteAffichee, setSuiteAffichee] = useState(suite);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [cleVue, setCleVue] = useState(cle);
  if (cle !== cleVue) {
    setCleVue(cle);
    setListe(evenements);
    setSuiteAffichee(suite);
    setEnCours(false);
    setErreur(false);
  }
  const aFocaliser = useRef<string | null>(null);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = aFocaliser.current;
    if (!id) return;
    aFocaliser.current = null;
    conteneur.current?.querySelector<HTMLElement>(`[data-carte="${id}"] a`)?.focus();
  }, [liste]);

  async function charger() {
    if (!suiteAffichee) return;
    setEnCours(true);
    setErreur(false);
    try {
      const resultat = await chargerPlusEvenements(suiteAffichee, locale);
      if (!resultat.ok) {
        setErreur(true);
        return;
      }
      const dejaVus = new Set(liste.map((e) => e.id));
      const nouveaux = resultat.evenements.filter((e) => !dejaVus.has(e.id));
      if (nouveaux.length === 0) return;
      aFocaliser.current = nouveaux[0].id;
      setListe([...liste, ...nouveaux]);
      // L'adresse reflète la liste affichée : recharger cette adresse (ou ouvrir le lien sans JavaScript) montre la même liste.
      window.history.replaceState(null, "", adresseAvecAffiches(locale, suiteAffichee));
      setSuiteAffichee(resultat.suite);
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  const aVenir = liste.filter((e) => !e.passe);
  const passes = liste.filter((e) => e.passe);

  return (
    <div ref={conteneur} className="flex flex-col gap-8">
      {aVenir.length === 0 && passes.length === 0 ? (
        <p className="t-body text-text-secondary">{t("vide")}</p>
      ) : (
        <>
          <section aria-labelledby="festival-avenir" className="flex flex-col gap-4">
            <h2 id="festival-avenir" className="t-h2">
              {t("avenir")}
            </h2>
            {aVenir.length === 0 ? (
              <p className="t-body text-text-secondary">{t("vide")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {aVenir.map((evenement) => (
                  <li key={evenement.id}>
                    <CarteEvenement evenement={evenement} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {passes.length > 0 ? (
            <section aria-labelledby="festival-passes" className="flex flex-col gap-4">
              <h2 id="festival-passes" className="t-h2">
                {t("passes")}
              </h2>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {passes.map((evenement) => (
                  <li key={evenement.id}>
                    <CarteEvenement evenement={evenement} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      {suiteAffichee ? (
        <VoirPlus
          href={`/festival?affiches=${suiteAffichee}`}
          enCours={enCours}
          erreur={erreur}
          onCharger={charger}
          textes={{ libelle: t("voirPlus.libelle"), enCours: t("voirPlus.enCours") }}
        />
      ) : null}
    </div>
  );
}
