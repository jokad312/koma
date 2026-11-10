"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Dialogue } from "@/components/ui/Dialogue";
import { VoirPlus } from "@/components/catalogue/VoirPlus";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adresseAvecCurseurMurs } from "@/modules/communaute/adresse";
import { chargerPlusMurs } from "@/modules/communaute/voir-plus";
import type { MurPublic } from "@/modules/communaute/types";

type Props = {
  // Identité de la liste affichée (première page ou curseur) : quand elle change, la liste repart des murs reçus du serveur.
  cle: string;
  murs: MurPublic[];
  suite: string | null;
  nomSite: string;
};

// La liste du Mur accueil : les entrées arrivent rendues par le serveur ; « Voir plus » en ajoute via Server Action, met à
// jour l'adresse (replaceState : le bouton Précédent garde son sens) et place le focus sur la première carte ajoutée.
// Une entrée : une seule colonne ; plusieurs : deux colonnes (mobile comprise). Sans entrée, le bloc n'est pas rendu.
export function ListeMurs({ cle, murs, suite, nomSite }: Props) {
  const tm = useTranslations("Accueil.mur");
  const locale = useLocale() as Locale;
  const [liste, setListe] = useState(murs);
  const [curseurSuite, setCurseurSuite] = useState(suite);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [cleVue, setCleVue] = useState(cle);
  if (cle !== cleVue) {
    setCleVue(cle);
    setListe(murs);
    setCurseurSuite(suite);
    setEnCours(false);
    setErreur(false);
  }
  const aFocaliser = useRef<string | null>(null);
  const grille = useRef<HTMLUListElement>(null);
  const boutonMur = useRef<HTMLButtonElement | null>(null);
  const [murOuvert, setMurOuvert] = useState<MurPublic | null>(null);

  useEffect(() => {
    const id = aFocaliser.current;
    if (!id) return;
    aFocaliser.current = null;
    grille.current?.querySelector<HTMLElement>(`[data-carte="${id}"]`)?.focus();
  }, [liste]);

  async function charger() {
    if (!curseurSuite) return;
    setEnCours(true);
    setErreur(false);
    try {
      const resultat = await chargerPlusMurs(curseurSuite);
      if (!resultat.ok) {
        setErreur(true);
        return;
      }
      const dejaVus = new Set(liste.map((m) => m.id));
      const nouveaux = resultat.murs.filter((m) => !dejaVus.has(m.id));
      // Plus rien à charger : le lien disparaît (jamais un « Voir plus » devant une liste vide).
      if (resultat.murs.length === 0) {
        setCurseurSuite(null);
        return;
      }
      // Rien de nouveau (entrées déjà affichées) : ni adresse réécrite, ni focus déplacé.
      if (nouveaux.length === 0) {
        setCurseurSuite(resultat.suite);
        return;
      }
      aFocaliser.current = nouveaux[0].id;
      setListe([...liste, ...nouveaux]);
      setCurseurSuite(resultat.suite);
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  function altDeLaLangue(m: MurPublic): string {
    const tAlt = locale === "en" ? m.altEn : m.altFr;
    return tAlt.trim() || m.altFr;
  }

  const classeGrille = liste.length > 1 ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4";

  return (
    <div className="flex flex-col gap-6">
      <ul ref={grille} className={classeGrille}>
        {liste.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              data-carte={m.id}
              onClick={(e) => {
                // Le focus revient à la tuile ouverte, pas à la dernière tuile rendue.
                boutonMur.current = e.currentTarget;
                setMurOuvert(m);
              }}
              aria-haspopup="dialog"
              className="group relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Image src={urlPhotoPublique(m.fichier)} alt={altDeLaLangue(m)} fill sizes="50vw" className="object-cover" />
              {m.pseudo || m.faitAvecKit ? (
                <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-glass-strong p-2 text-left t-small text-text-primary">
                  {m.pseudo ? <span>{m.pseudo}</span> : null}
                  {m.faitAvecKit ? <span>{tm("mention", { nomSite })}</span> : null}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {curseurSuite ? <VoirPlus href={adresseAvecCurseurMurs(locale, curseurSuite)} enCours={enCours} erreur={erreur} onCharger={charger} /> : null}
      <Dialogue
        ouvert={murOuvert !== null}
        onFermer={() => setMurOuvert(null)}
        titre={murOuvert ? altDeLaLangue(murOuvert) : ""}
        retourFocus={boutonMur}
      >
        {murOuvert ? (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface">
              <Image src={urlPhotoPublique(murOuvert.fichier)} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
            </div>
            {murOuvert.faitAvecKit ? (
              <>
                <p className="t-small text-text-primary">{tm("mention", { nomSite })}</p>
                {murOuvert.kitSlug ? (
                  <Link href={cheminPublic(locale, `/kits/${murOuvert.kitSlug}`)} className="t-small text-text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    {locale === "en" ? murOuvert.kitTitreEn || murOuvert.kitTitreFr : murOuvert.kitTitreFr}
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Dialogue>
    </div>
  );
}
