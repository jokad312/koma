"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { depublierProduit, publierProduit, type EtatPhoto } from "@/modules/catalogue/actions";
import type { ManquePublication } from "@/modules/catalogue/types";
import { PastilleStatut } from "./PastilleStatut";

type Resultat = { type: "publie" | "depublie" } | { type: "erreur"; erreur: string; manques?: ManquePublication[] };

// Panneau de publication : statut (icône + mot), bouton Publier / Dépublier. Le succès n'apparaît qu'après la réponse réelle du serveur ;
// un refus liste ce qui manque. Le statut affiché vient de la base (router.refresh), jamais d'une supposition locale.
export function PublicationProduit({ produitId, publie }: { produitId: string; publie: boolean }) {
  const t = useTranslations("Admin.produits.publication");
  const router = useRouter();
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);

  function changer() {
    if (enVol.current) return;
    enVol.current = true;
    setResultat(null);
    demarrer(async () => {
      try {
        const etat: EtatPhoto = publie ? await depublierProduit({ id: produitId }) : await publierProduit({ id: produitId });
        if (etat.statut === "succes") {
          setResultat({ type: publie ? "depublie" : "publie" });
          router.refresh();
        } else {
          setResultat({ type: "erreur", erreur: etat.erreur, manques: etat.manques });
        }
      } catch {
        setResultat({ type: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  const erreur = resultat?.type === "erreur" ? resultat : null;
  const liste = erreur?.erreur === "publication_incomplete" && erreur.manques && erreur.manques.length > 0 ? erreur.manques : null;

  return (
    <section aria-labelledby="publication-titre" className="flex max-w-2xl flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 id="publication-titre" className="t-h2">
        {t("titre")}
      </h2>
      <PastilleStatut publie={publie} libelle={t(publie ? "statutPublie" : "statutBrouillon")} />
      <p className="t-body text-text-secondary">{t(publie ? "aidePublie" : "aideBrouillon")}</p>
      <Bouton variante={publie ? "secondaire" : "principal"} onClick={changer} enCours={enCours}>
        {enCours ? t("enCours") : t(publie ? "depublier" : "publier")}
      </Bouton>

      {/* Le résultat réel est annoncé en statut ; un refus est annoncé en alerte. */}
      <div role="status">
        {resultat?.type === "publie" ? <p className="t-small text-text-primary">{t("publieOk")}</p> : null}
        {resultat?.type === "depublie" ? <p className="t-small text-text-primary">{t("depublieOk")}</p> : null}
      </div>
      {liste ? (
        <div role="alert" className="t-small flex flex-col gap-2 rounded-md border border-border bg-surface p-4 text-text-primary">
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
    </section>
  );
}

function erreurConnue(code: string): string {
  return ["publication_incomplete", "produit_publie_verrouille", "produit_introuvable", "non_autorise"].includes(code) ? code : "generique";
}
