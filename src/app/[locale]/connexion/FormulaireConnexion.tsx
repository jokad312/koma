"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { declarerAge, demanderCode, verifierCode } from "@/modules/comptes/actions";
import type { CodeErreur } from "@/modules/comptes/types";

type Etape = "email" | "code" | "age" | "moins13";

const DELAI_RENVOI_SECONDES = 60;
const CHAMP =
  "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
const ERREURS_DE_CHAMP: ReadonlySet<CodeErreur> = new Set([
  "email_invalide",
  "code_format",
  "code_faux",
  "code_expire",
  "age_invalide",
]);

export function FormulaireConnexion({ etapeInitiale = "email" }: { etapeInitiale?: "email" | "age" }) {
  const t = useTranslations("Connexion");
  const langue = useLocale();
  const router = useRouter();
  const retour = useSearchParams().get("retour") ?? undefined;
  const [enCours, demarrer] = useTransition();

  const [etape, setEtape] = useState<Etape>(etapeInitiale);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [age, setAge] = useState("");
  const [erreur, setErreur] = useState<CodeErreur | null>(null);
  // Moment où Supabase a confirmé l'envoi du code (jamais avant sa réponse), et s'il s'agit d'un renvoi.
  const [envoi, setEnvoi] = useState<{ le: number; renvoi: boolean } | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [action, setAction] = useState<"envoyer" | "renvoyer" | "verifier" | "age" | null>(null);

  const refEmail = useRef<HTMLInputElement>(null);
  const refCode = useRef<HTMLInputElement>(null);
  const refAge = useRef<HTMLInputElement>(null);
  const refTitreCode = useRef<HTMLHeadingElement>(null);
  const refTitreAge = useRef<HTMLHeadingElement>(null);
  const refTitreMoins13 = useRef<HTMLHeadingElement>(null);
  const premierRendu = useRef(true);
  const idEmail = useId();
  const idCode = useId();
  const idAge = useId();
  const idErreur = useId();
  const idAideAge = useId();
  const idValidite = useId();

  // Focus déplacé à chaque changement d'étape (jamais au premier rendu).
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const cible = { email: refEmail, code: refTitreCode, age: refTitreAge, moins13: refTitreMoins13 }[etape];
    cible.current?.focus();
  }, [etape]);

  const secondes = envoi ? Math.max(0, DELAI_RENVOI_SECONDES - Math.floor((maintenant - envoi.le) / 1000)) : 0;
  const compteActif = secondes > 0;

  // Compte à rebours du renvoi, écrit en texte : armé seulement tant qu'il reste des secondes.
  useEffect(() => {
    if (!compteActif) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [compteActif, envoi]);

  function focaliserChamp(champ: React.RefObject<HTMLInputElement | null>) {
    // Après le rendu de l'erreur.
    setTimeout(() => champ.current?.focus(), 0);
  }

  function envoyerCode(renvoi: boolean) {
    setErreur(null);
    setAction(renvoi ? "renvoyer" : "envoyer");
    demarrer(async () => {
      const resultat = await demanderCode({ email, langue: langue as "fr" | "en" });
      if (!resultat.ok) {
        setErreur(resultat.erreur);
        if (resultat.erreur === "email_invalide") focaliserChamp(refEmail);
        return;
      }
      // Réponse réelle de Supabase reçue : seulement maintenant, le message d'envoi s'affiche.
      setEmail(resultat.email);
      setCode("");
      const le = Date.now();
      setMaintenant(le);
      setEnvoi({ le, renvoi });
      setEtape("code");
    });
  }

  function surEmail(e: FormEvent) {
    e.preventDefault();
    envoyerCode(false);
  }

  function surCode(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setAction("verifier");
    demarrer(async () => {
      const resultat = await verifierCode({
        email,
        code,
        langue: langue as "fr" | "en",
        retour,
        envoyeLe: envoi?.le,
      });
      if (!resultat.ok) {
        setErreur(resultat.erreur);
        if (ERREURS_DE_CHAMP.has(resultat.erreur)) focaliserChamp(refCode);
        return;
      }
      if (resultat.etape === "age") {
        setEtape("age");
        return;
      }
      router.replace(resultat.retour);
      router.refresh();
    });
  }

  function surAge(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setAction("age");
    demarrer(async () => {
      const resultat = await declarerAge({ age, langue: langue as "fr" | "en", retour });
      if (!resultat.ok) {
        if (resultat.erreur === "moins_13") {
          setAge("");
          setEtape("moins13");
          router.refresh();
          return;
        }
        setErreur(resultat.erreur);
        if (resultat.erreur === "age_invalide") focaliserChamp(refAge);
        return;
      }
      router.replace(resultat.retour);
      router.refresh();
    });
  }

  function changerAdresse() {
    setErreur(null);
    setEnvoi(null);
    setCode("");
    setEtape("email");
  }

  function surSaisieCode(e: ChangeEvent<HTMLInputElement>) {
    // Le collage est permis : espaces et tirets sont retirés, six chiffres au plus. Aucune soumission automatique.
    setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
  }

  function surCollageCode(e: ClipboardEvent<HTMLInputElement>) {
    // « maxlength » couperait un code collé avec espaces (« 123 456 ») : on garde les chiffres seulement.
    e.preventDefault();
    setCode(e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6));
  }

  const erreurChamp = erreur && ERREURS_DE_CHAMP.has(erreur) ? erreur : null;
  const erreurGenerale = erreur && !ERREURS_DE_CHAMP.has(erreur) ? erreur : null;
  const messageErreur = (e: CodeErreur) => t(`erreurs.${e}`);
  const resume = erreur ? (
    erreurGenerale ? (
      <MessageEtat type="erreur">{messageErreur(erreurGenerale)}</MessageEtat>
    ) : (
      <MessageEtat type="erreur">{t("erreurs.resume")}</MessageEtat>
    )
  ) : null;
  const classeTitreEtape = "t-h2 outline-none";

  if (etape === "moins13") {
    return (
      <section className="flex flex-col items-start gap-4" aria-labelledby={`${idErreur}-t`}>
        <h2 id={`${idErreur}-t`} ref={refTitreMoins13} tabIndex={-1} className={classeTitreEtape}>
          {t("moins13.titre")}
        </h2>
        <MessageEtat type="information">{t("moins13.texte")}</MessageEtat>
        <Bouton href="/">{t("moins13.accueil")}</Bouton>
      </section>
    );
  }

  if (etape === "age") {
    return (
      <form onSubmit={surAge} noValidate className="flex max-w-md flex-col items-start gap-4">
        <h2 ref={refTitreAge} tabIndex={-1} className={classeTitreEtape}>
          {t("age.titre")}
        </h2>
        <p>{t("age.texte")}</p>
        {resume}
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={idAge} className="t-small font-semibold">
            {t("age.libelle")}
          </label>
          <input
            ref={refAge}
            id={idAge}
            name="age"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            autoComplete="off"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
            aria-invalid={erreurChamp === "age_invalide" || undefined}
            aria-describedby={erreurChamp === "age_invalide" ? `${idAideAge} ${idErreur}` : idAideAge}
            className={CHAMP}
          />
          <p id={idAideAge} className="t-small text-text-secondary">
            {t("age.aide")}
          </p>
          {erreurChamp === "age_invalide" ? (
            <p id={idErreur} className="t-small text-danger">
              {messageErreur("age_invalide")}
            </p>
          ) : null}
        </div>
        <Bouton type="submit" enCours={enCours && action === "age"}>
          {enCours && action === "age" ? t("age.enCours") : t("age.continuer")}
        </Bouton>
        {erreur === "non_connecte" ? (
          <Bouton variante="secondaire" onClick={changerAdresse}>
            {t("aide.changer")}
          </Bouton>
        ) : null}
      </form>
    );
  }

  if (etape === "code") {
    const expire = erreur === "code_expire";
    const renvoiEnCours = enCours && action === "renvoyer";
    const boutonRenvoi =
      secondes > 0 ? (
        <Bouton variante="secondaire" desactive raison={t("code.delaiRenvoi", { secondes })}>
          {t("code.renvoyer")}
        </Bouton>
      ) : (
        <Bouton
          variante={expire ? "principal" : "secondaire"}
          enCours={renvoiEnCours}
          onClick={() => envoyerCode(true)}
        >
          {renvoiEnCours ? t("code.renvoiEnCours") : t("code.renvoyer")}
        </Bouton>
      );

    return (
      <div className="flex max-w-md flex-col items-start gap-4">
        <form onSubmit={surCode} noValidate className="flex w-full flex-col items-start gap-4">
          <h2 ref={refTitreCode} tabIndex={-1} className={classeTitreEtape}>
            {t("code.titre")}
          </h2>
          {envoi ? <p role="status">{t(envoi.renvoi ? "code.renvoye" : "code.envoye", { email })}</p> : null}
          {resume}
          <div className="flex w-full flex-col gap-2">
            <label htmlFor={idCode} className="t-small font-semibold">
              {t("code.libelle")}
            </label>
            <input
              ref={refCode}
              id={idCode}
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={surSaisieCode}
              onPaste={surCollageCode}
              aria-invalid={erreurChamp !== null || undefined}
              aria-describedby={erreurChamp ? `${idValidite} ${idErreur}` : idValidite}
              className={`${CHAMP} tracking-[0.3em]`}
            />
            <p id={idValidite} className="t-small text-text-secondary">
              {t("code.validite")}
            </p>
            {erreurChamp ? (
              <p id={idErreur} className="t-small text-danger">
                {messageErreur(erreurChamp)}
              </p>
            ) : null}
          </div>
          <Bouton type="submit" enCours={enCours && action === "verifier"}>
            {enCours && action === "verifier" ? t("code.verificationEnCours") : t("code.valider")}
          </Bouton>
        </form>
        <div className="flex flex-col items-start gap-2">{boutonRenvoi}</div>
        <details className="w-full">
          <summary className="t-small inline-flex min-h-touch cursor-pointer items-center font-semibold">
            {t("aide.titre")}
          </summary>
          <ul className="t-small mt-2 flex list-disc flex-col gap-2 pl-5">
            <li>{t("aide.adresse", { email })}</li>
            <li>{t("aide.indesirables")}</li>
            <li>{t("aide.renvoi")}</li>
          </ul>
          <div className="mt-3">
            <Bouton variante="secondaire" onClick={changerAdresse}>
              {t("aide.changer")}
            </Bouton>
          </div>
        </details>
      </div>
    );
  }

  return (
    <form onSubmit={surEmail} noValidate className="flex max-w-md flex-col items-start gap-4">
      <p>{t("intro")}</p>
      {resume}
      <div className="flex w-full flex-col gap-2">
        <label htmlFor={idEmail} className="t-small font-semibold">
          {t("email.libelle")}
        </label>
        <input
          ref={refEmail}
          id={idEmail}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={erreurChamp === "email_invalide" || undefined}
          aria-describedby={erreurChamp === "email_invalide" ? idErreur : undefined}
          className={CHAMP}
        />
        {erreurChamp === "email_invalide" ? (
          <p id={idErreur} className="t-small text-danger">
            {messageErreur("email_invalide")}
          </p>
        ) : null}
      </div>
      <Bouton type="submit" enCours={enCours && action === "envoyer"}>
        {enCours && action === "envoyer" ? t("email.envoiEnCours") : t("email.envoyer")}
      </Bouton>
    </form>
  );
}
