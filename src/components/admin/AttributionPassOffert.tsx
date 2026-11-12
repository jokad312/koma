"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { attribuerPassOffertAction } from "@/modules/communaute/pass-offert-actions";
import type { ErreurPassOffert, OptionsPassOffert } from "@/modules/communaute/pass-offert";

// Attribution d'un Pass offert à l'auteur d'une Réalisation validée (story 8.5, Admin seulement). On choisit l'Événement à venir (avec de la place)
// et son Type de pass Standard ; la réponse du serveur est annoncée seulement une fois reçue.
export function AttributionPassOffert({ photoId, options }: { photoId: string; options: OptionsPassOffert }) {
  const t = useTranslations("Admin.galerie.passOffert");
  const locale = useLocale() === "en" ? "en" : "fr";
  const router = useRouter();
  const id = useId();
  const [choix, setChoix] = useState("");
  const [retour, setRetour] = useState<{ type: "ok"; rang: number } | { type: "erreur"; erreur: ErreurPassOffert } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const enVol = useRef(false);

  const deja = options.attributions.find((a) => a.photoId === photoId);
  if (deja) {
    return (
      <p className="t-small text-text-primary">
        {t("deja", { rang: deja.rang, evenement: locale === "en" && deja.titreEn ? deja.titreEn : deja.titreFr })}
      </p>
    );
  }

  const propositions = options.evenements.flatMap((e) =>
    e.types.map((ty) => ({
      valeur: ty.id,
      libelle: t("option", {
        evenement: locale === "en" && e.titreEn ? e.titreEn : e.titreFr,
        type: locale === "en" && ty.nomEn ? ty.nomEn : ty.nomFr,
        attribues: e.attribues,
      }),
    })),
  );

  async function attribuer() {
    if (enVol.current || choix === "") return;
    enVol.current = true;
    setEnCours(true);
    setRetour(null);
    try {
      const r = await attribuerPassOffertAction({ photoId, typePassId: choix });
      if (r.ok) {
        setRetour({ type: "ok", rang: r.rang });
        router.refresh();
      } else {
        setRetour({ type: "erreur", erreur: r.erreur });
      }
    } catch {
      setRetour({ type: "erreur", erreur: "generique" });
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="t-label text-text-primary">{t("titre")}</p>
      {propositions.length === 0 ? (
        <p className="t-small text-text-secondary">{t("aucun")}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void attribuer();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor={`${id}-choix`} className="t-small text-text-secondary">
            {t("choisir")}
          </label>
          <select
            id={`${id}-choix`}
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            className="min-h-touch rounded-md border border-border-field bg-surface px-3 text-text-primary"
          >
            <option value="">{t("placeholder")}</option>
            {propositions.map((p) => (
              <option key={p.valeur} value={p.valeur}>
                {p.libelle}
              </option>
            ))}
          </select>
          <div>
            <Bouton type="submit" variante="secondaire" enCours={enCours} aria-disabled={choix === "" || undefined}>
              {t("attribuer")}
            </Bouton>
          </div>
        </form>
      )}
      <div>
        {retour?.type === "ok" ? <MessageEtat type="succes">{t("succes", { rang: retour.rang })}</MessageEtat> : null}
        {retour?.type === "erreur" ? <MessageEtat type="erreur">{t(`erreurs.${retour.erreur}`)}</MessageEtat> : null}
      </div>
    </div>
  );
}
