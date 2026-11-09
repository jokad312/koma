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

  async function agir(id: string, action: Action) {
    if (enVol.current) return;
    enVol.current = true;
    setEnCours({ id, action });
    setAConfirmer(null);
    setRetour(null);
    try {
      const appel = action === "valider" ? validerPhotoAction : action === "refuser" ? refuserPhotoAction : retirerPhotoAdminAction;
      const r = await appel({ id });
      if (r.ok) {
        setRetour({ type: "succes", texte: t(`succes.${action}`) });
        router.refresh();
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

  const aValider = photos.filter((p) => p.statut === "en_attente");
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
          {p.retraitDemande ? <p className="t-label text-text-primary">{t("retraitDemande")}</p> : null}
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
      {section("galerie-retraits", t("retraits.titre", { nombre: retraits.length }), t("retraits.vide"), retraits, ["retirer"])}
      {section("galerie-publiees", t("publiees.titre", { nombre: publiees.length }), t("publiees.vide"), publiees, ["retirer"])}
    </div>
  );
}
