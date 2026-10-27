"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { choisirVedette } from "@/modules/accueil/heros-actions";
import { CLASSE_CHAMP } from "../ChampTexte";

// Choix du Cosplay vedette parmi les cosplays publiés. Le succès n'est affiché qu'après la réponse réelle de la base.
export function VedetteHeros({ cosplays, courant }: { cosplays: Array<{ id: string; titre: string }>; courant: string | null }) {
  const t = useTranslations("Admin.reglages.heros");
  const router = useRouter();
  const id = useId();
  const [choix, setChoix] = useState(courant ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const enVol = useRef(false);

  async function surEnvoi(e: FormEvent) {
    e.preventDefault();
    if (enVol.current) return;
    enVol.current = true;
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await choisirVedette({ produitId: choix === "" ? null : choix });
      if (r.statut === "erreur") {
        setErreur(t.has(`erreurs.${r.erreur}`) ? t(`erreurs.${r.erreur}`) : t("erreurs.generique"));
        return;
      }
      setMessage(choix === "" ? t("vedette.retiree") : t("vedette.succes"));
      router.refresh();
    } catch {
      setErreur(t("erreurs.generique"));
    } finally {
      enVol.current = false;
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={surEnvoi} noValidate className="flex max-w-2xl flex-col gap-3">
      <h3 className="t-h3">{t("vedette.titre")}</h3>
      <label htmlFor={id} className="t-label text-text-primary">
        {t("vedette.libelle")}
      </label>
      <p id={`${id}-aide`} className="t-small text-text-secondary">
        {cosplays.length === 0 ? t("vedette.aucunPublie") : t("vedette.aide")}
      </p>
      <select id={id} name="vedette" value={choix} onChange={(e) => setChoix(e.target.value)} aria-describedby={`${id}-aide`} className={CLASSE_CHAMP}>
        <option value="">{t("vedette.aucune")}</option>
        {cosplays.map((c) => (
          <option key={c.id} value={c.id}>
            {c.titre}
          </option>
        ))}
      </select>
      {erreur ? <MessageEtat type="erreur">{erreur}</MessageEtat> : null}
      <div role="status" className="t-small text-text-primary">
        {message}
      </div>
      <div>
        <Bouton type="submit" enCours={enCours}>
          {t("vedette.enregistrer")}
        </Bouton>
      </div>
    </form>
  );
}
