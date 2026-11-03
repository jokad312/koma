"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { ErreurReclamation } from "@/modules/commande/reclamation";
import { signalerProblemeAction } from "@/modules/commande/reclamation-actions";

// « Signaler un problème » (story 6.7) : proposé seulement pour une Commande livrée depuis moins de 48 h (calcul en base). Le champ « Décris le problème »
// est obligatoire ; aucune photo n'est demandée : un lien WhatsApp permet d'en envoyer. Aucun remboursement n'est proposé (FR-26).
export function SignalerProbleme({ numero, lignes, lienWhatsapp }: { numero: string; lignes: { id: string; titre: string }[]; lienWhatsapp: string | null }) {
  const t = useTranslations("Commande.reclamation");
  const id = useId();
  const router = useRouter();
  const [ligneId, setLigneId] = useState(lignes[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState<ErreurReclamation | null>(null);
  const [enCours, lancer] = useTransition();

  function envoyer() {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await signalerProblemeAction({ numero, ligneId, description });
        if (r.ok) router.refresh();
        else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id={`${id}-titre`} className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("intro")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (description.trim() !== "") envoyer();
          else setErreur("description_requise");
        }}
        className="flex flex-col gap-3"
      >
        {lignes.length > 1 ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="t-small text-text-primary">{t("ligne")}</legend>
            {lignes.map((l) => (
              <label key={l.id} className="flex min-h-touch items-center gap-2 t-body text-text-primary">
                <input type="radio" name={`${id}-ligne`} value={l.id} checked={ligneId === l.id} onChange={() => setLigneId(l.id)} />
                {l.titre}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-description`} className="t-small text-text-primary">
            {t("description")}
          </label>
          <textarea
            id={`${id}-description`}
            value={description}
            maxLength={2000}
            rows={4}
            onChange={(e) => setDescription(e.target.value)}
            required
            {...(erreur === "description_requise" ? { "aria-invalid": true, "aria-describedby": `${id}-erreur` } : {})}
            className="rounded-md border border-border-field bg-surface px-3 py-2"
          />
          {erreur === "description_requise" ? (
            <p id={`${id}-erreur`} role="alert" className="t-small text-danger">
              {t("erreurs.description_requise")}
            </p>
          ) : null}
        </div>
        {erreur && erreur !== "description_requise" ? <MessageEtat type="erreur">{t(`erreurs.${erreur}`)}</MessageEtat> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="submit" enCours={enCours}>
            {t("envoyer")}
          </Bouton>
          {lienWhatsapp ? (
            <a href={lienWhatsapp} target="_blank" rel="noopener noreferrer" className={CLASSES_SECONDAIRE}>
              {t("photos")}
              <span className="sr-only">{t("nouvelOnglet")}</span>
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
