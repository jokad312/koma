"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { enregistrerGalerieEvenementAction } from "@/modules/evenements/galerie-actions";
import type { ErreurGalerie } from "@/modules/evenements/galerie";

// Section « Galerie d'événement » de la page d'un Événement (story 7.10, FR-39) : le lien public Google Drive ou Google Photos. Un champ vide efface le lien.
// Le succès n'apparaît qu'après la réponse réelle du serveur ; l'erreur est reliée au champ.
export function SectionGalerie({ evenementId, lien }: { evenementId: string; lien: string | null }) {
  const t = useTranslations("Admin.evenements.galerie");
  const router = useRouter();
  const id = useId();
  const [valeur, setValeur] = useState(lien ?? "");
  const [retour, setRetour] = useState<{ type: "ok"; vide: boolean } | { type: "erreur"; erreur: ErreurGalerie } | null>(null);
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    setRetour(null);
    demarrer(async () => {
      try {
        const r = await enregistrerGalerieEvenementAction({ evenementId, lien: valeur });
        if (r.ok) {
          setRetour({ type: "ok", vide: r.lien === null });
          setValeur(r.lien ?? "");
          router.refresh();
        } else {
          setRetour({ type: "erreur", erreur: r.erreur });
        }
      } catch {
        setRetour({ type: "erreur", erreur: "generique" });
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id={`${id}-titre`} className="t-h3">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`${id}-lien`} className="t-label text-text-primary">
          {t("lien")}
        </label>
        <input
          id={`${id}-lien`}
          type="url"
          inputMode="url"
          maxLength={600}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          aria-describedby={`${id}-aide`}
          {...(retour?.type === "erreur" && retour.erreur === "lien_invalide" ? { "aria-invalid": true } : {})}
          className="min-h-touch rounded-md border border-border-field bg-surface px-3"
        />
        <p id={`${id}-aide`} className="t-small text-text-secondary">
          {t("format")}
        </p>
        <div>
          <Bouton type="submit" enCours={enCours}>
            {t("enregistrer")}
          </Bouton>
        </div>
      </form>
      {retour?.type === "ok" ? <MessageEtat type="succes">{retour.vide ? t("efface") : t("enregistre")}</MessageEtat> : null}
      {retour?.type === "erreur" ? <MessageEtat type="erreur">{t(`erreurs.${retour.erreur}`)}</MessageEtat> : null}
    </section>
  );
}
