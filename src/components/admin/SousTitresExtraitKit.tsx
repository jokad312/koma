"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { definirExtraitSansParole, deposerSousTitresExtrait, supprimerSousTitresExtrait } from "@/modules/catalogue/actions";
import { LANGUES_SOUS_TITRES, SOUS_TITRES_EXTRAIT_TAILLE_MAX } from "@/modules/catalogue/types";
import type { LangueSousTitres } from "@/modules/catalogue/types";
import { CLASSE_CHAMP } from "./ChampTexte";

type Props = { produitId: string; sansParole: boolean; langues: readonly LangueSousTitres[] };

function useTexteErreur() {
  const t = useTranslations("Admin.kits.sousTitresExtrait");
  return (code: string) => t(`erreurs.${t.has(`erreurs.${code}`) ? code : "generique"}`);
}

// Sous-titres d'une langue de l'extrait : fichier .vtt envoyé au serveur (Server Action, 512 Ko au plus), vérifié puis déposé chez Bunny ;
// suppression avec confirmation. Le succès n'est affiché qu'après la réponse réelle du serveur.
function SousTitresExtraitLangue({ produitId, langue, present }: { produitId: string; langue: LangueSousTitres; present: boolean }) {
  const t = useTranslations("Admin.kits.sousTitresExtrait");
  const texteErreur = useTexteErreur();
  const router = useRouter();
  const base = useId();
  const refFichier = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const enVol = useRef(false);
  const nomLangue = t(`nomsLangues.${langue}`);
  const idFichier = `${base}-fichier`;

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    setMessage(null);
    const f = refFichier.current?.files?.[0];
    if (!f) return setErreur(texteErreur("fichier_manquant"));
    if (!/[.]vtt$/i.test(f.name) || f.size < 1) return setErreur(texteErreur("format_invalide"));
    if (f.size > SOUS_TITRES_EXTRAIT_TAILLE_MAX) return setErreur(texteErreur("fichier_trop_lourd"));
    enVol.current = true;
    setEnCours(true);
    try {
      const donnees = new FormData();
      donnees.set("produitId", produitId);
      donnees.set("langue", langue);
      donnees.set("fichier", f);
      const r = await deposerSousTitresExtrait(donnees);
      if (r.statut === "erreur") return setErreur(texteErreur(r.erreur));
      setMessage(t("envoyes"));
      if (refFichier.current) refFichier.current.value = "";
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (enVol.current) return;
    enVol.current = true;
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await supprimerSousTitresExtrait({ produitId, langue });
      if (r.statut === "erreur") return setErreur(texteErreur(r.erreur));
      setMessage(t("supprimes"));
      router.refresh();
    } catch {
      setErreur(texteErreur("generique"));
    } finally {
      enVol.current = false;
      setEnCours(false);
      setConfirmer(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="t-h3">{t(`langues.${langue}`)}</h3>
      <p className="t-small text-text-secondary">{t(langue === "fr" ? "obligatoire" : "facultatif")}</p>
      <p className="t-body text-text-primary">{present ? t("presents") : t("absents")}</p>
      {present ? (
        <div>
          <Bouton variante="secondaire" onClick={() => setConfirmer(true)} enCours={enCours}>
            {t("supprimer", { langue: nomLangue })}
          </Bouton>
        </div>
      ) : null}
      <form onSubmit={surEnvoi} noValidate className="flex flex-col gap-3">
        <label htmlFor={idFichier} className="t-label text-text-primary">
          {t("fichier.libelle", { langue: nomLangue })}
        </label>
        <p id={`${idFichier}-aide`} className="t-small text-text-secondary">
          {t("fichier.aide")}
        </p>
        <input
          ref={refFichier}
          id={idFichier}
          name={`sous-titres-extrait-${langue}`}
          type="file"
          accept=".vtt,text/vtt"
          disabled={enCours}
          aria-describedby={`${idFichier}-aide`}
          className={CLASSE_CHAMP}
        />
        {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
        <div>
          <Bouton type="submit" enCours={enCours}>
            {present ? t("remplacer", { langue: nomLangue }) : t("envoyer", { langue: nomLangue })}
          </Bouton>
        </div>
        <div role="status">{message ? <p className="t-small text-text-primary">{message}</p> : null}</div>
      </form>
      <Dialogue
        ouvert={confirmer}
        onFermer={() => {
          if (!enVol.current) setConfirmer(false);
        }}
        titre={t("suppression.titre", { langue: nomLangue })}
      >
        <p className="t-body">{t("suppression.texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={enCours} onClick={() => setConfirmer(false)}>
            {t("suppression.annuler")}
          </button>
          <Bouton enCours={enCours} onClick={supprimer}>
            {enCours ? t("suppression.enCours") : t("suppression.confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </div>
  );
}

// Section placée sous l'extrait : case « Extrait sans parole » (décochée par défaut) puis sous-titres FR et EN de l'extrait. Cochée, aucun
// sous-titre d'extrait n'est exigé pour publier ; décochée, le français l'est (décision de Jonathan du 2026-10-31).
export function SousTitresExtraitKit({ produitId, sansParole, langues }: Props) {
  const t = useTranslations("Admin.kits.sousTitresExtrait");
  const texteErreur = useTexteErreur();
  const router = useRouter();
  const base = useId();
  const [coche, setCoche] = useState(sansParole);
  // Valeur relue après router.refresh() (ou changée ailleurs) : la case suit la base (ajustement pendant le rendu, sans effet).
  const [recue, setRecue] = useState(sansParole);
  if (recue !== sansParole) {
    setRecue(sansParole);
    setCoche(sansParole);
  }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function basculer(valeur: boolean) {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    setCoche(valeur);
    try {
      const r = await definirExtraitSansParole({ produitId, valeur });
      if (r.statut === "erreur") {
        setCoche(!valeur);
        return setErreur(texteErreur(r.erreur));
      }
      setMessage(t("sansParole.enregistre"));
      router.refresh();
    } catch {
      setCoche(!valeur);
      setErreur(texteErreur("generique"));
    } finally {
      setEnCours(false);
    }
  }

  const idCase = `${base}-sans-parole`;
  return (
    <section aria-labelledby={`${base}-titre`} className="flex max-w-2xl flex-col gap-4">
      <h2 id={`${base}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-body text-text-secondary">{t("intro")}</p>
      <div className="flex flex-col gap-2">
        <div className="flex min-h-touch items-center gap-3">
          <input
            id={idCase}
            type="checkbox"
            checked={coche}
            disabled={enCours}
            onChange={(e) => void basculer(e.target.checked)}
            aria-describedby={`${idCase}-aide`}
            className="size-5"
          />
          <label htmlFor={idCase} className="t-label text-text-primary">
            {t("sansParole.libelle")}
          </label>
        </div>
        <p id={`${idCase}-aide`} className="t-small text-text-secondary">
          {t("sansParole.aide")}
        </p>
        {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
        <div role="status">{message ? <p className="t-small text-text-primary">{message}</p> : null}</div>
      </div>
      {LANGUES_SOUS_TITRES.map((langue) => (
        <SousTitresExtraitLangue key={langue} produitId={produitId} langue={langue} present={langues.includes(langue)} />
      ))}
    </section>
  );
}
