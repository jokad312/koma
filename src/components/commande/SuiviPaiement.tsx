"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonWhatsApp } from "@/components/vitrine/BoutonWhatsApp";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { demarrerTentativeAction } from "@/modules/paiement/actions";
import { DELAI_VERIFICATION_SECONDES, INTERVALLE_SONDAGE_MS, type EtatPaiement } from "@/modules/paiement/etat";

type Props = { numero: string; etatInitial: EtatPaiement; numeroWhatsapp: string | null };

const CLASSES_LIEN = "t-body inline-flex min-h-touch items-center text-text-primary underline";

// Retour et attente du paiement (story 4.6, AD-35, UX-DR36). Tout vient du serveur : la page ne lit jamais un paramètre de statut de l'adresse.
// Une Tentative en cours est retrouvée sur tout onglet ou rechargement : attente ou vérification, jamais un choix ni un bouton « Payer ».
// Sondage toutes les 3 secondes ; après 2 minutes sans état final, « Paiement en cours de vérification. » (couleur warning), sans repayer.
// « Payée » n'apparaît qu'avec un statut payé en base ; le focus va au titre à l'arrivée d'un état final ; l'annonce (role="status") ne part
// qu'à un changement réel d'état.
export function SuiviPaiement({ numero, etatInitial, numeroWhatsapp }: Props) {
  const t = useTranslations("Paiement.suivi");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const [relance, relancer] = useTransition();
  const [relanceFaite, setRelanceFaite] = useState(false);
  const [erreurRelance, setErreurRelance] = useState(false);
  const [etat, setEtat] = useState(etatInitial);
  const [secondesEcoulees, setSecondesEcoulees] = useState(0);
  const [annonce, setAnnonce] = useState("");
  const titre = useRef<HTMLHeadingElement>(null);
  const phasePrecedente = useRef(etatInitial.phase);
  const debut = useRef(0);
  const focusAttendu = useRef(false);
  const titreInitial = useRef<string | null>(null);

  // Sondage tant qu'une Tentative est en cours. Une erreur de lecture garde le dernier état connu et recommence au tour suivant.
  const enAttente = etat.phase === "attente";
  useEffect(() => {
    if (!enAttente) return;
    debut.current = Date.now();
    let arrete = false;
    // L'âge de la Tentative vient du serveur à chaque lecture ; on n'ajoute que le temps écoulé depuis cette lecture (jamais deux fois).
    const tour = async () => {
      setSecondesEcoulees(Math.floor((Date.now() - debut.current) / 1000));
      try {
        const r = await fetch(`/api/commande/${encodeURIComponent(numero)}/etat`, { cache: "no-store", credentials: "same-origin" });
        if (r.status === 401 || r.status === 404) {
          // Session terminée ou Commande disparue : inutile d'insister, la page serveur dira la suite au prochain chargement.
          arrete = true;
          clearInterval(minuteur);
          return;
        }
        if (!r.ok || arrete) return;
        const suivant = (await r.json()) as EtatPaiement;
        if (arrete) return;
        // Changement réel d'état : annonce (une seule fois), focus sur le titre d'un état final, et la page serveur est relue.
        if (suivant.phase !== phasePrecedente.current) {
          phasePrecedente.current = suivant.phase;
          if (suivant.phase === "payee" || suivant.phase === "echec") {
            setAnnonce(t(`annonce.${suivant.phase}`));
            focusAttendu.current = true;
          }
          router.refresh();
        }
        debut.current = Date.now();
        setSecondesEcoulees(0);
        setEtat(suivant);
      } catch {
        // Réseau coupé : on garde l'état affiché et on réessaie au prochain tour.
      }
    };
    const minuteur: ReturnType<typeof setInterval> = setInterval(tour, INTERVALLE_SONDAGE_MS);
    return () => {
      arrete = true;
      clearInterval(minuteur);
    };
  }, [enAttente, numero, router, t]);

  // Titre de l'onglet reflétant l'état quand il y en a un à dire (sinon celui de la page serveur reste) ; focus sur le titre d'un état final.
  useEffect(() => {
    if (titreInitial.current === null) titreInitial.current = document.title;
    if (etat.phase === "attente" || etat.phase === "payee" || etat.phase === "echec") document.title = t(`titreOnglet.${etat.phase}`);
    else document.title = titreInitial.current;
    // Le numéro saisi ne reste pas dans l'onglet une fois le paiement réglé ou la Commande expirée.
    if (etat.phase === "payee" || etat.phase === "expiree") {
      try {
        sessionStorage.removeItem(`koma-paiement-${numero}`);
      } catch {
        // Stockage indisponible : rien à purger.
      }
    }
    if (focusAttendu.current) {
      focusAttendu.current = false;
      titre.current?.focus();
    }
  }, [etat.phase, numero, t]);

  // Réessayer sans rien ressaisir : pays et opérateur viennent de la Tentative échouée (serveur), le numéro de la saisie de l'onglet
  // (jamais conservé en clair côté serveur). Le serveur choisit le Prestataire (le même après un échec client, le suivant après un repli).
  function relancerMobileMoney() {
    setErreurRelance(false);
    let telephone: string | null = null;
    try {
      telephone = (JSON.parse(sessionStorage.getItem(`koma-paiement-${numero}`) ?? "null") as { telephone?: string } | null)?.telephone ?? null;
    } catch {
      telephone = null;
    }
    // Numéro absent (autre onglet, onglet fermé) : rien ne part, le client est renvoyé au formulaire pour le ressaisir.
    if (!telephone) {
      setErreurRelance(true);
      return;
    }
    relancer(async () => {
      try {
        const r = await demarrerTentativeAction({ numero, moyen: "mobile_money", pays: etat.echec?.pays ?? null, operateur: etat.echec?.operateur ?? null, telephone });
        if (r.ok) {
          setRelanceFaite(true);
          router.refresh();
        } else {
          setErreurRelance(true);
        }
      } catch {
        setErreurRelance(true);
      }
    });
  }
  const peutRelancer = etat.echec?.moyen === "mobile_money" && etat.echec.pays !== null && etat.echec.operateur !== null;

  const attenteTotale = (etat.attenteDepuisSecondes ?? 0) + secondesEcoulees;
  const verification = enAttente && attenteTotale >= DELAI_VERIFICATION_SECONDES;

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {annonce}
      </p>

      {etat.phase === "attente" ? (
        <section aria-labelledby="suivi-titre" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 id="suivi-titre" ref={titre} tabIndex={-1} className="t-h2">
            {t("attente.titre")}
          </h2>
          {verification ? (
            <MessageEtat type="attention">{t("verification")}</MessageEtat>
          ) : (
            <p className="t-body text-text-primary">{etat.attente?.moyen === "mobile_money" ? t("attente.mobileMoney") : t("attente.texte")}</p>
          )}
          <dl className="flex flex-col gap-1">
            <div className="flex justify-between gap-4">
              <dt className="t-small text-text-secondary">{t("attente.montant")}</dt>
              <dd className="t-body text-text-primary">{formaterUsd(etat.montantCents, locale)}</dd>
            </div>
            {etat.attente?.telephoneMasque ? (
              <div className="flex justify-between gap-4">
                <dt className="t-small text-text-secondary">{t("attente.numero")}</dt>
                <dd className="t-body text-text-primary">{etat.attente.telephoneMasque}</dd>
              </div>
            ) : null}
          </dl>
          {formaterDateHeureBoutique(etat.expireLe, locale) ? (
            <p className="t-small text-text-secondary">{t("attente.aPayerAvant", { heure: formaterDateHeureBoutique(etat.expireLe, locale) ?? "" })}</p>
          ) : null}
        </section>
      ) : null}

      {etat.phase === "payee" ? (
        <section aria-labelledby="suivi-titre" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 id="suivi-titre" ref={titre} tabIndex={-1} className="t-h2">
            {t("payee.titre")}
          </h2>
          {etat.kit ? (
            <Link href="/compte/bibliotheque" className={CLASSES_LIEN}>
              {t("payee.bibliotheque")}
            </Link>
          ) : null}
        </section>
      ) : null}

      {etat.phase === "echec" ? (
        <section aria-labelledby="suivi-titre" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 id="suivi-titre" ref={titre} tabIndex={-1} className="t-h2">
            {t("echec.titre")}
          </h2>
          {etat.repli?.type === "suivant" ? (
            <>
              <div role="alert" className="t-body text-danger">
                {t("echec.repli", { agregateur: etat.repli.nom })}
              </div>
              {relanceFaite ? (
                <p className="t-body text-text-primary">{t("echec.nouvelleDemande")}</p>
              ) : peutRelancer ? (
                <Bouton variante="secondaire" enCours={relance} onClick={relancerMobileMoney}>
                  {t("echec.reessayerAvec", { agregateur: etat.repli.nom })}
                </Bouton>
              ) : (
                <a href="#commande-moyens" className={CLASSES_LIEN}>
                  {t("echec.reessayer")}
                </a>
              )}
            </>
          ) : etat.repli?.type === "aucun" ? (
            <div role="alert" className="t-body text-danger">
              {t("echec.aucunService")}
            </div>
          ) : (
            <>
              <div role="alert" className="t-body text-danger">
                {t("echec.texte")}
              </div>
              {relanceFaite ? (
                <p className="t-body text-text-primary">{t("echec.nouvelleDemande")}</p>
              ) : peutRelancer ? (
                <Bouton variante="secondaire" enCours={relance} onClick={relancerMobileMoney}>
                  {t("echec.reessayer")}
                </Bouton>
              ) : (
                <a href="#commande-moyens" className={CLASSES_LIEN}>
                  {t("echec.reessayer")}
                </a>
              )}
            </>
          )}
          {erreurRelance ? (
            <>
              <MessageEtat type="erreur">{t("echec.relanceImpossible")}</MessageEtat>
              <a href="#commande-moyens" className={CLASSES_LIEN}>
                {t("echec.versMoyens")}
              </a>
            </>
          ) : null}
          <BoutonWhatsApp numero={numeroWhatsapp} />
        </section>
      ) : null}

      {etat.tropPercu ? (
        <section aria-labelledby="trop-percu-titre" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 id="trop-percu-titre" className="t-h2">
            {t("tropPercu.titre")}
          </h2>
          <p className="t-body text-text-primary">{t(`tropPercu.texte.${etat.tropPercu}`)}</p>
          <BoutonWhatsApp numero={numeroWhatsapp} />
        </section>
      ) : null}
    </div>
  );
}
