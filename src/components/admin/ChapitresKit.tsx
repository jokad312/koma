"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { ajouterChapitreKit, deplacerChapitreKit, modifierChapitreKit, supprimerChapitreKit } from "@/modules/catalogue/actions";
import { formaterInstant, lireInstant } from "@/modules/catalogue/sous-titres";
import { CHAPITRES_MAX } from "@/modules/catalogue/types";
import type { ChampChapitre, ChapitreAdmin } from "@/modules/catalogue/types";
import { ChampTexte } from "./ChampTexte";

const BOUTON =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface px-3 text-text-primary aria-disabled:cursor-not-allowed aria-disabled:text-text-secondary";

function Fleche({ haut }: { haut: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d={haut ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} />
    </svg>
  );
}

type ErreurChapitre = { code: string; champ: ChampChapitre | null };

// Ajout (chapitre absent) ou modification d'un chapitre : titres FR et EN, instant « mm:ss » ou « h:mm:ss ». Erreurs sous le champ concerné,
// saisie conservée après un échec, succès annoncé seulement après la réponse réelle de la base.
function FormulaireChapitre({
  produitId,
  dureeSecondes,
  chapitre,
  numero,
  onSucces,
  onFermer,
}: {
  produitId: string;
  dureeSecondes: number;
  chapitre?: ChapitreAdmin;
  numero?: number;
  onSucces: (message: string) => void;
  onFermer?: () => void;
}) {
  const t = useTranslations("Admin.kits.chapitres");
  const router = useRouter();
  const base = useId();
  const [titreFr, setTitreFr] = useState(chapitre?.titreFr ?? "");
  const [titreEn, setTitreEn] = useState(chapitre?.titreEn ?? "");
  const [debut, setDebut] = useState(chapitre ? formaterInstant(chapitre.debutSecondes) : "");
  const [erreur, setErreur] = useState<ErreurChapitre | null>(null);
  const [enCours, setEnCours] = useState(false);
  const enVol = useRef(false);

  const duree = formaterInstant(dureeSecondes);
  const texte = (code: string) => t(`erreurs.${t.has(`erreurs.${code}`) ? code : "generique"}`, { duree, max: CHAPITRES_MAX });
  const erreurDe = (champ: ChampChapitre) => (erreur && erreur.champ === champ ? texte(erreur.code) : null);
  const erreurGenerale = erreur && erreur.champ === null ? texte(erreur.code) : null;

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    setErreur(null);
    // Contrôles avant l'envoi (la base revérifie).
    if (titreFr.trim() === "" || titreFr.trim().length > 120) return setErreur({ code: "titre_invalide", champ: "titre_fr" });
    if (titreEn.trim() === "" || titreEn.trim().length > 120) return setErreur({ code: "titre_invalide", champ: "titre_en" });
    const secondes = lireInstant(debut);
    if (secondes === null) return setErreur({ code: "instant_invalide", champ: "debut" });
    if (secondes >= dureeSecondes) return setErreur({ code: "chapitre_invalide", champ: "debut" });
    enVol.current = true;
    setEnCours(true);
    try {
      const r = chapitre
        ? await modifierChapitreKit({ chapitreId: chapitre.id, titreFr, titreEn, debut })
        : await ajouterChapitreKit({ produitId, titreFr, titreEn, debut });
      if (r.statut === "erreur") {
        // Titre refusé par le serveur alors que le client l'a validé : le champ fautif est inconnu, le message va au formulaire.
        setErreur({ code: r.erreur, champ: r.champ ?? null });
        return;
      }
      if (!chapitre) {
        setTitreFr("");
        setTitreEn("");
        setDebut("");
      }
      onSucces(t(chapitre ? "modifie" : "ajoute"));
      router.refresh();
    } catch {
      setErreur({ code: "generique", champ: null });
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={surEnvoi} noValidate aria-labelledby={`${base}-titre`} className="flex basis-full flex-col gap-3">
      <h3 id={`${base}-titre`} className="t-label">
        {chapitre ? t("formulaire.modificationTitre", { numero: numero ?? 0 }) : t("formulaire.ajoutTitre")}
      </h3>
      {erreurGenerale ? <MessageEtat type="erreur">{erreurGenerale}</MessageEtat> : null}
      <ChampTexte id={`${base}-fr`} name="titre_fr" libelle={t("formulaire.titreFr")} aide={t("formulaire.titreAide")} valeur={titreFr} onChange={setTitreFr} erreur={erreurDe("titre_fr")} />
      <ChampTexte id={`${base}-en`} name="titre_en" libelle={t("formulaire.titreEn")} aide={t("formulaire.titreAide")} valeur={titreEn} onChange={setTitreEn} erreur={erreurDe("titre_en")} />
      <ChampTexte
        id={`${base}-debut`}
        name="debut"
        libelle={t("formulaire.debut")}
        aide={t("formulaire.debutAide", { duree })}
        valeur={debut}
        onChange={setDebut}
        erreur={erreurDe("debut")}
        inputMode="numeric"
      />
      <div className="flex flex-wrap gap-3">
        <Bouton type="submit" variante={chapitre ? "secondaire" : "principal"} enCours={enCours}>
          {enCours ? t("formulaire.enCours") : t(chapitre ? "formulaire.enregistrer" : "formulaire.ajouter")}
        </Bouton>
        {onFermer ? (
          <Bouton variante="secondaire" onClick={onFermer}>
            {t("formulaire.fermer")}
          </Bouton>
        ) : null}
      </div>
    </form>
  );
}

// Chapitres d'un Kit : liste ordonnée (instant, titres), Monter / Descendre (44 px, nom complet, aria-disabled en bout de liste), Modifier,
// Supprimer (avec confirmation), formulaire d'ajout. Sans vidéo complète prête, aucun chapitre ne peut être ajouté (la base refuse aussi).
export function ChapitresKit({ produitId, chapitres, dureeSecondes }: { produitId: string; chapitres: readonly ChapitreAdmin[]; dureeSecondes: number | null }) {
  const t = useTranslations("Admin.kits.chapitres");
  const locale = useLocale();
  const router = useRouter();
  const base = useId();
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<ChapitreAdmin | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const enVol = useRef(false);

  const titreDe = (c: ChapitreAdmin) => (locale === "en" ? c.titreEn : c.titreFr);
  const messageErreur = (code: string) =>
    t(`erreurs.${t.has(`erreurs.${code}`) ? code : "generique"}`, { duree: formaterInstant(dureeSecondes ?? 0), max: CHAPITRES_MAX });

  async function deplacer(c: ChapitreAdmin, rang: number, sens: "haut" | "bas") {
    if (enVol.current) return;
    enVol.current = true;
    setAnnonce(null);
    setErreur(null);
    try {
      const r = await deplacerChapitreKit({ chapitreId: c.id, sens });
      if (r.statut === "erreur") return setErreur(messageErreur(r.erreur));
      setAnnonce(t("deplace", { numero: rang + (sens === "haut" ? -1 : 1) }));
      router.refresh();
    } catch {
      setErreur(messageErreur("generique"));
    } finally {
      enVol.current = false;
    }
  }

  async function confirmerSuppression() {
    const c = aSupprimer;
    if (!c || enVol.current) return;
    enVol.current = true;
    setSuppressionEnCours(true);
    setAnnonce(null);
    setErreur(null);
    try {
      const r = await supprimerChapitreKit({ chapitreId: c.id });
      if (r.statut === "erreur") return setErreur(messageErreur(r.erreur));
      setAnnonce(t("supprime"));
      router.refresh();
    } catch {
      setErreur(messageErreur("generique"));
    } finally {
      enVol.current = false;
      setSuppressionEnCours(false);
      setASupprimer(null);
    }
  }

  return (
    <section aria-labelledby={`${base}-titre`} className="flex max-w-2xl flex-col gap-4">
      <h2 id={`${base}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-body text-text-secondary">{t("intro", { max: CHAPITRES_MAX })}</p>
      {dureeSecondes === null ? <p className="t-body text-text-secondary">{t("sansVideo")}</p> : null}
      <p className="t-small text-text-secondary">{t("nombre", { nombre: chapitres.length })}</p>
      {chapitres.length === 0 ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
      {chapitres.length > 0 ? (
        <ol aria-label={t("legende")} className="flex flex-col gap-3">
          {chapitres.map((c, i) => {
            const numero = i + 1;
            const premier = i === 0;
            const dernier = i === chapitres.length - 1;
            const titre = titreDe(c);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="t-label break-words">{t("ligne", { numero, debut: formaterInstant(c.debutSecondes), titre })}</p>
                  <p className="t-small break-words text-text-secondary">{locale === "en" ? t("titreFrLigne", { titre: c.titreFr }) : t("titreEnLigne", { titre: c.titreEn })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BOUTON}
                    aria-disabled={premier || undefined}
                    aria-label={t("monter", { numero, titre })}
                    onClick={premier ? undefined : () => deplacer(c, numero, "haut")}
                  >
                    <Fleche haut />
                  </button>
                  <button
                    type="button"
                    className={BOUTON}
                    aria-disabled={dernier || undefined}
                    aria-label={t("descendre", { numero, titre })}
                    onClick={dernier ? undefined : () => deplacer(c, numero, "bas")}
                  >
                    <Fleche haut={false} />
                  </button>
                  {dureeSecondes !== null ? (
                    <button type="button" className={BOUTON} aria-expanded={edition === c.id} onClick={() => setEdition(edition === c.id ? null : c.id)}>
                      {t("modifier", { numero })}
                    </button>
                  ) : null}
                  <button type="button" className={`${BOUTON} text-danger`} onClick={() => setASupprimer(c)}>
                    {t("supprimer", { numero })}
                  </button>
                </div>
                {edition === c.id && dureeSecondes !== null ? (
                  <div className="basis-full border-t border-border pt-3">
                    <FormulaireChapitre
                      key={`${c.id}-${c.titreFr}-${c.titreEn}-${c.debutSecondes}`}
                      produitId={produitId}
                      dureeSecondes={dureeSecondes}
                      chapitre={c}
                      numero={numero}
                      onSucces={(m) => {
                        setEdition(null);
                        setErreur(null);
                        setAnnonce(m);
                      }}
                      onFermer={() => setEdition(null)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      <div role="status" className="t-small text-text-primary">
        {annonce}
      </div>
      {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
      {dureeSecondes !== null && chapitres.length < CHAPITRES_MAX ? (
        <FormulaireChapitre
          produitId={produitId}
          dureeSecondes={dureeSecondes}
          onSucces={(m) => {
            setErreur(null);
            setAnnonce(m);
          }}
        />
      ) : null}
      {chapitres.length >= CHAPITRES_MAX ? <p className="t-small text-text-secondary">{t("limite", { max: CHAPITRES_MAX })}</p> : null}
      <Dialogue
        ouvert={aSupprimer !== null}
        onFermer={() => {
          if (!enVol.current) setASupprimer(null);
        }}
        titre={aSupprimer ? t("suppression.titre", { numero: chapitres.findIndex((c) => c.id === aSupprimer.id) + 1 }) : ""}
      >
        <p className="t-body">{t("suppression.texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={suppressionEnCours} onClick={() => setASupprimer(null)}>
            {t("suppression.annuler")}
          </button>
          <Bouton enCours={suppressionEnCours} onClick={confirmerSuppression}>
            {suppressionEnCours ? t("suppression.enCours") : t("suppression.confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </section>
  );
}
