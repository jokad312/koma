"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Dialogue } from "@/components/ui/Dialogue";
import { useRouter } from "@/i18n/navigation";
import { archiverProduit, restaurerProduit } from "@/modules/catalogue/actions";

const ERREURS_CONNUES = ["produit_introuvable", "non_autorise"];

// Corbeille d'une carte de produit (story 9.16 e, décision Q22) : elle ARCHIVE, jamais ne supprime. Confirmation avant l'action ; le produit est
// dépublié et marqué archivé par la base (droit revérifié, journal d'audit). Un produit archivé montre « Restaurer » (retour en brouillon) à la place.
// L'état affiché vient de la base (router.refresh), jamais d'une supposition locale. Après un succès réel, onTermine prévient la liste (annonce et
// focus sur un élément stable : la carte disparaît de la vue).
export function ArchivageProduit({
  produitId,
  titre,
  archive,
  onTermine,
}: {
  produitId: string;
  titre: string;
  archive: boolean;
  onTermine?: (action: "archive" | "restaure") => void;
}) {
  const t = useTranslations("Admin.produits.archivage");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const corbeille = useRef<HTMLButtonElement>(null);

  function lancer(archiver: boolean) {
    if (enVol.current) return;
    enVol.current = true;
    setErreur(null);
    demarrer(async () => {
      try {
        const etat = archiver ? await archiverProduit({ id: produitId }) : await restaurerProduit({ id: produitId });
        if (etat.statut === "succes") {
          setOuvert(false);
          onTermine?.(archiver ? "archive" : "restaure");
          router.refresh();
        } else {
          setOuvert(false);
          setErreur(ERREURS_CONNUES.includes(etat.erreur) ? etat.erreur : "generique");
        }
      } catch {
        setOuvert(false);
        setErreur("generique");
      } finally {
        enVol.current = false;
      }
    });
  }

  const message = erreur ? (
    <p role="alert" className="t-small w-full text-text-primary">
      {t(`erreurs.${erreur}`)}
    </p>
  ) : null;

  if (archive) {
    return (
      <>
        <Bouton variante="secondaire" onClick={() => lancer(false)} enCours={enCours} aria-label={t("restaurerSur", { titre })}>
          {enCours ? null : <RotateCcw aria-hidden="true" className="size-5" />}
          {enCours ? t("enCours") : t("restaurer")}
        </Bouton>
        {message}
      </>
    );
  }

  return (
    <>
      <button
        ref={corbeille}
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={t("archiverSur", { titre })}
        className="inline-flex size-touch shrink-0 items-center justify-center rounded-full text-primary hover:bg-admin-champ"
      >
        <Trash2 aria-hidden="true" className="size-7" />
      </button>
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
          <Bouton enCours={enCours} onClick={() => lancer(true)}>
            {enCours ? t("enCours") : t("confirmer")}
          </Bouton>
        </div>
      </Dialogue>
    </>
  );
}
