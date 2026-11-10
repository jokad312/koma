"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { mesurer } from "@/modules/mesure/client";

type Props = { titre: string; url: string };

// Partage natif (navigator.share) ou, à défaut, copie du lien. Le résultat réel est annoncé en statut ; un partage annulé ne dit rien.
export function BoutonPartager({ titre, url }: Props) {
  const t = useTranslations("Fiche.partage");
  const [message, setMessage] = useState("");

  async function copier() {
    await navigator.clipboard.writeText(url);
    // Mesure après la copie réussie seulement ; ni le titre ni l'adresse ne sont transmis.
    mesurer("partage_fiche");
    // Vider puis remettre le message : une seconde copie est ré-annoncée.
    setMessage("");
    await new Promise((r) => setTimeout(r, 50));
    setMessage(t("copie"));
  }

  async function partager() {
    setMessage("");
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: titre, url });
          mesurer("partage_fiche");
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          // Le partage natif a échoué : repli sur la copie du lien avant d'afficher l'échec.
        }
      }
      await copier();
    } catch {
      setMessage(t("echec"));
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={partager} className={CLASSES_SECONDAIRE}>
        {t("bouton")}
      </button>
      <p role="status" className="t-small text-text-secondary">
        {message}
      </p>
    </div>
  );
}
