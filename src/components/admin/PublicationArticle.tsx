"use client";

import { Archive, Check, ChevronDown, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FocusEvent, type KeyboardEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { archiverArticleAction, publierArticleAction, restaurerArticleAction, type EtatAction, type EtatArticle } from "@/modules/blog/actions";
import { useClassesChamp } from "./ChampTexte";
import { useEnregistrementFenetre } from "./ui/FenetreFormulaire";

type Statut = "brouillon" | "publie" | "archive";
type Action = "publier" | "depublier" | "restaurer" | "archiver";
type Succes = "publie" | "depublie" | "restaure" | "archive";
type Resultat = { type: Succes } | { type: "erreur"; erreur: string };

const STATUTS: readonly Statut[] = ["brouillon", "publie", "archive"];
const LIBELLE: Record<Statut, "statutBrouillon" | "statutPublie" | "statutArchive"> = {
  brouillon: "statutBrouillon",
  publie: "statutPublie",
  archive: "statutArchive",
};
const SUCCES: Record<Action, Succes> = { publier: "publie", depublier: "depublie", restaurer: "restaure", archiver: "archive" };

// Icône du statut, toujours avec le mot (jamais la couleur ni l'icône seules).
function IconeStatut({ statut }: { statut: Statut }) {
  const Icone = statut === "publie" ? Check : statut === "archive" ? Archive : PencilLine;
  return <Icone aria-hidden="true" className="size-5 shrink-0" />;
}

const CLASSE_BOUTON_MENU =
  "t-body inline-flex min-h-touch w-full items-center justify-between gap-3 rounded-2xl border border-border-field bg-admin-champ px-4 py-2 text-left uppercase text-text-primary";

// Menu STATUT d'un article (story 9.16 h, maquette DA6 et décision Q26), sur le modèle du menu des produits (9.16 f) : Brouillon / Publié / Archivé.
// Chaque choix déclenche l'action existante : Publié → publication (mêmes vérifications en base ; un refus liste ce qui manque et le statut reste
// Brouillon) ; Brouillon → dépublication (ou restauration d'un article archivé) ; Archivé → archivage de la page 5, après la même confirmation.
// « Publié » est indisponible pour un article archivé tant qu'il n'est pas restauré. Le statut affiché vient de la base (router.refresh) ; le succès
// n'apparaît qu'après la réponse réelle du serveur. Menu à bouton, jamais une liste déroulante native : une flèche du clavier ne publie rien.
// Tous les boutons sont de type « button » : le menu peut vivre dans le formulaire de l'article sans jamais le soumettre.
// Une action en cours est signalée à la fenêtre (Échap et × ne quittent pas pendant l'appel). peutPublier (rôle Admin relu côté serveur par la
// page, comme à la page 5) : sinon le statut est affiché en lecture seule, sans action que la base refuserait.
export function PublicationArticle({
  articleId,
  publie,
  archive = false,
  titre = "",
  peutPublier,
}: {
  articleId: string;
  publie: boolean;
  archive?: boolean;
  titre?: string;
  peutPublier: boolean;
}) {
  const t = useTranslations("Admin.blog.publication");
  const ta = useTranslations("Admin.blog.archivage");
  const classes = useClassesChamp();
  const router = useRouter();
  const statut: Statut = archive ? "archive" : publie ? "publie" : "brouillon";
  const [ouvert, setOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const base = useId();
  const idTitre = `${base}-titre`;
  const idListe = `${base}-liste`;
  const idAide = `${base}-aide`;
  const refErreur = useRef<HTMLDivElement>(null);
  useEnregistrementFenetre(enCours);

  // Chaque refus (nouvel objet résultat) met le focus sur son message, annoncé en alerte.
  useEffect(() => {
    if (resultat?.type === "erreur") refErreur.current?.focus();
  }, [resultat]);

  function lancer(action: Action) {
    if (enVol.current) return;
    enVol.current = true;
    setResultat(null);
    demarrer(async () => {
      try {
        const etat: EtatArticle | EtatAction =
          action === "publier" || action === "depublier"
            ? await publierArticleAction({ id: articleId, publier: action === "publier" })
            : action === "restaurer"
              ? await restaurerArticleAction({ id: articleId })
              : await archiverArticleAction({ id: articleId });
        if (etat.statut === "succes") {
          setResultat({ type: SUCCES[action] });
          router.refresh();
        } else {
          setResultat({ type: "erreur", erreur: etat.erreur });
        }
      } catch {
        setResultat({ type: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
        setConfirmation(false);
      }
    });
  }

  function choisir(cible: Statut) {
    setOuvert(false);
    bouton.current?.focus();
    if (cible === statut || enCours) return;
    if (cible === "archive") {
      setConfirmation(true);
      return;
    }
    if (statut === "archive") {
      // « Publié » est indisponible pour un archivé : on le dit, sans appeler le serveur.
      if (cible === "publie") setResultat({ type: "erreur", erreur: "article_archive" });
      else lancer("restaurer");
      return;
    }
    lancer(cible === "publie" ? "publier" : "depublier");
  }

  // Échap referme la liste sans quitter la fenêtre (l'événement est marqué traité) ; le focus revient sur le bouton.
  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || !ouvert) return;
    e.preventDefault();
    setOuvert(false);
    bouton.current?.focus();
  }

  // Le focus quitte le menu : la liste se referme.
  function surSortie(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOuvert(false);
  }

  const erreur = resultat?.type === "erreur" ? resultat : null;
  const messageErreur = erreur ? t(`erreurs.${erreur.erreur in (t.raw("erreurs") as object) ? erreur.erreur : "generique"}`) : null;
  const annonce: Record<Succes, string> = {
    publie: t("publieOk"),
    depublie: t("depublieOk"),
    restaure: t("restaureOk"),
    archive: ta("archiveOk"),
  };

  if (!peutPublier) {
    // Assistant : statut en lecture seule (un texte, sans allure de menu), aucune action.
    return (
      <section aria-labelledby={idTitre} className="flex w-full flex-col items-start gap-3">
        <h2 id={idTitre} className={classes.etiquette}>
          {t("titre")}
        </h2>
        <p className="t-body flex items-center gap-3 uppercase text-text-primary">
          <IconeStatut statut={statut} />
          <span className="sr-only">{t("statutSur")}</span> {t(LIBELLE[statut])}
        </p>
        <p className="t-small text-text-secondary">{t("reserveAdmin")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby={idTitre} className="flex w-full flex-col items-start gap-3">
      <h2 id={idTitre} className={classes.etiquette}>
        {t("titre")}
      </h2>
      <div className="relative w-full" onKeyDown={surTouche} onBlur={surSortie}>
        <button
          ref={bouton}
          type="button"
          aria-expanded={ouvert}
          aria-controls={idListe}
          aria-label={t("statutBouton", { statut: enCours ? t("enCours") : t(LIBELLE[statut]) })}
          aria-describedby={idAide}
          aria-disabled={enCours || undefined}
          onClick={() => {
            if (!enCours) setOuvert((o) => !o);
          }}
          className={CLASSE_BOUTON_MENU}
        >
          <span className="flex items-center gap-3">
            <IconeStatut statut={statut} />
            {enCours ? t("enCours") : t(LIBELLE[statut])}
          </span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform motion-reduce:transition-none ${ouvert ? "rotate-180" : ""}`} />
        </button>
        <ul id={idListe} hidden={!ouvert} className="mt-2 flex w-full flex-col gap-1 rounded-2xl border border-border-field bg-admin-champ p-2">
          {STATUTS.map((s) => {
            const indisponible = statut === "archive" && s === "publie";
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => choisir(s)}
                  // Safari ne donne pas le focus au bouton cliqué : sans cela, la liste se fermerait (perte du focus) avant le clic et le choix serait perdu.
                  onMouseDown={(e) => e.preventDefault()}
                  aria-current={s === statut ? "true" : undefined}
                  // Réellement inactif (pas seulement annoncé) : un article archivé se restaure avant d'être publié.
                  disabled={indisponible}
                  className="t-body flex min-h-touch w-full items-center gap-3 rounded-xl px-3 py-2 text-left uppercase text-text-primary hover:bg-admin-fenetre aria-[current=true]:border-2 aria-[current=true]:border-primary disabled:cursor-not-allowed disabled:text-text-secondary"
                >
                  <IconeStatut statut={s} />
                  {t(LIBELLE[s])}
                  {indisponible ? <span className="t-small normal-case">{t("publieIndisponible")}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p id={idAide} className="t-small text-text-secondary">
        {t(archive ? "aideArchive" : publie ? "aidePublie" : "aideBrouillon")}
      </p>

      {/* Le résultat réel est annoncé en statut ; un refus est annoncé en alerte. */}
      <div role="status">
        {resultat && resultat.type !== "erreur" ? <p className="t-small text-text-primary">{annonce[resultat.type]}</p> : null}
      </div>
      {/* Publication incomplète : la liste des manques seule (une seule alerte) ; tout autre refus : son message. Le focus y est mis à chaque refus. */}
      <div ref={refErreur} tabIndex={-1} className="w-full outline-none">
        {messageErreur && erreur?.erreur !== "publication_incomplete" ? <MessageEtat type="erreur">{messageErreur}</MessageEtat> : null}
        {erreur?.erreur === "publication_incomplete" ? (
          <div role="alert" className="t-small flex w-full flex-col gap-2 rounded-2xl border border-border p-4 text-text-primary">
            <p>{t("incomplet")}</p>
            <ul className="list-disc pl-5">
              <li>{t("manques.titre_fr")}</li>
              <li>{t("manques.texte_fr")}</li>
              <li>{t("manques.alt")}</li>
            </ul>
          </div>
        ) : null}
      </div>

      <Dialogue
        ouvert={confirmation}
        onFermer={() => {
          if (!enVol.current) setConfirmation(false);
        }}
        titre={ta("titre", { titre })}
        retourFocus={bouton}
      >
        <p className="t-body">{ta("texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={enCours} onClick={() => setConfirmation(false)}>
            {ta("annuler")}
          </button>
          <Bouton enCours={enCours} onClick={() => lancer("archiver")}>
            {enCours ? ta("enCours") : ta("confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </section>
  );
}

// Statut d'un article pas encore enregistré (création) : il naîtra brouillon ; le menu n'apparaît qu'après le premier enregistrement.
export function StatutCreationArticle() {
  const t = useTranslations("Admin.blog.publication");
  const classes = useClassesChamp();
  const base = useId();
  return (
    <section aria-labelledby={`${base}-titre`} className="flex w-full flex-col items-start gap-3">
      <h2 id={`${base}-titre`} className={classes.etiquette}>
        {t("titre")}
      </h2>
      {/* Valeur en lecture seule : un texte, sans allure de menu ni de champ. */}
      <p className="t-body flex items-center gap-3 uppercase text-text-primary">
        <IconeStatut statut="brouillon" />
        <span className="sr-only">{t("statutSur")}</span> {t("statutBrouillon")}
      </p>
      <p className="t-small text-text-secondary">{t("aideCreation")}</p>
    </section>
  );
}
