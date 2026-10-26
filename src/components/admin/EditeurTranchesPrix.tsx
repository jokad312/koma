"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { ChampTexte } from "@/components/admin/ChampTexte";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { prixPourSaisie } from "@/lib/argent";
import { enregistrerTranchesPrix, type EtatTranches } from "@/modules/catalogue/actions";
import { TRANCHES_MAX } from "@/modules/catalogue/types";
import type { ChampTranche, TranchePrix } from "@/modules/catalogue/types";

const BOUTON =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface px-4 text-text-primary aria-disabled:cursor-not-allowed aria-disabled:text-text-secondary";

type Ligne = { cle: string; libelleFr: string; libelleEn: string; bas: string; haut: string };

function Fleche({ haut }: { haut: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d={haut ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} />
    </svg>
  );
}

// Éditeur des tranches de prix du filtre des catalogues. Un seul bouton Enregistrer remplace l'ensemble ; le succès n'apparaît
// qu'après la réponse réelle de la base et la saisie est conservée après un échec. Aucune tranche par défaut.
export function EditeurTranchesPrix({ tranches }: { tranches: readonly TranchePrix[] }) {
  const t = useTranslations("Admin.reglages.tranches");
  const base = useId();
  const compteur = useRef(0);
  // Clés stables des lignes : celles du départ portent leur rang, les ajouts un compteur (lu seulement dans un gestionnaire).
  const nouvelleCle = () => `${base}-n${(compteur.current += 1)}`;
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    tranches.map((tr, i) => ({
      cle: `${base}-i${i}`,
      libelleFr: tr.libelleFr,
      libelleEn: tr.libelleEn,
      bas: prixPourSaisie(tr.basCents),
      haut: tr.hautCents === null ? "" : prixPourSaisie(tr.hautCents),
    })),
  );
  const [enregistrees, setEnregistrees] = useState(tranches.length);
  const [etat, setEtat] = useState<EtatTranches | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const idErreur = `${base}-erreur`;
  const idAjouter = `${base}-ajouter`;
  // Élément à focaliser après le prochain rendu (renseigné par les gestionnaires, lu et vidé par l'effet).
  const cibleFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!cibleFocus.current) return;
    document.getElementById(cibleFocus.current)?.focus();
    cibleFocus.current = null;
  }, [lignes, etat]);

  function modifier(cle: string, champ: keyof Omit<Ligne, "cle">, valeur: string) {
    setEtat(null);
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));
  }

  function deplacer(index: number, sens: -1 | 1) {
    const cible = index + sens;
    if (cible < 0 || cible >= lignes.length) return;
    setEtat(null);
    setLignes((l) => {
      const copie = [...l];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
    setAnnonce(t("deplacee", { numero: cible + 1 }));
  }

  function retirer(index: number) {
    setEtat(null);
    cibleFocus.current = lignes[index + 1] ? `${lignes[index + 1].cle}-retirer` : idAjouter;
    setLignes((l) => l.filter((_, i) => i !== index));
    setAnnonce(t("retiree", { numero: index + 1 }));
  }

  function ajouter() {
    if (lignes.length >= TRANCHES_MAX) return;
    setEtat(null);
    const cle = nouvelleCle();
    cibleFocus.current = `${cle}-fr`;
    setLignes((l) => [...l, { cle, libelleFr: "", libelleEn: "", bas: "", haut: "" }]);
    setAnnonce(t("ajoutee", { numero: lignes.length + 1 }));
  }

  function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    enVol.current = true;
    setEtat(null);
    setAnnonce(null);
    demarrer(async () => {
      try {
        const resultat = await enregistrerTranchesPrix(lignes.map(({ libelleFr, libelleEn, bas, haut }) => ({ libelleFr, libelleEn, bas, haut })));
        if (resultat.statut === "erreur") cibleFocus.current = idErreur;
        setEtat(resultat);
        if (resultat.statut === "succes") setEnregistrees(lignes.length);
      } catch {
        cibleFocus.current = idErreur;
        setEtat({ statut: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  const erreur = etat?.statut === "erreur" ? etat : null;
  const codeErreur = erreur ? (["non_autorise", "tranche_libelle_invalide", "tranche_bornes_invalides", "tranches_trop_nombreuses"].includes(erreur.erreur) ? erreur.erreur : "generique") : null;
  const messageErreur = erreur && codeErreur ? (erreur.ligne ? t("erreurLigne", { numero: erreur.ligne, message: t(`erreurs.${codeErreur}`) }) : t(`erreurs.${codeErreur}`)) : null;
  const erreurDe = (index: number, champ: ChampTranche) => (erreur && erreur.ligne === index + 1 && erreur.champ === champ ? messageErreur : null);

  return (
    <section aria-labelledby={`${base}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 id={`${base}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{enregistrees > 0 ? t("nombreEnregistrees", { nombre: enregistrees }) : t("valeurAFixer")}</p>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      <form onSubmit={enregistrer} noValidate className="flex flex-col gap-4">
        {lignes.length === 0 ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
        {lignes.length > 0 ? (
          <ol aria-label={t("legende")} className="flex flex-col gap-4">
            {lignes.map((l, i) => {
              const numero = i + 1;
              const premiere = i === 0;
              const derniere = i === lignes.length - 1;
              return (
                <li key={l.cle} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <p className="t-label">{t("position", { numero })}</p>
                  <ChampTexte
                    id={`${l.cle}-fr`}
                    name={`libelle_fr_${numero}`}
                    libelle={t("libelleFr", { numero })}
                    valeur={l.libelleFr}
                    onChange={(v) => modifier(l.cle, "libelleFr", v)}
                    erreur={erreurDe(i, "libelle_fr")}
                  />
                  <ChampTexte
                    id={`${l.cle}-en`}
                    name={`libelle_en_${numero}`}
                    libelle={t("libelleEn", { numero })}
                    valeur={l.libelleEn}
                    onChange={(v) => modifier(l.cle, "libelleEn", v)}
                    erreur={erreurDe(i, "libelle_en")}
                  />
                  <ChampTexte
                    id={`${l.cle}-bas`}
                    name={`bas_${numero}`}
                    libelle={t("bas", { numero })}
                    inputMode="decimal"
                    valeur={l.bas}
                    onChange={(v) => modifier(l.cle, "bas", v)}
                    erreur={erreurDe(i, "bas")}
                  />
                  <ChampTexte
                    id={`${l.cle}-haut`}
                    name={`haut_${numero}`}
                    libelle={t("haut", { numero })}
                    aide={t("hautAide")}
                    inputMode="decimal"
                    valeur={l.haut}
                    onChange={(v) => modifier(l.cle, "haut", v)}
                    erreur={erreurDe(i, "haut")}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={BOUTON} aria-disabled={premiere || undefined} aria-label={t("monter", { numero })} onClick={premiere ? undefined : () => deplacer(i, -1)}>
                      <Fleche haut />
                    </button>
                    <button type="button" className={BOUTON} aria-disabled={derniere || undefined} aria-label={t("descendre", { numero })} onClick={derniere ? undefined : () => deplacer(i, 1)}>
                      <Fleche haut={false} />
                    </button>
                    <button type="button" id={`${l.cle}-retirer`} className={BOUTON} aria-label={t("retirer", { numero })} onClick={() => retirer(i)}>
                      {t("retirerCourt")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" id={idAjouter} className={BOUTON} aria-disabled={lignes.length >= TRANCHES_MAX || undefined} onClick={lignes.length >= TRANCHES_MAX ? undefined : ajouter}>
            {t("ajouter")}
          </button>
          {lignes.length >= TRANCHES_MAX ? <p className="t-small text-text-secondary">{t("limite", { nombre: TRANCHES_MAX })}</p> : null}
        </div>
        <div role="status" className="t-small text-text-primary">
          {annonce}
        </div>
        {messageErreur ? (
          <p id={idErreur} role="alert" tabIndex={-1} className="t-small text-danger">
            {messageErreur}
          </p>
        ) : null}
        <Bouton type="submit" enCours={enCours}>
          {enCours ? t("enCours") : t("enregistrer")}
        </Bouton>
      </form>
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}
    </section>
  );
}
