"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Taille } from "@/modules/catalogue/types";
import { mesurer } from "@/modules/mesure/client";
import { ajouterAuPanier } from "@/modules/panier/actions";
import type { CodeErreurPanier } from "@/modules/panier/types";

type Props = {
  produitId: string;
  // Produit physique : la taille choisie (null tant qu'elle n'est pas choisie). Kit : undefined, aucune taille.
  taille?: Taille | null;
};

// Résultat du dernier essai, avec la taille pour laquelle il a été fait : choisir une autre taille le rend sans objet.
type Resultat = { pour: Taille | null | undefined; erreur: CodeErreurPanier | null };

// « Ajouter au panier » (UX-DR10) : « Ajouté au panier » est annoncé dans une zone de statut toujours présente, sans déplacer le focus.
// Le succès n'est annoncé qu'après la réponse réelle du serveur (règle 13) ; l'en-tête se relit ensuite pour son compteur.
export function BoutonAjouterPanier({ produitId, taille }: Props) {
  const t = useTranslations("Fiche.panier");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const physique = taille !== undefined;
  const courant = resultat && resultat.pour === taille ? resultat : null;
  const ajoute = courant !== null && courant.erreur === null;

  function ajouter() {
    setResultat(null);
    demarrer(async () => {
      try {
        const r = await ajouterAuPanier({ produitId, taille: physique ? taille : null, nombre: 1 });
        if (r.ok) {
          setResultat({ pour: taille, erreur: null });
          // Mesure seulement après le succès réel du serveur (règle 13) : aucune donnée du panier n'est transmise.
          mesurer("ajout_panier");
          router.refresh();
        } else {
          setResultat({ pour: taille, erreur: r.erreur });
        }
      } catch {
        setResultat({ pour: taille, erreur: "erreur" });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {physique && taille === null ? (
        <Bouton desactive raison={t("choisirTaille")}>
          {t("ajouter")}
        </Bouton>
      ) : (
        <Bouton onClick={ajouter} enCours={enCours}>
          {enCours ? t("enCours") : t("ajouter")}
        </Bouton>
      )}
      <p role="status" className="t-small text-text-primary">
        {ajoute ? t("ajoute") : ""}
      </p>
      {ajoute ? (
        <Link href={cheminPublic(locale, "/panier")} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
          {t("voirPanier")}
        </Link>
      ) : null}
      {courant?.erreur ? <MessageEtat type="erreur">{t(`erreurs.${courant.erreur}`)}</MessageEtat> : null}
    </div>
  );
}
