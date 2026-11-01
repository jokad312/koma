"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { BoutonAjouterPanier } from "./BoutonAjouterPanier";
import type { Locale } from "@/i18n/routing";
import { cheminRetourValide } from "@/lib/auth/retour";
import { lireEtatKit } from "@/modules/bibliotheque/actions";
import type { EtatKit } from "@/modules/bibliotheque/types";
import { obtenirKitGratuit } from "@/modules/commande/actions";
import type { CodeErreurCommande } from "@/modules/commande/types";

// Chemin de la bibliothèque du client (la page arrive à la story 3.6).
export const CHEMIN_BIBLIOTHEQUE = "/compte/bibliotheque";

type Props = { produitId: string; prixCents: number };

// Zone « Obtenir » de la fiche Kit. La fiche reste publique et en cache : l'état du visiteur est lu après l'affichage.
// Kit gratuit : visiteur non connecté -> connexion puis retour sur la fiche (UX-DR26) ; Compte complet -> Licence à cocher puis un geste ;
// Kit déjà possédé (gratuit ou payant) -> « Ouvrir dans ma bibliothèque ». Un Kit payant non possédé affiche « Ajouter au panier » (story 4.1).
export function ObtentionKit({ produitId, prixCents }: Props) {
  const t = useTranslations("Kit.obtention");
  const locale = useLocale() as Locale;
  const chemin = usePathname();
  const idCase = useId();
  const cle = useRef<string | null>(null);
  const succesRef = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<EtatKit | null>(null);
  const [licence, setLicence] = useState(false);
  const [erreur, setErreur] = useState<CodeErreurCommande | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const gratuit = prixCents === 0;

  // Au succès, le bouton disparaît : le focus passe au message pour que le clavier et le lecteur d'écran ne le perdent pas.
  useEffect(() => {
    if (numero) succesRef.current?.focus();
  }, [numero]);

  useEffect(() => {
    let actif = true;
    lireEtatKit(produitId).then(
      (e) => {
        if (actif) setEtat(e);
      },
      () => {
        if (actif) setEtat("anonyme");
      },
    );
    return () => {
      actif = false;
    };
  }, [produitId]);

  const retour = cheminRetourValide(chemin, locale);
  const adresseConnexion = retour === `/${locale}` ? "/connexion" : `/connexion?retour=${encodeURIComponent(retour)}`;

  function obtenir() {
    setErreur(null);
    cle.current ??= crypto.randomUUID();
    const cleIdempotence = cle.current;
    demarrer(async () => {
      try {
        const r = await obtenirKitGratuit({ produitId, licenceAcceptee: true, cleIdempotence });
        if (r.ok) {
          setNumero(r.numero);
          setEtat("possede");
        } else {
          setErreur(r.erreur);
          // Session expirée ou Compte incomplet : le lien de connexion (avec retour) revient ; Kit déjà possédé : « Ouvrir ».
          if (r.erreur === "deja_possede") setEtat("possede");
          if (r.erreur === "non_connecte") setEtat("anonyme");
          if (r.erreur === "compte_incomplet") setEtat("incomplet");
        }
      } catch {
        setErreur("erreur");
      }
    });
  }

  if (etat === "possede") {
    return (
      <div className="flex flex-col items-start gap-3">
        {numero ? (
          <div ref={succesRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
            <MessageEtat type="succes">{t("succes", { numero })}</MessageEtat>
          </div>
        ) : null}
        <Bouton href={CHEMIN_BIBLIOTHEQUE}>{t("ouvrir")}</Bouton>
      </div>
    );
  }

  // Kit payant non possédé : « Ajouter au panier » (un seul exemplaire). Le paiement arrive avec les stories 4.3 et suivantes.
  if (!gratuit) return <BoutonAjouterPanier produitId={produitId} />;

  if (etat === "pret") {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="flex min-h-touch items-center gap-3">
          <input id={idCase} type="checkbox" checked={licence} disabled={enCours} onChange={(e) => setLicence(e.target.checked)} className="size-5" />
          <label htmlFor={idCase} className="t-label text-text-primary">
            {t("licenceCase")}
          </label>
        </div>
        {licence ? (
          <Bouton onClick={obtenir} enCours={enCours}>
            {enCours ? t("enCours") : t("obtenir")}
          </Bouton>
        ) : (
          <Bouton desactive raison={t("raisonLicence")}>
            {t("obtenir")}
          </Bouton>
        )}
        {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreur}`)}</MessageEtat> : null}
      </div>
    );
  }

  // Avant la lecture de l'état, pour un visiteur non connecté et pour un Compte incomplet : la connexion (qui demande l'âge au besoin), puis le retour ici.
  return <Bouton href={adresseConnexion}>{t("obtenir")}</Bouton>;
}
