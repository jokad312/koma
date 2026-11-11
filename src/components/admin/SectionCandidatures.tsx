"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link, useRouter } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { MOTIF_REFUS_MAX, type CandidatureAdmin, type ErreurRefusCandidature } from "@/modules/evenements/candidatures-admin";
import { refuserCandidatureStandAction } from "@/modules/evenements/candidatures-admin-actions";

// Adresse Instagram affichable en lien : @pseudo ou lien instagram.com ; toute autre forme reste du texte (jamais un lien arbitraire).
function lienInstagram(valeur: string): string | null {
  const pseudo = /^@([A-Za-z0-9._]{1,30})$/.exec(valeur);
  if (pseudo) return `https://www.instagram.com/${pseudo[1]}/`;
  return /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?(\?\S{0,100})?$/.test(valeur) ? valeur : null;
}

function Candidature({ c }: { c: CandidatureAdmin }) {
  const t = useTranslations("Admin.evenements.candidatures");
  const locale = useLocale() === "en" ? "en" : "fr";
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [retour, setRetour] = useState<{ type: "ok"; montantCents: number } | { type: "erreur"; erreur: ErreurRefusCandidature } | null>(null);
  const [enCours, demarrer] = useTransition();
  const instagram = c.instagram ? lienInstagram(c.instagram) : null;
  const echeance = formaterDateHeureBoutique(c.expireLe, locale);

  function refuser() {
    setRetour(null);
    demarrer(async () => {
      try {
        const r = await refuserCandidatureStandAction({ candidatureId: c.id, motif });
        if (r.ok) {
          setRetour({ type: "ok", montantCents: r.montantCents });
          setOuvert(false);
          router.refresh();
        } else {
          setRetour({ type: "erreur", erreur: r.erreur });
        }
      } catch {
        setRetour({ type: "erreur", erreur: "generique" });
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="t-label">
        {`${c.typeNom} · ${t(`etat.${c.etat}`)}${c.etat === "acceptee" && echeance ? ` · ${t("jusqua", { date: echeance })}` : ""}`}
      </p>
      <p className="t-small text-text-secondary">{c.email ?? t("compteInconnu")}</p>
      {c.description ? <p className="t-body whitespace-pre-line">{c.description}</p> : null}
      {instagram ? (
        <p className="t-small">
          {t("instagram")}{" "}
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-touch items-center underline">
            {c.instagram}
          </a>
        </p>
      ) : c.instagram ? (
        <p className="t-small">
          {t("instagram")} {c.instagram}
        </p>
      ) : null}
      {c.photosPurgees ? <p className="t-small text-text-secondary">{t("photosPurgees")}</p> : null}
      {c.photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {c.photos.map((url, i) => (
            <li key={i}>
              {/* Lien signé de courte durée vers le bucket privé : <img> assumé (pas d'optimisation Next possible). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={t("photoAlt", { n: i + 1 })} className="aspect-square w-full rounded-md object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {c.etat === "refusee" && c.motifRefus ? <p className="t-small">{t("motifRefus", { motif: c.motifRefus })}</p> : null}
      {c.etat !== "refusee" ? (
        ouvert ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              refuser();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor={`${id}-motif`} className="t-label">
              {t("motif")}
            </label>
            <textarea
              id={`${id}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={MOTIF_REFUS_MAX}
              rows={3}
              aria-describedby={`${id}-aide`}
              className="rounded-md border border-border-field bg-surface px-3 py-2"
            />
            <p id={`${id}-aide`} className="t-small text-text-secondary">
              {c.etat === "payee" ? t("aideRefusPaye") : t("aideRefus")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Bouton type="submit" enCours={enCours}>
                {t("confirmerRefus")}
              </Bouton>
              <Bouton type="button" variante="secondaire" onClick={() => setOuvert(false)}>
                {t("annuler")}
              </Bouton>
            </div>
          </form>
        ) : (
          <div>
            <Bouton type="button" variante="secondaire" onClick={() => setOuvert(true)}>
              {t("refuser")}
            </Bouton>
          </div>
        )
      ) : null}
      {retour?.type === "ok" ? (
        <MessageEtat type="succes">
          {retour.montantCents > 0 ? t("refuseRembourser", { montant: formaterUsd(retour.montantCents, locale) }) : t("refuse")}{" "}
          {retour.montantCents > 0 ? (
            <Link href="/admin/taches" className="inline-flex min-h-touch items-center underline">
              {t("lienTaches")}
            </Link>
          ) : null}
        </MessageEtat>
      ) : null}
      {retour?.type === "erreur" ? <MessageEtat type="erreur">{t(`erreurs.${retour.erreur}`)}</MessageEtat> : null}
    </li>
  );
}

// Section « Candidatures Stand » de la page d'un Événement (story 7.11, Admin seulement) : les candidatures sont acceptées automatiquement ;
// l'Admin peut en refuser une après coup (avant ou après paiement). Photos et Instagram ne sont visibles que d'ici.
export function SectionCandidatures({ candidatures }: { candidatures: CandidatureAdmin[] }) {
  const t = useTranslations("Admin.evenements.candidatures");
  const id = useId();
  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id={`${id}-titre`} className="t-h3">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      {candidatures.length === 0 ? (
        <p className="t-body">{t("vide")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidatures.map((c) => (
            <Candidature key={c.id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
