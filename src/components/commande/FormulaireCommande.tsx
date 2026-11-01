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
import type { CodeErreurCommande, Recapitulatif } from "@/modules/commande/types";
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

  function relire(z: ZoneRemise | null, m: ModeRemise | null) {
    demarrerRecalcul(async () => {
      try {
        const r = await lireRecapitulatif({ zone: z, mode: m }, locale);
        if (r.ok) setRecap(r.recap);
        else if (r.erreur === "panier_vide") router.push("/panier");
        else setErreurServeur(r.erreur);
      } catch {
        setErreurServeur("erreur");
      }
    });
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
