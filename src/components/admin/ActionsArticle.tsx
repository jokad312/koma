"use client";

import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { Link, useRouter } from "@/i18n/navigation";
import { archiverArticleAction, publierArticleAction, restaurerArticleAction } from "@/modules/blog/actions";

export type FinAction = "archive" | "restaure" | "publie" | "depublie";

const ERREURS_CONNUES = ["article_introuvable", "non_autorise", "publication_incomplete", "article_archive"];

// Actions d'une carte d'article (story 9.16 g, CB10) : cercle barré (Dépublier, article publié), Publier (brouillon), corbeille (Archiver, Q22 :
// jamais de suppression, confirmation d'abord) ou Restaurer (archivé, retour en brouillon, sans confirmation : l'action ne perd rien).
// Chaque icône a un nom accessible. Les droits et la complétude sont revérifiés par le serveur et la base ; l'état affiché vient de la base
// (router.refresh), jamais d'une supposition locale.
export function ActionsArticle({
  articleId,
  titre,
  publie,
  archive,
  onCommence,
  onTermine,
}: {
  articleId: string;
  titre: string;
  publie: boolean;
  archive: boolean;
  onCommence?: () => void;
  onTermine?: (action: FinAction) => void;
}) {
  const t = useTranslations("Admin.blog.archivage");
  const tg = useTranslations("Admin.blog.grille");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [actionEnCours, setActionEnCours] = useState<FinAction | null>(null);
  const enVol = useRef(false);
  const corbeille = useRef<HTMLButtonElement>(null);

  function lancer(action: FinAction) {
    if (enVol.current) return;
    enVol.current = true;
    setErreur(null);
    onCommence?.();
    setActionEnCours(action);
    demarrer(async () => {
      try {
        const etat =
          action === "archive"
            ? await archiverArticleAction({ id: articleId })
            : action === "restaure"
              ? await restaurerArticleAction({ id: articleId })
              : await publierArticleAction({ id: articleId, publier: action === "publie" });
        setOuvert(false);
        if (etat.statut === "succes") {
          onTermine?.(action);
          router.refresh();
        } else {
          setErreur(ERREURS_CONNUES.includes(etat.erreur) ? etat.erreur : "generique");
        }
      } catch {
        setOuvert(false);
        setErreur("generique");
      } finally {
        enVol.current = false;
        setActionEnCours(null);
      }
    });
  }

  const message = erreur ? (
    <div role="alert" className="t-small w-full text-text-primary">
      <p>{t(`erreurs.${erreur}`)}</p>
      {erreur === "publication_incomplete" ? (
        <Link href={`/admin/blog/${articleId}`} className="inline-flex min-h-touch items-center underline">
          {tg("completer", { titre })}
        </Link>
      ) : null}
    </div>
  ) : null;

  const icone = "inline-flex size-touch shrink-0 items-center justify-center rounded-full hover:bg-admin-champ disabled:text-text-secondary";

  if (archive) {
    return (
      <>
        <Bouton variante="secondaire" onClick={() => lancer("restaure")} enCours={enCours} aria-label={t("restaurerSur", { titre })} className="ml-auto">
          {enCours ? null : <RotateCcw aria-hidden="true" className="size-5" />}
          {enCours ? t("enCours") : t("restaurer")}
        </Bouton>
        {message}
      </>
    );
  }

  return (
    <>
      {publie ? (
        <button
          type="button"
          onClick={() => lancer("depublie")}
          disabled={enCours}
          aria-label={tg("depublierSur", { titre })}
          className={`${icone} text-text-secondary`}
        >
          <Ban aria-hidden="true" className="size-7" />
        </button>
      ) : null}
      <button
        ref={corbeille}
        type="button"
        onClick={() => setOuvert(true)}
        disabled={enCours}
        aria-label={t("archiverSur", { titre })}
        className={`${icone} text-primary`}
      >
        <Trash2 aria-hidden="true" className="size-7" />
      </button>
      {/* Bloqué (clic ignoré, aria-disabled) pendant toute action de la carte, pas seulement la publication. */}
      {publie ? null : (
        <Bouton onClick={() => lancer("publie")} enCours={enCours} aria-label={tg("publierSur", { titre })} className="ml-auto">
          {enCours && actionEnCours === "publie" ? t("enCours") : tg("publier")}
        </Bouton>
      )}
      {message}
      <Dialogue
        ouvert={ouvert}
        onFermer={() => {
          if (!enVol.current) setOuvert(false);
        }}
        titre={t("titre", { titre })}
        retourFocus={corbeille}
      >
        <p className="t-body">{t("texte")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={CLASSES_SECONDAIRE} disabled={enCours} onClick={() => setOuvert(false)}>
            {t("annuler")}
          </button>
          <Bouton enCours={enCours} onClick={() => lancer("archive")}>
            {enCours ? t("enCours") : t("confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </>
  );
}
