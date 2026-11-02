"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { publierArticleAction, type EtatArticle } from "@/modules/blog/actions";
import { PastilleStatut } from "./PastilleStatut";

type Resultat = { type: "publie" | "depublie" } | { type: "erreur"; erreur: string };

// Panneau de publication d'un article : statut (icône + mot), bouton Publier / Dépublier. Le succès n'apparaît qu'après la
// réponse réelle du serveur ; un refus explique ce qui manque. Le statut affiché vient de la base (router.refresh).
export function PublicationArticle({ articleId, publie }: { articleId: string; publie: boolean }) {
  const t = useTranslations("Admin.blog.publication");
  const router = useRouter();
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const enVol = useRef(false);
  const refResume = useRef<HTMLDivElement>(null);

  function changer() {
    if (enVol.current) return;
    enVol.current = true;
    setResultat(null);
    demarrer(async () => {
      try {
        const etat: EtatArticle = await publierArticleAction({ id: articleId, publier: !publie });
        if (etat.statut === "succes") {
          setResultat({ type: publie ? "depublie" : "publie" });
          router.refresh();
        } else {
          setResultat({ type: "erreur", erreur: etat.erreur });
          refResume.current?.focus();
        }
      } catch {
        setResultat({ type: "erreur", erreur: "generique" });
        refResume.current?.focus();
      } finally {
        enVol.current = false;
      }
    });
  }

  const messageErreur = resultat?.type === "erreur" ? t(`erreurs.${resultat.erreur in (t.raw("erreurs") as object) ? resultat.erreur : "generique"}`) : null;

  return (
    <section aria-labelledby="publication-titre" className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 id="publication-titre" className="t-h2">
        {t("titre")}
      </h2>
      <PastilleStatut publie={publie} libelle={t(publie ? "statutPublie" : "statutBrouillon")} />
      <p className="t-body text-text-secondary">{t(publie ? "aidePublie" : "aideBrouillon")}</p>
      {resultat?.type === "publie" ? <MessageEtat type="succes">{t("publieOk")}</MessageEtat> : null}
      {resultat?.type === "depublie" ? <MessageEtat type="succes">{t("depublieOk")}</MessageEtat> : null}
      {messageErreur ? (
        <div ref={refResume} tabIndex={-1} className="outline-none">
          <MessageEtat type="erreur">{messageErreur}</MessageEtat>
        </div>
      ) : null}
      {resultat?.type === "erreur" && resultat.erreur === "publication_incomplete" ? (
        <div className="t-small flex flex-col gap-1 text-text-secondary">
          <p>{t("incomplet")}</p>
          <ul className="list-disc pl-6">
            <li>{t("manques.titre_fr")}</li>
            <li>{t("manques.texte_fr")}</li>
            <li>{t("manques.alt")}</li>
          </ul>
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
