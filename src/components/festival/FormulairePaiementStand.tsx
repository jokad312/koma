"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { CODES_REFUSES } from "@/modules/commande/types";
import type { CodeRefuse } from "@/modules/commande/types";
import { creerCommandeStandAction, lireRecapitulatifStandAction } from "@/modules/evenements/candidature-actions";
import { nomValable } from "@/modules/evenements/candidature-nom";
import type { ErreurPaiementStand, RecapStand } from "@/modules/evenements/candidature-types";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

type Props = {
  candidatureId: string;
  slug: string;
  nomCompte: string | null;
  recapInitial: RecapStand;
  // Échéance affichée à l'heure de Goma, et en ISO pour l'attribut datetime.
  limite: string;
  limiteIso: string;
};

// Paiement d'un Stand accepté (story 7.11) : récapitulatif relu par le serveur, nom de l'aide facultatif (à saisir plus tard dans « Mes Pass »),
// Code promo, mention sur les photos et vidéos jamais pré-cochée. La Commande n'est annoncée qu'après la réponse réelle de la base (règle 13) ;
// le moyen de paiement se choisit ensuite sur l'écran de la Commande (mobile money ou carte MaishaPay, jamais Polar).
export function FormulairePaiementStand({ candidatureId, slug, nomCompte, recapInitial, limite, limiteIso }: Props) {
  const t = useTranslations("Festival.stand");
  const tc = useTranslations("Commande.code");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const id = useId();
  const resumeRef = useRef<HTMLDivElement>(null);
  const cle = useRef<string | null>(null);
  const [recap, setRecap] = useState(recapInitial);
  const [nomTitulaire, setNomTitulaire] = useState("");
  const [nomAide, setNomAide] = useState("");
  const [mention, setMention] = useState(false);
  const [erreurs, setErreurs] = useState<("titulaire" | "aide" | "mention")[]>([]);
  const [erreurServeur, setErreurServeur] = useState<ErreurPaiementStand | null>(null);
  const [totalChange, setTotalChange] = useState<{ ancien: number; nouveau: number } | null>(null);
  const [codeSaisi, setCodeSaisi] = useState("");
  const [codeApplique, setCodeApplique] = useState<string | null>(null);
  const [codeErreur, setCodeErreur] = useState<CodeRefuse | null>(null);
  const [enCours, demarrer] = useTransition();
  const [recalcul, demarrerRecalcul] = useTransition();

  async function calculer(code: string | null) {
    setErreurServeur(null);
    try {
      const r = await lireRecapitulatifStandAction({ candidatureId, code }, locale);
      if (!r.ok) {
        setErreurServeur(r.erreur);
        return;
      }
      setRecap(r.recap);
      if (r.recap.code && !r.recap.code.valide) {
        setCodeErreur((CODES_REFUSES as readonly string[]).includes(r.recap.code.erreur) ? (r.recap.code.erreur as CodeRefuse) : "code_inconnu");
        setCodeApplique(null);
      } else {
        setCodeErreur(null);
      }
    } catch {
      setErreurServeur("erreur");
    }
  }

  function appliquerCode() {
    const saisi = codeSaisi.trim();
    cle.current = null;
    setTotalChange(null);
    setCodeApplique(saisi === "" ? null : saisi);
    demarrerRecalcul(async () => {
      await calculer(saisi === "" ? null : saisi);
    });
  }

  function retirerCode() {
    setCodeSaisi("");
    setCodeApplique(null);
    setCodeErreur(null);
    cle.current = null;
    setTotalChange(null);
    demarrerRecalcul(async () => {
      await calculer(null);
    });
  }

  function confirmer() {
    setErreurServeur(null);
    const manques: ("titulaire" | "aide" | "mention")[] = [];
    if (nomCompte === null && !nomValable(nomTitulaire)) manques.push("titulaire");
    if (nomAide.trim() !== "" && !nomValable(nomAide)) manques.push("aide");
    if (!mention) manques.push("mention");
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
        const r = await creerCommandeStandAction(
          { candidatureId, code: codeApplique, mention: true, totalAttenduCents: vu, cleIdempotence, nomTitulaire: nomCompte === null ? nomTitulaire : null, nomAide: nomAide.trim() === "" ? null : nomAide },
          locale,
        );
        if (r.ok) {
          // Choix du moyen de paiement : l'écran existant de la Commande.
          router.push(`/commande/${r.numero}`);
          return;
        }
        if (r.erreur === "total_change" && "recap" in r && r.recap) {
          setRecap(r.recap);
          setTotalChange({ ancien: vu, nouveau: r.recap.totalCents });
          cle.current = null;
        } else if ((CODES_REFUSES as readonly string[]).includes(r.erreur)) {
          setCodeErreur(r.erreur as CodeRefuse);
          setCodeApplique(null);
          cle.current = null;
          await calculer(null);
        } else if (r.erreur === "expiree" || r.erreur === "refusee" || r.erreur === "deja_commandee") {
          // L'état a changé côté serveur : la page relit tout.
          router.refresh();
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

  return (
    <div className="flex flex-col gap-6">
      <div ref={resumeRef} tabIndex={-1} className="outline-none">
        {erreurs.length > 0 ? (
          <div role="alert" className="t-small flex flex-col gap-2 rounded-md border border-border bg-surface p-4 text-text-primary">
            <p className="t-label">{t("resume")}</p>
            <ul className="list-disc ps-5">
              {erreurs.map((e) => (
                <li key={e}>{t(`champs.${e}`)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {messageServeur ? <MessageEtat type="erreur">{messageServeur}</MessageEtat> : null}
        {totalChange ? <MessageEtat type="attention">{t("totalChange", { ancien: formaterUsd(totalChange.ancien, locale), nouveau: formaterUsd(totalChange.nouveau, locale) })}</MessageEtat> : null}
      </div>

      <MessageEtat type="succes">
        {t("accepte", { limite })}
      </MessageEtat>
      <p className="t-small text-text-secondary">
        {t("limite")} <time dateTime={limiteIso}>{limite}</time>
      </p>

      <section aria-labelledby={`${id}-noms`} className="flex flex-col gap-4">
        <h2 id={`${id}-noms`} className="t-h2">
          {t("noms.titre")}
        </h2>
        <p className="t-body text-text-secondary">{t("noms.aide")}</p>
        {nomCompte !== null ? (
          <p className="t-body text-text-primary">{t("noms.moiConnu", { nom: nomCompte })}</p>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-titulaire`} className="t-label text-text-primary">
              {t("noms.moiSaisie")}
            </label>
            <input id={`${id}-titulaire`} type="text" autoComplete="name" maxLength={200} value={nomTitulaire} onChange={(e) => setNomTitulaire(e.target.value)} aria-invalid={erreurs.includes("titulaire") || undefined} className={CHAMP} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-aide`} className="t-label text-text-primary">
            {t("noms.aideChamp")}
          </label>
          <p id={`${id}-aide-aide`} className="t-small text-text-secondary">
            {t("noms.aideFacultatif")}
          </p>
          <input id={`${id}-aide`} type="text" autoComplete="off" maxLength={200} value={nomAide} onChange={(e) => setNomAide(e.target.value)} aria-describedby={`${id}-aide-aide`} aria-invalid={erreurs.includes("aide") || undefined} className={CHAMP} />
        </div>
      </section>

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

      <section aria-labelledby={`${id}-recap`} aria-busy={recalcul || undefined} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <h2 id={`${id}-recap`} className="t-h2">
          {t("recap.titre")}
        </h2>
        <p className="t-label text-text-primary">{t("recap.ligne", { nom: recap.nom })}</p>
        <p className="t-small text-text-secondary">{t("recap.deuxPass")}</p>
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between gap-4">
            <dt className="t-body text-text-primary">{t("recap.prix")}</dt>
            <dd className="t-body text-text-primary">{formaterUsd(recap.prixCents, locale)}</dd>
          </div>
          {recap.code?.valide && recap.reductionCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="t-body text-text-primary">{t("recap.reduction", { code: recap.code.code })}</dt>
              <dd className="t-body text-text-primary">{t("recap.reductionMontant", { montant: formaterUsd(recap.reductionCents, locale) })}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="t-h3 text-text-primary">{t("recap.total")}</dt>
            <dd className="t-price-card text-text-primary">{formaterUsd(recap.totalCents, locale)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={`${id}-mention`} className="flex flex-col gap-2">
        <h2 id={`${id}-mention`} className="t-h2">
          {t("mention.titre")}
        </h2>
        <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" checked={mention} onChange={(e) => setMention(e.target.checked)} aria-invalid={erreurs.includes("mention") || undefined} className="mt-1 size-6 shrink-0" />
          <span className="t-body text-text-primary">{t("mention.texte")}</span>
        </label>
      </section>

      <div className="flex flex-col items-start gap-3">
        <Bouton onClick={confirmer} enCours={enCours}>
          {enCours ? t("confirmerEnCours") : t("confirmer")}
        </Bouton>
        <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
          {t("retourEvenement")}
        </Link>
      </div>
    </div>
  );
}
