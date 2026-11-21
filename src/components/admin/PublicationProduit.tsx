"use client";

import { Archive, Check, ChevronDown, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type FocusEvent, type KeyboardEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { archiverProduit, depublierProduit, publierProduit, restaurerProduit, type EtatPhoto } from "@/modules/catalogue/actions";
import type { ManquePublication } from "@/modules/catalogue/types";
import { useClassesChamp } from "./ChampTexte";
import { AlerteCommandesEnCours } from "./AlerteCommandesEnCours";

type Statut = "brouillon" | "publie" | "archive";
type Action = "publier" | "depublier" | "restaurer" | "archiver";
type Succes = "publie" | "depublie" | "restaure" | "archive";
type Resultat = { type: Succes } | { type: "erreur"; erreur: string; manques?: ManquePublication[] };

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

// Menu STATUT d'un produit (story 9.16 f, maquette D14 et décision Q26) : Brouillon / Publié / Archivé. Chaque choix déclenche l'action existante :
// Publié → publication (même vérification des champs obligatoires côté serveur ; un refus liste ce qui manque et le statut reste Brouillon) ;
// Brouillon → dépublication (ou restauration d'un produit archivé) ; Archivé → archivage de la page 3, après confirmation. Un produit archivé ne peut
// pas être publié : « Publié » est indisponible tant qu'il n'est pas restauré. Le statut affiché vient toujours de la base (router.refresh), jamais d'une
// supposition locale ; le succès n'apparaît qu'après la réponse réelle du serveur. Menu à bouton (liste de choix qui s'ouvre et se referme), jamais une
// liste déroulante native : une flèche du clavier n'y déclenche aucune action.
export function PublicationProduit({ produitId, publie, archive = false, titre = "" }: { produitId: string; publie: boolean; archive?: boolean; titre?: string }) {
  const t = useTranslations("Admin.produits.publication");
  const ta = useTranslations("Admin.produits.archivage");
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

  function lancer(action: Action) {
    if (enVol.current) return;
    enVol.current = true;
    setResultat(null);
    demarrer(async () => {
      try {
        const appel = { id: produitId };
        const etat: EtatPhoto =
          action === "publier"
            ? await publierProduit(appel)
            : action === "depublier"
              ? await depublierProduit(appel)
              : action === "restaurer"
                ? await restaurerProduit(appel)
                : await archiverProduit(appel);
        if (etat.statut === "succes") {
          setResultat({ type: SUCCES[action] });
          router.refresh();
        } else {
          setResultat({ type: "erreur", erreur: etat.erreur, manques: etat.manques });
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
      if (cible === "publie") setResultat({ type: "erreur", erreur: "produit_archive" });
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
  const liste = erreur?.erreur === "publication_incomplete" && erreur.manques && erreur.manques.length > 0 ? erreur.manques : null;
  const annonce: Record<Succes, string> = {
    publie: t("publieOk"),
    depublie: t("depublieOk"),
    restaure: t("restaureOk"),
    archive: ta("archiveOk"),
  };

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
                  aria-disabled={indisponible || undefined}
                  className="t-body flex min-h-touch w-full items-center gap-3 rounded-xl px-3 py-2 text-left uppercase text-text-primary hover:bg-admin-fenetre aria-[current=true]:border-2 aria-[current=true]:border-primary aria-disabled:text-text-secondary"
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
      {liste ? (
        <div role="alert" className="t-small flex w-full flex-col gap-2 rounded-2xl border border-border p-4 text-text-primary">
          <p>{t("incomplet")}</p>
          <ul className="list-disc pl-5">
            {liste.map((m) => (
              <li key={m}>{t(`manques.${m}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {erreur && !liste ? (
        <MessageEtat type="erreur">{t(`erreurs.${erreur.erreur === "publication_incomplete" ? "publication_incomplete" : erreurConnue(erreur.erreur)}`)}</MessageEtat>
      ) : null}

      <Dialogue
        ouvert={confirmation}
        onFermer={() => {
          if (!enVol.current) setConfirmation(false);
        }}
        titre={ta("titre", { titre })}
        retourFocus={bouton}
      >
        <p className="t-body">{ta("texte")}</p>
        <div className="mt-4">
          <AlerteCommandesEnCours produitId={produitId} ouvert={confirmation} />
        </div>
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

// Statut d'un produit pas encore enregistré (création) : il naîtra brouillon ; le menu n'apparaît qu'après le premier enregistrement.
export function StatutCreation() {
  const t = useTranslations("Admin.produits.publication");
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

function erreurConnue(code: string): string {
  return ["publication_incomplete", "produit_publie_verrouille", "produit_archive", "produit_introuvable", "non_autorise"].includes(code) ? code : "generique";
}
