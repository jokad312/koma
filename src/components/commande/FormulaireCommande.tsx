"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { creerCommande, lireRecapitulatif } from "@/modules/commande/actions";
import type { ModeRemise, ZoneRemise } from "@/modules/commande/schemas";
import { CODES_REFUSES } from "@/modules/commande/types";
import type { CodeErreurCommande, CodeRefuse, Recapitulatif } from "@/modules/commande/types";
import { RecapCommande } from "./RecapCommande";

type Props = {
  recapInitial: Recapitulatif;
  zoneInitiale: ZoneRemise | null;
  modeInitial: ModeRemise | null;
  telephoneInitial: string;
  adresseInitiale: string;
  // Lieu de retrait à Goma, dans la langue de la route (réglage de Jonathan), ou null s'il n'est pas réglé.
  lieuRetrait: string | null;
  origine: string | null;
};

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
const LIGNE_CHOIX = "flex min-h-touch cursor-pointer items-center gap-3";

type ChampErreur = "telephone" | "zone" | "mode" | "adresse" | "cgv" | "kit" | "surMesure";

// Étape de commande (FR-13) : téléphone, Zone et Mode de remise (Panier avec produit physique seulement), cases à cocher jamais pré-cochées,
// Récapitulatif calculé par le serveur. Le succès n'est annoncé qu'après la réponse réelle de la base (règle 13).
export function FormulaireCommande({ recapInitial, zoneInitiale, modeInitial, telephoneInitial, adresseInitiale, lieuRetrait, origine }: Props) {
  const t = useTranslations("Commande");
  const tc = useTranslations("Commande.code");
  const tConsentement = useTranslations("Consentement");
  const [emails, setEmails] = useState(false);
  const locale = useLocale() as Locale;
  const router = useRouter();
  const id = useId();
  const resumeRef = useRef<HTMLDivElement>(null);
  const cle = useRef<string | null>(null);
  const [recap, setRecap] = useState(recapInitial);
  const [zone, setZone] = useState<ZoneRemise | null>(zoneInitiale);
  const [mode, setMode] = useState<ModeRemise | null>(modeInitial);
  const [telephone, setTelephone] = useState(telephoneInitial);
  const [adresse, setAdresse] = useState(adresseInitiale);
  const [cgv, setCgv] = useState(false);
  const [kit, setKit] = useState(false);
  const [surMesure, setSurMesure] = useState(false);
  const [erreurs, setErreurs] = useState<ChampErreur[]>([]);
  const [erreurServeur, setErreurServeur] = useState<CodeErreurCommande | null>(null);
  const [totalChange, setTotalChange] = useState<{ ancien: number; nouveau: number } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [recalcul, demarrerRecalcul] = useTransition();

  // Code promo (story 9.2) : le code saisi est évalué par le serveur à chaque calcul ; le code « appliqué » est celui que le serveur a accepté.
  const [codeSaisi, setCodeSaisi] = useState("");
  const [codeApplique, setCodeApplique] = useState<string | null>(null);
  const [codeErreur, setCodeErreur] = useState<CodeRefuse | null>(null);

  function relire(z: ZoneRemise | null, m: ModeRemise | null, code: string | null = codeApplique) {
    demarrerRecalcul(async () => {
      try {
        const r = await lireRecapitulatif({ zone: z, mode: m, code }, locale);
        if (r.ok) {
          setRecap(r.recap);
          if (r.recap.code && !r.recap.code.valide) {
            // Code refusé : il n'est plus envoyé, le total revient sans réduction et la raison s'affiche sous le champ.
            setCodeErreur(r.recap.code.erreur);
            setCodeApplique(null);
          } else if (code) {
            setCodeErreur(null);
          }
        } else if (r.erreur === "panier_vide") router.push("/panier");
        else setErreurServeur(r.erreur);
      } catch {
        setErreurServeur("erreur");
      }
    });
  }

  function appliquerCode() {
    const saisi = codeSaisi.trim();
    setTotalChange(null);
    cle.current = null;
    if (saisi === "") {
      setCodeApplique(null);
      setCodeErreur(null);
      relire(zone, mode, null);
      return;
    }
    setCodeApplique(saisi);
    relire(zone, mode, saisi);
  }

  function retirerCode() {
    setCodeSaisi("");
    setCodeApplique(null);
    setCodeErreur(null);
    setTotalChange(null);
    cle.current = null;
    relire(zone, mode, null);
  }

  function choisirZone(z: ZoneRemise) {
    // Bukavu : la livraison est obligatoire. Goma : le Mode se choisit.
    const m = z === "bukavu" ? "livraison" : mode;
    setZone(z);
    setMode(m);
    setTotalChange(null);
    cle.current = null;
    relire(z, m);
  }

  function choisirMode(m: ModeRemise) {
    setMode(m);
    setTotalChange(null);
    cle.current = null;
    relire(zone, m);
  }

  function valider(): ChampErreur[] {
    const manques: ChampErreur[] = [];
    if (recap.physique) {
      if (!/^\+?[0-9]{8,15}$/.test(telephone.replace(/\s/g, ""))) manques.push("telephone");
      if (!zone) manques.push("zone");
      else if (!mode) manques.push("mode");
      if (mode === "livraison" && adresse.trim() === "") manques.push("adresse");
    }
    if (!cgv) manques.push("cgv");
    if (recap.kit && !kit) manques.push("kit");
    if (recap.surMesure && !surMesure) manques.push("surMesure");
    return manques;
  }

  function confirmer() {
    setErreurServeur(null);
    const manques = valider();
    setErreurs(manques);
    if (manques.length > 0) {
      resumeRef.current?.focus();
      return;
    }
    cle.current ??= crypto.randomUUID();
    const cleIdempotence = cle.current;
    const vu = recap.totalCents;
    demarrer(async () => {
      try {
        const r = await creerCommande(
          {
            zone: recap.physique ? zone : null,
            mode: recap.physique ? mode : null,
            telephone: recap.physique ? telephone : null,
            adresse: recap.physique && mode === "livraison" ? adresse : null,
            acceptations: { cgv, kit: recap.kit ? kit : undefined, surMesure: recap.surMesure ? surMesure : undefined },
            origine,
            totalAttenduCents: vu,
            empreinte: recap.empreinte,
            cleIdempotence,
            code: codeApplique,
            emails,
          },
          locale,
        );
        if (r.ok) {
          router.push(`/commande/${r.numero}`);
          return;
        }
        if ((r.erreur === "total_change" || r.erreur === "recap_change") && "recap" in r && r.recap) {
          setRecap(r.recap);
          setTotalChange(r.erreur === "total_change" ? { ancien: vu, nouveau: r.recap.totalCents } : null);
          if (r.erreur === "recap_change") setErreurServeur("recap_change");
        } else if ((CODES_REFUSES as readonly string[]).includes(r.erreur)) {
          // Code refusé à la création : la raison s'affiche sous le champ, le code n'est plus envoyé et le total est relu sans réduction.
          setCodeErreur(r.erreur as CodeRefuse);
          setCodeApplique(null);
          cle.current = null;
          relire(zone, mode, null);
        } else {
          setErreurServeur(r.erreur);
        }
        resumeRef.current?.focus();
      } catch {
        setErreurServeur("erreur");
      }
    });
  }

  const messageServeur = erreurServeur ? t(`erreurs.${erreurServeur}`) : null;
  const bloque = recap.indisponible;

  return (
    <div className="flex flex-col gap-6">
      <div ref={resumeRef} tabIndex={-1} className="outline-none">
        {erreurs.length > 0 ? (
          <div role="alert" className="t-small flex flex-col gap-2 rounded-md border border-border bg-surface p-4 text-text-primary">
            <p className="t-label">{t("resumeErreurs")}</p>
            <ul className="list-disc ps-5">
              {erreurs.map((e) => (
                <li key={e}>{t(`champs.${e}`)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {messageServeur ? <MessageEtat type="erreur">{messageServeur}</MessageEtat> : null}
        {totalChange ? (
          <MessageEtat type="attention">
            {t("totalChange", { ancien: formaterUsd(totalChange.ancien, locale), nouveau: formaterUsd(totalChange.nouveau, locale) })}
          </MessageEtat>
        ) : null}
      </div>

      {recap.physique ? (
        <>
          <section aria-labelledby={`${id}-contact`} className="flex flex-col gap-3">
            <h2 id={`${id}-contact`} className="t-h2">
              {t("contact.titre")}
            </h2>
            <label htmlFor={`${id}-tel`} className="t-label text-text-primary">
              {t("contact.telephone")}
            </label>
            <p id={`${id}-tel-aide`} className="t-small text-text-secondary">
              {t("contact.telephoneAide")}
            </p>
            <input
              id={`${id}-tel`}
              name="telephone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              aria-describedby={`${id}-tel-aide`}
              aria-invalid={erreurs.includes("telephone") || undefined}
              className={CHAMP}
            />
          </section>

          <fieldset className="flex flex-col gap-2">
            <legend className="t-h2 mb-2">{t("remise.zone")}</legend>
            {(["goma", "bukavu"] as const).map((z) => (
              <label key={z} className={LIGNE_CHOIX}>
                <input type="radio" name="zone" value={z} checked={zone === z} onChange={() => choisirZone(z)} className="size-6" />
                <span className="t-body text-text-primary">{t(`remise.${z}`)}</span>
              </label>
            ))}
            {zone === "bukavu" ? <p className="t-small text-text-secondary">{t("remise.bukavuAide")}</p> : null}
          </fieldset>

          {zone === "goma" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="t-h2 mb-2">{t("remise.mode")}</legend>
              {(["retrait", "livraison"] as const).map((m) => (
                <label key={m} className={LIGNE_CHOIX}>
                  <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => choisirMode(m)} className="size-6" />
                  <span className="t-body text-text-primary">{t(`remise.${m}`)}</span>
                </label>
              ))}
              {mode === "retrait" && lieuRetrait ? <p className="t-small text-text-secondary">{t("remise.lieuRetrait", { lieu: lieuRetrait })}</p> : null}
            </fieldset>
          ) : null}

          {mode === "livraison" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-adresse`} className="t-label text-text-primary">
                {t("remise.adresse")}
              </label>
              <p id={`${id}-adresse-aide`} className="t-small text-text-secondary">
                {t("remise.adresseAide")}
              </p>
              <textarea
                id={`${id}-adresse`}
                name="adresse"
                rows={3}
                maxLength={500}
                autoComplete="street-address"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                aria-describedby={`${id}-adresse-aide`}
                aria-invalid={erreurs.includes("adresse") || undefined}
                className={CHAMP}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <section aria-labelledby={`${id}-code`} className="flex flex-col gap-2">
        <h2 id={`${id}-code`} className="t-h2">
          {tc("titre")}
        </h2>
        <label htmlFor={`${id}-code-champ`} className="t-label text-text-primary">
          {tc("label")}
        </label>
        <p id={`${id}-code-aide`} className="t-small text-text-secondary">
          {tc("aide")}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <input
            id={`${id}-code-champ`}
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            value={codeSaisi}
            onChange={(e) => setCodeSaisi(e.target.value)}
            onKeyDown={(e) => {
              // Entrée applique le code (le champ n'est pas dans un formulaire : rien d'autre ne part).
              if (e.key === "Enter") {
                e.preventDefault();
                appliquerCode();
              }
            }}
            aria-describedby={`${id}-code-aide${codeErreur ? ` ${id}-code-erreur` : ""}`}
            aria-invalid={codeErreur ? true : undefined}
            className={`${CHAMP} min-w-0 flex-1`}
          />
          <Bouton variante="secondaire" onClick={appliquerCode} enCours={recalcul}>
            {tc("appliquer")}
          </Bouton>
          {recap.code?.valide ? (
            <Bouton variante="secondaire" onClick={retirerCode}>
              {tc("retirer")}
            </Bouton>
          ) : null}
        </div>
        {codeErreur ? (
          <p id={`${id}-code-erreur`} role="alert" className="t-small text-text-primary">
            {tc(`erreurs.${codeErreur}`)}
          </p>
        ) : null}
        {recap.code?.valide ? (
          <p role="status" className="t-small text-text-primary">
            {tc("applique", { code: recap.code.code, pct: recap.code.reductionPct })}
          </p>
        ) : null}
      </section>

      <div aria-busy={recalcul || undefined}>
        <RecapCommande recap={recap} zone={zone} mode={mode} locale={locale} />
      </div>

      <section aria-labelledby={`${id}-cases`} className="flex flex-col gap-2">
        <h2 id={`${id}-cases`} className="t-h2">
          {t("cases.titre")}
        </h2>
        <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" checked={cgv} onChange={(e) => setCgv(e.target.checked)} aria-invalid={erreurs.includes("cgv") || undefined} className="mt-1 size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("cases.cgv")}</span>
        </label>
        <Link href="/cgv" className="t-small inline-flex min-h-touch items-center text-text-primary underline">
          {t("cases.cgvLien")}
        </Link>
        {recap.kit ? (
          <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2">
            <input type="checkbox" checked={kit} onChange={(e) => setKit(e.target.checked)} aria-invalid={erreurs.includes("kit") || undefined} className="mt-1 size-6 shrink-0" />
            <span className="t-body text-text-primary">{t("cases.kit")}</span>
          </label>
        ) : null}
        {recap.surMesure ? (
          <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2">
            <input
              type="checkbox"
              checked={surMesure}
              onChange={(e) => setSurMesure(e.target.checked)}
              aria-invalid={erreurs.includes("surMesure") || undefined}
              className="mt-1 size-6 shrink-0"
            />
            <span className="t-body text-text-primary">{t("cases.surMesure")}</span>
          </label>
        ) : null}
        {/* Story 9.4 : case facultative, jamais pré-cochée ; elle ne bloque jamais la Commande. */}
        <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" name="emails" checked={emails} onChange={(e) => setEmails(e.target.checked)} className="mt-1 size-6 shrink-0" />
          <span className="t-body text-text-primary">{tConsentement("emails")}</span>
        </label>
      </section>

      <div className="flex flex-col items-start gap-3">
        {bloque ? (
          <Bouton desactive raison={t("raisonBloque")}>
            {t("confirmer")}
          </Bouton>
        ) : (
          <Bouton onClick={confirmer} enCours={enCours}>
            {enCours ? t("enCours") : t("confirmer")}
          </Bouton>
        )}
        <Link href={cheminPublic(locale, "/panier")} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
          {t("retourPanier")}
        </Link>
      </div>
    </div>
  );
}
