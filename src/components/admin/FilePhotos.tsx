"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterDateBoutique } from "@/lib/dates";
import { refuserPhotoAction, retirerPhotoAdminAction, validerPhotoAction } from "@/modules/communaute/admin-actions";
import type { PhotoAdmin } from "@/modules/communaute/admin-types";
import { ChampTexte } from "./ChampTexte";

type Action = "valider" | "refuser" | "retirer";

// File de la page « Galerie » (story 8.2) : photos à valider, retraits demandés, puis photos publiées. « Refuser » et « Retirer » sont
// irréversibles : une confirmation est demandée. Chaque décision n'est annoncée qu'après la réponse réelle du serveur (règle 13), dans une
// zone d'état hors de la liste (la carte peut disparaître quand la liste est relue).
export function FilePhotos({ photos }: { photos: PhotoAdmin[] }) {
  const t = useTranslations("Admin.galerie");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [enCours, setEnCours] = useState<{ id: string; action: Action } | null>(null);
  const [aConfirmer, setAConfirmer] = useState<{ id: string; action: Action } | null>(null);
  const [retour, setRetour] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);
  const enVol = useRef(false);
  // Textes alternatifs saisis avant « Valider et publier » (règle 7), propres à chaque photo ; jamais perdus en cas d'erreur.
  const [alts, setAlts] = useState<Record<string, { fr: string; en: string }>>({});
  const [altManquant, setAltManquant] = useState<{ id: string; champ: "fr" | "en" } | null>(null);
  const altDe = (id: string) => alts[id] ?? { fr: "", en: "" };
  const saisirAlt = (id: string, champ: "fr" | "en", valeur: string) => {
    setAlts((a) => ({ ...a, [id]: { ...(a[id] ?? { fr: "", en: "" }), [champ]: valeur } }));
    if (altManquant?.id === id && altManquant.champ === champ) setAltManquant(null);
  };

  async function agir(id: string, action: Action) {
    if (enVol.current) return;
    const alt = altDe(id);
    if (action === "valider") {
      const invalide = (v: string) => v.trim() === "" || [...v.trim()].length > 200;
      const champ = invalide(alt.fr) ? "fr" : invalide(alt.en) ? "en" : null;
      if (champ) {
        setAltManquant({ id, champ });
        document.getElementById(`galerie-alt-${champ}-${id}`)?.focus();
        return;
      }
    }
    enVol.current = true;
    setEnCours({ id, action });
    setAConfirmer(null);
    setRetour(null);
    try {
      const r =
        action === "valider"
          ? await validerPhotoAction({ id, altFr: alt.fr, altEn: alt.en })
          : action === "refuser"
            ? await refuserPhotoAction({ id })
            : await retirerPhotoAdminAction({ id });
      if (r.ok) {
        setRetour({ type: "succes", texte: t(`succes.${action}`) });
        router.refresh();
      } else if (r.erreur === "alt_invalide") {
        // Refus du serveur (caractère invisible, par exemple) : le champ est signalé et reçoit le focus, la saisie est gardée.
        setAltManquant({ id, champ: "fr" });
        document.getElementById(`galerie-alt-fr-${id}`)?.focus();
      } else {
        setRetour({ type: "erreur", texte: t.has(`erreurs.${r.erreur}`) ? t(`erreurs.${r.erreur}`) : t("erreurs.generique") });
      }
    } catch {
      setRetour({ type: "erreur", texte: t("erreurs.generique") });
    } finally {
      enVol.current = false;
      setEnCours(null);
    }
  }

  const aValider = photos.filter((p) => p.statut === "en_attente" && !p.realisation);
  const realisations = photos.filter((p) => p.statut === "en_attente" && p.realisation);
  const retraits = photos.filter((p) => p.statut === "publiee" && p.retraitDemande);
  const publiees = photos.filter((p) => p.statut === "publiee" && !p.retraitDemande);
  const occupe = enCours !== null;

  const carte = (p: PhotoAdmin, actions: Action[]) => {
    const date = formaterDateBoutique(p.creeLe, locale) ?? "";
    const confirmation = aConfirmer?.id === p.id ? aConfirmer.action : null;
    return (
      <li key={p.id} className="flex flex-wrap items-start gap-4 rounded-lg border border-border bg-surface p-4">
        {p.apercu ? (
          // Aperçu signé de courte durée (photo en attente) ou adresse publique : pas d'optimisation d'image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.apercu} alt={t("alt", { date })} width={128} height={128} className="size-32 rounded-md object-cover" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="t-label text-text-primary">{p.source === "whatsapp" ? t("source.whatsapp") : t("source.compte")}</p>
          <p className="t-small text-text-secondary">{t("recueLe", { date })}</p>
          <p className="t-small text-text-secondary">{p.nomAffiche ? t("pseudo", { nom: p.nomAffiche }) : t("sansPseudo")}</p>
          <p className="t-small text-text-secondary">{p.ville ? t("ville", { ville: p.ville }) : t("sansVille")}</p>
          {p.accordWhatsappLe ? <p className="t-small text-text-secondary">{t("accordWhatsapp", { date: formaterDateBoutique(p.accordWhatsappLe, locale) ?? p.accordWhatsappLe })}</p> : null}
          {p.capture ? <p className="t-small text-text-secondary">{t("captureJointe")}</p> : null}
          {p.realisation ? (
            <>
              <p className="t-label text-text-primary">{t("realisation.kit", { kit: locale === "en" && p.realisation.kitEn ? p.realisation.kitEn : p.realisation.kitFr })}</p>
              <p className="t-small text-text-secondary">
                {t("realisation.preuve", { commande: p.realisation.commande, date: formaterDateBoutique(p.realisation.payeLe, locale) ?? p.realisation.payeLe })}
              </p>
              {p.realisation.rang ? <p className="t-small text-text-secondary">{t("realisation.rang", { rang: p.realisation.rang })}</p> : null}
            </>
          ) : null}
          {p.retraitDemande ? <p className="t-label text-text-primary">{t("retraitDemande")}</p> : null}
          {actions.includes("valider") ? (
            <div className="mt-2 flex flex-col gap-3">
              {(["fr", "en"] as const).map((champ) => (
                <ChampTexte
                  key={champ}
                  id={`galerie-alt-${champ}-${p.id}`}
                  name={`alt_${champ}`}
                  libelle={t(`altSaisie.${champ}.libelle`)}
                  aide={t(`altSaisie.${champ}.aide`)}
                  valeur={altDe(p.id)[champ]}
                  onChange={(v) => saisirAlt(p.id, champ, v)}
                  erreur={altManquant?.id === p.id && altManquant.champ === champ ? t("erreurs.alt_invalide") : null}
                />
              ))}
            </div>
          ) : null}
          {confirmation ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="t-small text-text-primary">{t(`confirmation.${confirmation}`)}</p>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="secondaire" onClick={() => agir(p.id, confirmation)} enCours={enCours?.id === p.id}>
                  {t(`confirmation.oui.${confirmation}`)}
                </Bouton>
                <Bouton variante="secondaire" onClick={() => setAConfirmer(null)}>
                  {t("confirmation.non")}
                </Bouton>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {actions.map((a) => (
                <Bouton
                  key={a}
                  variante={a === "valider" ? "principal" : "secondaire"}
                  onClick={() => (a === "valider" ? agir(p.id, a) : !occupe && setAConfirmer({ id: p.id, action: a }))}
                  enCours={enCours?.id === p.id && enCours.action === a}
                  aria-disabled={occupe || undefined}
                  aria-label={t(`actions.${a}Photo`, { date })}
                >
                  {t(`actions.${a}`)}
                </Bouton>
              ))}
            </div>
          )}
        </div>
      </li>
    );
  };

  const section = (id: string, titre: string, vide: string, liste: PhotoAdmin[], actions: Action[]) => (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="t-h2">
        {titre}
      </h2>
      {liste.length === 0 ? <p className="t-body text-text-secondary">{vide}</p> : <ul className="flex flex-col gap-3">{liste.map((p) => carte(p, actions))}</ul>}
    </section>
  );

  return (
    <div className="flex flex-col gap-8">
      <div role="status" aria-live="polite">
        {retour ? <MessageEtat type={retour.type}>{retour.texte}</MessageEtat> : null}
      </div>
      {section("galerie-a-valider", t("aValider.titre", { nombre: aValider.length }), t("aValider.vide"), aValider, ["valider", "refuser"])}
      {section("galerie-realisations", t("realisations.titre", { nombre: realisations.length }), t("realisations.vide"), realisations, ["valider", "refuser"])}
      {section("galerie-retraits", t("retraits.titre", { nombre: retraits.length }), t("retraits.vide"), retraits, ["retirer"])}
      {section("galerie-publiees", t("publiees.titre", { nombre: publiees.length }), t("publiees.vide"), publiees, ["retirer"])}
    </div>
  );
}
