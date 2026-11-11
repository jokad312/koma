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
import { creerCommandePassAction, lireRecapitulatifPassAction } from "@/modules/evenements/achat-actions";
import { MAX_PASS_PAR_COMMANDE, NOM_TITULAIRE_MAX, NOM_TITULAIRE_MIN } from "@/modules/evenements/achat-types";
import type { CodeErreurAchat, RecapPass } from "@/modules/evenements/achat-types";

export type TypeAchetable = { id: string; nom: string; prixCents: number; inclus: string | null; complet: boolean };

type Props = {
  evenementId: string;
  slug: string;
  // Nom donné par le Compte, ou null (jamais inventé : l'acheteur écrit alors son nom).
  nomCompte: string | null;
  types: TypeAchetable[];
};

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
const BOUTON_COMPTEUR = "t-h3 inline-flex size-11 items-center justify-center rounded-md border border-border-field bg-surface text-text-primary disabled:opacity-40";

type ChampErreur = "aucun" | "nom" | "mention";

// Nom propre : même règle que la base (qui revérifie tout) — 2 à 80 caractères, ni chevrons ni caractère de contrôle.
export function nomValable(nom: string): boolean {
  const propre = nom.replace(/\s+/g, " ").trim();
  return propre.length >= NOM_TITULAIRE_MIN && propre.length <= NOM_TITULAIRE_MAX && !/[<>\u0000-\u001f\u007f]/.test(propre);
}

// Achat de Pass (FR-33, UX-DR40) : compteurs −/+ de 44 px par Type, un nom par personne, Récapitulatif calculé par le serveur, mention sur les photos
// et vidéos jamais pré-cochée. Rien ne passe par le Panier. La Commande n'est annoncée qu'après la réponse réelle de la base (règle 13).
export function FormulaireAchatPass({ evenementId, slug, nomCompte, types }: Props) {
  const t = useTranslations("Festival.achat");
  const tc = useTranslations("Commande.code");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const id = useId();
  const resumeRef = useRef<HTMLDivElement>(null);
  const cle = useRef<string | null>(null);
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [noms, setNoms] = useState<Record<string, string[]>>({});
  const [pourMoi, setPourMoi] = useState(true);
  const [recap, setRecap] = useState<RecapPass | null>(null);
  const [mention, setMention] = useState(false);
  const [erreurs, setErreurs] = useState<ChampErreur[]>([]);
  const [erreurServeur, setErreurServeur] = useState<CodeErreurAchat | null>(null);
  const [totalChange, setTotalChange] = useState<{ ancien: number; nouveau: number } | null>(null);
  const [codeSaisi, setCodeSaisi] = useState("");
  const [codeApplique, setCodeApplique] = useState<string | null>(null);
  const [codeErreur, setCodeErreur] = useState<CodeRefuse | null>(null);
  const [enCours, demarrer] = useTransition();
  const [recalcul, demarrerRecalcul] = useTransition();

  const choisis = types.filter((x) => (quantites[x.id] ?? 0) > 0);
  const total = choisis.reduce((somme, x) => somme + (quantites[x.id] ?? 0), 0);

  function changerQuantite(type: TypeAchetable, delta: number) {
    const actuelle = quantites[type.id] ?? 0;
    const suivante = Math.max(0, Math.min(actuelle + delta, MAX_PASS_PAR_COMMANDE - (total - actuelle)));
    if (suivante === actuelle) return;
    setQuantites({ ...quantites, [type.id]: suivante });
    setNoms({ ...noms, [type.id]: Array.from({ length: suivante }, (_, i) => noms[type.id]?.[i] ?? "") });
  }

  function changerNom(typeId: string, index: number, valeur: string) {
    setNoms({ ...noms, [typeId]: (noms[typeId] ?? []).map((n, i) => (i === index ? valeur : n)) });
  }

  // Le premier Pass de la première ligne est celui de l'acheteur quand « pour moi » est coché.
  function nomAffiche(typeId: string, index: number): string {
    return noms[typeId]?.[index] ?? "";
  }
  const premierType = choisis[0]?.id ?? null;
  const moiConnu = pourMoi && nomCompte !== null;

  function lignes() {
    return choisis.map((x) => ({
      typePassId: x.id,
      titulaires: Array.from({ length: quantites[x.id] ?? 0 }, (_, i) => (pourMoi && x.id === premierType && i === 0 && nomCompte ? nomCompte : nomAffiche(x.id, i))),
    }));
  }

  function valider(): ChampErreur[] {
    const manques: ChampErreur[] = [];
    if (total === 0) manques.push("aucun");
    else if (lignes().some((l) => l.titulaires.some((n) => !nomValable(n)))) manques.push("nom");
    return manques;
  }

  function modifierLeChoix() {
    setRecap(null);
    setTotalChange(null);
    setErreurServeur(null);
    cle.current = null;
  }

  async function calculer(code: string | null) {
    setErreurServeur(null);
    try {
      const r = await lireRecapitulatifPassAction({ evenementId, lignes: lignes(), pourMoi, code }, locale);
      if (!r.ok) {
        setErreurServeur(r.erreur);
        return;
      }
      setRecap(r.recap);
      if (r.recap.code && !r.recap.code.valide) {
        // Code refusé : il n'est plus envoyé, le total revient sans réduction et la raison s'affiche sous le champ.
        setCodeErreur(r.recap.code.erreur);
        setCodeApplique(null);
      } else {
        setCodeErreur(null);
      }
    } catch {
      setErreurServeur("erreur");
    }
  }

  function voirRecapitulatif() {
    const manques = valider();
    setErreurs(manques);
    if (manques.length > 0) {
      resumeRef.current?.focus();
      return;
    }
    cle.current = null;
    demarrerRecalcul(async () => {
      await calculer(codeApplique);
      resumeRef.current?.focus();
    });
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
    if (!recap) return;
    setErreurServeur(null);
    if (!mention) {
      setErreurs(["mention"]);
      resumeRef.current?.focus();
      return;
    }
    setErreurs([]);
    cle.current ??= crypto.randomUUID();
    const cleIdempotence = cle.current;
    const vu = recap.totalCents;
    demarrer(async () => {
      try {
        const r = await creerCommandePassAction({ evenementId, lignes: lignes(), pourMoi, code: codeApplique, mention: true, totalAttenduCents: vu, cleIdempotence }, locale);
        if (r.ok) {
          // Choix du moyen de paiement : l'écran existant de la Commande (mobile money PawaPay ou MaishaPay, carte MaishaPay).
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
        {totalChange ? (
          <MessageEtat type="attention">{t("totalChange", { ancien: formaterUsd(totalChange.ancien, locale), nouveau: formaterUsd(totalChange.nouveau, locale) })}</MessageEtat>
        ) : null}
      </div>

      {recap === null ? (
        <>
          <section aria-labelledby={`${id}-types`} className="flex flex-col gap-4">
            <h2 id={`${id}-types`} className="t-h2">
              {t("types")}
            </h2>
            <p className="t-body text-text-secondary">{t("intro")}</p>
            <ul className="flex flex-col gap-4">
              {types.map((type) => {
                const n = quantites[type.id] ?? 0;
                return (
                  <li key={type.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="t-h3">{type.nom}</h3>
                      <p className="t-price-card">{formaterUsd(type.prixCents, locale)}</p>
                    </div>
                    {type.inclus ? (
                      <ul className="t-small flex list-disc flex-col gap-1 pl-5 text-text-secondary">
                        {type.inclus
                          .split("\n")
                          .map((ligne) => ligne.trim())
                          .filter((ligne) => ligne !== "")
                          .map((ligne, i) => (
                            <li key={`${i}-${ligne}`}>{ligne}</li>
                          ))}
                      </ul>
                    ) : null}
                    {type.complet ? (
                      <p className="t-label text-text-primary">{t("complet")}</p>
                    ) : (
                      <div role="group" aria-label={t("quantite", { nom: type.nom })} className="flex items-center gap-3">
                        <button type="button" className={BOUTON_COMPTEUR} onClick={() => changerQuantite(type, -1)} disabled={n === 0} aria-label={t("retirer", { nom: type.nom })}>
                          <span aria-hidden="true">{"−"}</span>
                        </button>
                        <output aria-live="polite" className="t-h3 min-w-8 text-center text-text-primary">
                          {n}
                        </output>
                        <button type="button" className={BOUTON_COMPTEUR} onClick={() => changerQuantite(type, 1)} disabled={total >= MAX_PASS_PAR_COMMANDE} aria-label={t("ajouter", { nom: type.nom })}>
                          <span aria-hidden="true">{"+"}</span>
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {total >= MAX_PASS_PAR_COMMANDE ? <p className="t-small text-text-secondary">{t("maxAtteint", { max: MAX_PASS_PAR_COMMANDE })}</p> : null}
          </section>

          {total > 0 ? (
            <section aria-labelledby={`${id}-noms`} className="flex flex-col gap-4">
              <h2 id={`${id}-noms`} className="t-h2">
                {t("noms.titre")}
              </h2>
              <p className="t-body text-text-secondary">{t("noms.aide")}</p>
              <label className="flex min-h-touch cursor-pointer items-center gap-3">
                <input type="checkbox" checked={pourMoi} onChange={(e) => setPourMoi(e.target.checked)} className="size-6 shrink-0" />
                <span className="t-body text-text-primary">{t("noms.moi")}</span>
              </label>
              <ul className="flex flex-col gap-3">
                {choisis.flatMap((type) =>
                  Array.from({ length: quantites[type.id] ?? 0 }, (_, i) => {
                    const estMoi = pourMoi && type.id === premierType && i === 0;
                    const numero = i + 1;
                    return (
                      <li key={`${type.id}-${i}`} className="flex flex-col gap-1">
                        {estMoi && moiConnu ? (
                          <p className="t-body text-text-primary">{t("noms.moiConnu", { nom: nomCompte ?? "", type: type.nom })}</p>
                        ) : (
                          <>
                            <label htmlFor={`${id}-${type.id}-${i}`} className="t-label text-text-primary">
                              {estMoi ? t("noms.moiSaisie", { type: type.nom }) : t("noms.champ", { numero, type: type.nom })}
                            </label>
                            <input
                              id={`${id}-${type.id}-${i}`}
                              type="text"
                              autoComplete={estMoi ? "name" : "off"}
                              maxLength={200}
                              value={nomAffiche(type.id, i)}
                              onChange={(e) => changerNom(type.id, i, e.target.value)}
                              aria-invalid={erreurs.includes("nom") && !nomValable(nomAffiche(type.id, i)) ? true : undefined}
                              className={CHAMP}
                            />
                          </>
                        )}
                      </li>
                    );
                  }),
                )}
              </ul>
            </section>
          ) : null}

          <div>
            <Bouton onClick={voirRecapitulatif} enCours={recalcul}>
              {recalcul ? t("enCours") : t("voirRecap")}
            </Bouton>
          </div>
        </>
      ) : (
        <>
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
            <ul aria-label={t("recap.liste")} className="flex flex-col gap-3">
              {recap.lignes.map((l) => (
                <li key={l.typePassId} className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <p className="t-label text-text-primary">{t("recap.ligne", { nombre: l.nombre, nom: l.nom })}</p>
                  <p className="t-body text-text-primary">{t("recap.prixUnite", { prix: formaterUsd(l.prixCents, locale) })}</p>
                  <p className="t-small text-text-secondary">{t("recap.noms", { noms: l.titulaires.join(", ") })}</p>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-2">
              <div className="flex justify-between gap-4">
                <dt className="t-body text-text-primary">{t("recap.sousTotal")}</dt>
                <dd className="t-body text-text-primary">{formaterUsd(recap.sousTotalCents, locale)}</dd>
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
            <Bouton variante="secondaire" onClick={modifierLeChoix}>
              {t("modifier")}
            </Bouton>
          </div>
        </>
      )}

      <Link href={`/festival/${slug}`} className="t-small inline-flex min-h-touch items-center text-text-primary underline">
        {t("retourEvenement")}
      </Link>
    </div>
  );
}
