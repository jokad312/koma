"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";

type Props = { fichierId: string; nom: string; format: string; taille: string };
type Etat = "repos" | "preparation" | "echec" | "refuse" | "connexion";

// Chaque clic demande un nouveau lien de 60 secondes au serveur, qui vérifie l'accès (règle 1) ; le navigateur le suit aussitôt.
// « Préparation du lien… » est annoncé dans une région d'état ; une erreur est annoncée en alerte.
export function BoutonTelecharger({ fichierId, nom, format, taille }: Props) {
  const t = useTranslations("Bibliotheque.telechargement");
  const [etat, setEtat] = useState<Etat>("repos");
  const enCours = useRef(false);

  async function telecharger() {
    if (enCours.current) return;
    enCours.current = true;
    setEtat("preparation");
    try {
      const reponse = await fetch(`/api/kits/fichier/${encodeURIComponent(fichierId)}`, { cache: "no-store", credentials: "same-origin" });
      if (reponse.status === 401) return setEtat("connexion");
      if (reponse.status === 403) return setEtat("refuse");
      const corps = (await reponse.json().catch(() => null)) as { url?: unknown } | null;
      if (!reponse.ok || typeof corps?.url !== "string") return setEtat("echec");
      setEtat("repos");
      window.location.assign(corps.url);
    } catch {
      setEtat("echec");
    } finally {
      enCours.current = false;
    }
  }

  const erreur = etat === "echec" || etat === "refuse" || etat === "connexion" ? t(etat) : null;
  return (
    <div className="flex flex-col items-start gap-2">
      <Bouton variante="secondaire" onClick={telecharger} enCours={etat === "preparation"}>
        {etat === "preparation" ? t("preparation") : t("bouton", { nom, format, taille })}
      </Bouton>
      <p role="status" aria-live="polite" className="sr-only">
        {etat === "preparation" ? t("preparation") : ""}
      </p>
      {erreur ? (
        <p role="alert" className="t-small text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
