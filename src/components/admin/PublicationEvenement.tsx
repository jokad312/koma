"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { publierEvenementAction } from "@/modules/evenements/actions";
import { MANQUES_PUBLICATION } from "@/modules/evenements/types";
import { PastilleStatut } from "./PastilleStatut";

type Resultat = { type: "publie" | "depublie" } | { type: "erreur"; erreur: string; manques: string[] };

// Panneau de publication d'un Événement : statut, ce qui manque (lu en base), bouton Publier / Dépublier.
// Le succès n'apparaît qu'après la réponse réelle du serveur ; un refus liste ce qui manque.
export function PublicationEvenement({ evenementId, publie, manques }: { evenementId: string; publie: boolean; manques: readonly string[] }) {
  const t = useTranslations("Admin.evenements.publication");
  const router = useRouter();
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const refResume = useRef<HTMLDivElement>(null);

  // Le bloc d'erreur n'existe qu'après le rendu : le focus lui est donné ici, pas dans le gestionnaire.
  useEffect(() => {
    if (resultat?.type === "erreur") refResume.current?.focus();
  }, [resultat]);

  function changer() {
    if (enVol.current) return;
    enVol.current = true;
    setResultat(null);
    demarrer(async () => {
      try {
        const etat = await publierEvenementAction({ id: evenementId, publier: !publie });
        if (etat.statut === "succes") {
          setResultat({ type: publie ? "depublie" : "publie" });
          router.refresh();
        } else {
          setResultat({ type: "erreur", erreur: etat.erreur, manques: etat.manques ?? [] });
        }
      } catch {
        setResultat({ type: "erreur", erreur: "generique", manques: [] });
      } finally {
        enVol.current = false;
      }
    });
  }

  const erreurs = t.raw("erreurs") as object;
  const messageErreur = resultat?.type === "erreur" ? t(`erreurs.${resultat.erreur in erreurs ? resultat.erreur : "generique"}`) : null;
  // La liste vient de la base à chaque affichage ; après un refus, celle du serveur prend le relais.
  const liste = (resultat?.type === "erreur" && resultat.manques.length > 0 ? resultat.manques : manques).filter((m) => (MANQUES_PUBLICATION as readonly string[]).includes(m));

  return (
    <section aria-labelledby="publication-evenement-titre" className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 id="publication-evenement-titre" className="t-h2">
        {t("titre")}
      </h2>
      <PastilleStatut publie={publie} libelle={t(publie ? "statutPublie" : "statutBrouillon")} />
      <p className="t-body text-text-secondary">{t(publie ? "aidePublie" : "aideBrouillon")}</p>
      {liste.length > 0 ? (
        <div className="t-small flex flex-col gap-1 text-text-secondary">
          <p>{t(publie ? "incompletPublie" : "incomplet")}</p>
          <ul className="list-disc pl-6">
            {liste.map((m) => (
              <li key={m}>{t(`manques.${m}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {resultat?.type === "publie" ? <MessageEtat type="succes">{t("publieOk")}</MessageEtat> : null}
      {resultat?.type === "depublie" ? <MessageEtat type="succes">{t("depublieOk")}</MessageEtat> : null}
      {messageErreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{messageErreur}</MessageEtat>
        </div>
      ) : null}
      <div>
        <Bouton variante={publie ? "secondaire" : "principal"} enCours={enCours} onClick={changer}>
          {enCours ? t("enCours") : t(publie ? "depublier" : "publier")}
        </Bouton>
      </div>
    </section>
  );
}
