"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { demarrerTentativeAction } from "@/modules/paiement/actions";
import type { OptionsPaiement } from "@/modules/paiement/service";
import type { ErreurTentative } from "@/modules/paiement/tentative";

const AUTRE_PAYS = "__autre";

function nomPays(code: string, langue: string): string {
  try {
    return new Intl.DisplayNames([langue], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

type Saisie = { pays: string; operateur: string; telephone: string };
type SaisieCarte = { reseau: string; nom: string; telephone: string };

// Choix du moyen de paiement d'une Commande à payer (story 5.2, UX-DR33, UX-DR34). Le client choisit d'abord son pays (aucune détection
// automatique) ; « Mobile money » est proposé en premier si le pays est couvert, puis « Carte ». Seules des listes natives, des noms en texte,
// sans logo. Le serveur choisit le Prestataire : « Paiement traité par {Agrégateur} » écrit juste avant le bouton est celui qu'il retiendra.
// Pays, opérateur et numéro sont gardés pour la session de l'onglet : après un échec ou un réessai, ils restent remplis (UX-DR27).
export function ChoixPaiement({ numero, options }: { numero: string; options: OptionsPaiement }) {
  const t = useTranslations("Paiement.moyens");
  const tc = useTranslations("Paiement.choix");
  const langue = useLocale();
  const router = useRouter();
  const id = useId();
  const cle = `koma-paiement-${numero}`;
  const [saisie, setSaisie] = useState<Saisie>({ pays: "", operateur: "", telephone: "" });
  // Carte chez un Prestataire qui exige l'identité du payeur : réseau, nom et téléphone, demandés au moment du paiement par carte seulement.
  // Ils ne sont gardés nulle part (ni stockage de l'onglet) : ils partent avec la demande de paiement.
  const [carte, setCarte] = useState<SaisieCarte>({ reseau: "", nom: "", telephone: "" });
  const [annonce, setAnnonce] = useState("");
  const [erreur, setErreur] = useState<ErreurTentative | null>(null);
  const [enCours, demarrer] = useTransition();

  // Reprise de la saisie de l'onglet (confort par visiteur : absent ou illisible, le formulaire reste utilisable).
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(cle);
      if (brut) {
        const lu = JSON.parse(brut) as Partial<Saisie>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage de l'onglet, après l'hydratation
        setSaisie({ pays: String(lu.pays ?? ""), operateur: String(lu.operateur ?? ""), telephone: String(lu.telephone ?? "") });
      }
    } catch {
      // Stockage indisponible : on ne garde rien.
    }
  }, [cle]);
  function changer(suivante: Saisie) {
    setSaisie(suivante);
    try {
      sessionStorage.setItem(cle, JSON.stringify(suivante));
    } catch {
      // Stockage indisponible : on ne garde rien.
    }
  }

  const paysChoisi = options.mobileMoney.pays.find((p) => p.code === saisie.pays) ?? null;
  const operateur = paysChoisi?.operateurs.find((o) => o.nom === saisie.operateur) ?? null;
  const paysProposes = options.mobileMoney.pays;
  const carteAvecIdentite = options.carte.disponible && options.carte.prestataire.code === "maishapay";
  const carteComplete = !carteAvecIdentite || (carte.reseau !== "" && carte.nom.trim() !== "" && carte.telephone.trim() !== "");
  const champErreur = erreur === "telephone_invalide" ? "telephone" : erreur === "indisponible" || erreur === "pays_operateur_requis" ? "operateur" : null;

  function payer(moyen: "mobile_money" | "carte") {
    setErreur(null);
    demarrer(async () => {
      try {
        const r = await demarrerTentativeAction({
          numero,
          moyen,
          pays: moyen === "mobile_money" ? saisie.pays : null,
          operateur: moyen === "mobile_money" ? saisie.operateur : null,
          telephone: moyen === "mobile_money" ? saisie.telephone : carteAvecIdentite ? carte.telephone : null,
          ...(moyen === "carte" && carteAvecIdentite ? { reseauCarte: carte.reseau, nomPayeur: carte.nom } : {}),
        });
        if (!r.ok) {
          // Un paiement est déjà en cours (deuxième onglet, double toucher) : la page montre l'attente au lieu d'une erreur.
          if (r.erreur === "tentative_en_cours") router.refresh();
          else setErreur(r.erreur);
          return;
        }
        if (r.redirection) {
          window.location.assign(r.redirection);
          return;
        }
        router.refresh();
      } catch {
        setErreur("generique");
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="commande-moyens" className="t-h2">
        <span id={`${id}-titre`}>{t("titre")}</span>
      </h2>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <p className="t-label text-text-primary">{t("mobileMoney")}</p>
        {paysProposes.length === 0 ? (
          <p className="t-small text-text-secondary">{t("mobileMoneyIndisponible")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-pays`} className="t-small text-text-primary">
                {tc("pays")}
              </label>
              <select
                id={`${id}-pays`}
                value={saisie.pays}
                onChange={(e) => {
                  // Changer de pays réinitialise l'opérateur et annonce le nombre d'opérateurs disponibles (sans envoi, sans changement de page).
                  const code = e.target.value;
                  changer({ ...saisie, pays: code, operateur: "" });
                  const p = paysProposes.find((x) => x.code === code);
                  setAnnonce(p ? tc("operateursDisponibles", { n: p.operateurs.length }) : "");
                }}
                className="min-h-touch rounded-md border border-border-field bg-surface px-3"
              >
                <option value="">{tc("choisirPays")}</option>
                {paysProposes.map((p) => (
                  <option key={p.code} value={p.code}>
                    {nomPays(p.code, langue)}
                  </option>
                ))}
                <option value={AUTRE_PAYS}>{tc("autrePays")}</option>
              </select>
              <p role="status" className="sr-only">
                {annonce}
              </p>
            </div>

            {saisie.pays === AUTRE_PAYS ? <p className="t-small text-text-secondary">{t("mobileMoneyIndisponible")}</p> : null}

            {paysChoisi ? (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-operateur`} className="t-small text-text-primary">
                    {tc("operateur")}
                  </label>
                  <select
                    id={`${id}-operateur`}
                    value={saisie.operateur}
                    onChange={(e) => changer({ ...saisie, operateur: e.target.value })}
                    {...(champErreur === "operateur" ? { "aria-invalid": true, "aria-describedby": `${id}-operateur-erreur` } : {})}
                    className="min-h-touch rounded-md border border-border-field bg-surface px-3"
                  >
                    <option value="">{tc("choisirOperateur")}</option>
                    {paysChoisi.operateurs.map((o) => (
                      <option key={o.nom} value={o.nom}>
                        {o.nom}
                      </option>
                    ))}
                  </select>
                  {champErreur === "operateur" ? (
                    <p id={`${id}-operateur-erreur`} role="alert" className="t-small text-danger">
                      {tc(erreur === "indisponible" ? "aucunMoyenOperateur" : "erreurs.pays_operateur_requis")}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-telephone`} className="t-small text-text-primary">
                    {tc("telephone")}
                  </label>
                  <input
                    id={`${id}-telephone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={saisie.telephone}
                    onChange={(e) => changer({ ...saisie, telephone: e.target.value })}
                    aria-describedby={champErreur === "telephone" ? `${id}-telephone-erreur ${id}-telephone-aide` : `${id}-telephone-aide`}
                    {...(champErreur === "telephone" ? { "aria-invalid": true } : {})}
                    className="min-h-touch rounded-md border border-border-field bg-surface px-3"
                  />
                  <p id={`${id}-telephone-aide`} className="t-small text-text-secondary">
                    {tc("aideTelephone")}
                  </p>
                  {champErreur === "telephone" ? (
                    <p id={`${id}-telephone-erreur`} role="alert" className="t-small text-danger">
                      {tc("erreurs.telephone_invalide")}
                    </p>
                  ) : null}
                </div>

                {operateur ? <p className="t-small text-text-secondary">{t("traitePar", { prestataire: operateur.agregateur })}</p> : null}
                <div>
                  {!operateur || saisie.telephone.trim() === "" ? (
                    <Bouton desactive raison={tc("completer")}>
                      {tc("payerMobile")}
                    </Bouton>
                  ) : (
                    <Bouton enCours={enCours} onClick={() => payer("mobile_money")}>
                      {enCours ? tc("enCours") : tc("payerMobile")}
                    </Bouton>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <p className="t-label text-text-primary">{t("carte")}</p>
        {options.carte.disponible ? (
          <>
            <p className="t-small text-text-secondary">{t("traitePar", { prestataire: options.carte.prestataire.nom })}</p>
            {carteAvecIdentite ? (
              <>
                <fieldset className="flex flex-col gap-1">
                  <legend className="t-small text-text-primary">{tc("reseauCarte")}</legend>
                  <div className="flex gap-4">
                    {(["VISA", "MASTERCARD"] as const).map((r) => (
                      <label key={r} className="flex min-h-touch items-center gap-2 t-small text-text-primary">
                        <input type="radio" name={`${id}-reseau`} value={r} checked={carte.reseau === r} onChange={() => setCarte({ ...carte, reseau: r })} />
                        {tc(`reseaux.${r}`)}
                      </label>
                    ))}
                  </div>
                  {erreur === "reseau_carte_invalide" ? (
                    <p role="alert" className="t-small text-danger">
                      {tc("erreurs.reseau_carte_invalide")}
                    </p>
                  ) : null}
                </fieldset>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-nom-payeur`} className="t-small text-text-primary">
                    {tc("nomPayeur")}
                  </label>
                  <input
                    id={`${id}-nom-payeur`}
                    type="text"
                    autoComplete="cc-name"
                    maxLength={100}
                    value={carte.nom}
                    onChange={(e) => setCarte({ ...carte, nom: e.target.value })}
                    {...(erreur === "nom_payeur_invalide" ? { "aria-invalid": true, "aria-describedby": `${id}-nom-payeur-erreur` } : {})}
                    className="min-h-touch rounded-md border border-border-field bg-surface px-3"
                  />
                  {erreur === "nom_payeur_invalide" ? (
                    <p id={`${id}-nom-payeur-erreur`} role="alert" className="t-small text-danger">
                      {tc("erreurs.nom_payeur_invalide")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-carte-telephone`} className="t-small text-text-primary">
                    {tc("telephonePayeur")}
                  </label>
                  <input
                    id={`${id}-carte-telephone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={carte.telephone}
                    onChange={(e) => setCarte({ ...carte, telephone: e.target.value })}
                    aria-describedby={erreur === "telephone_invalide" ? `${id}-carte-telephone-erreur ${id}-carte-telephone-aide` : `${id}-carte-telephone-aide`}
                    {...(erreur === "telephone_invalide" ? { "aria-invalid": true } : {})}
                    className="min-h-touch rounded-md border border-border-field bg-surface px-3"
                  />
                  <p id={`${id}-carte-telephone-aide`} className="t-small text-text-secondary">
                    {tc("aidePayeurCarte")}
                  </p>
                  {erreur === "telephone_invalide" ? (
                    <p id={`${id}-carte-telephone-erreur`} role="alert" className="t-small text-danger">
                      {tc("erreurs.telephone_invalide")}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
            <div>
              {carteComplete ? (
                <Bouton variante="secondaire" enCours={enCours} onClick={() => payer("carte")}>
                  {enCours ? tc("enCours") : tc("payerCarte")}
                </Bouton>
              ) : (
                <Bouton variante="secondaire" desactive raison={tc("completerCarte")}>
                  {tc("payerCarte")}
                </Bouton>
              )}
            </div>
          </>
        ) : (
          <p className="t-small text-text-secondary">{t("carteIndisponible")}</p>
        )}
      </div>

      {erreur && !champErreur ? <MessageEtat type="erreur">{tc(`erreurs.${erreur}`)}</MessageEtat> : null}
    </section>
  );
}
