"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { useRouter } from "@/i18n/navigation";
import { donnerAccesBenevoleAction, retirerAccesBenevoleAction, type EtatAttributionBenevole } from "@/modules/benevoles/actions";
import type { AccesBenevole, CodeErreurBenevole } from "@/modules/benevoles/types";

const CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

// Jour (fuseau de Goma) : la fenêtre de la base va de minuit à minuit ; le dernier jour est celui de l'instant juste avant la fin.
function formaterJour(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Africa/Lubumbashi" }).format(new Date(iso));
}

// Section « Bénévoles » de la page d'un Événement (story 7.7, FR-37) : donner l'accès au Scan de CET Événement à l'email d'un bénévole, et retirer un
// accès. Réservée à l'Admin (la page et la base revérifient le droit). Le succès n'apparaît qu'après la réponse réelle du serveur.
export function SectionBenevoles({ evenementId, acces }: { evenementId: string; acces: AccesBenevole[] }) {
  const t = useTranslations("Admin.evenements.benevoles");
  const locale = useLocale();
  const router = useRouter();
  const idChamp = useId();
  const idAide = useId();
  const idErreur = useId();
  const refChamp = useRef<HTMLInputElement>(null);
  const [etat, action, enCours] = useActionState<EtatAttributionBenevole | null, FormData>(donnerAccesBenevoleAction, null);
  // Champ contrôlé : la saisie reste après un échec ou un « sans compte », et se vide après un accès enregistré.
  const [saisie, setSaisie] = useState("");
  const [dernierEtat, setDernierEtat] = useState(etat);
  if (etat !== dernierEtat) {
    setDernierEtat(etat);
    if (etat) setSaisie(etat.statut === "succes" && etat.resultat !== "sans_compte" ? "" : etat.email);
  }
  const [retrait, setRetrait] = useState<{ type: "ok" } | { type: "erreur"; erreur: CodeErreurBenevole } | null>(null);
  const [retraitEnCours, demarrerRetrait] = useTransition();
  const enVol = useRef(false);

  const reussi = etat?.statut === "succes" && etat.resultat !== "sans_compte";
  useEffect(() => {
    if (reussi) router.refresh();
  }, [reussi, etat, router]);
  // Après un échec ou un « sans compte », le focus revient sur le champ.
  useEffect(() => {
    if (etat && !reussi) refChamp.current?.focus();
  }, [etat, reussi]);

  function retirer(accesId: string) {
    if (enVol.current) return;
    enVol.current = true;
    setRetrait(null);
    demarrerRetrait(async () => {
      try {
        const r = await retirerAccesBenevoleAction({ evenementId, accesId });
        if (r.statut === "succes") {
          setRetrait({ type: "ok" });
          router.refresh();
          // Le bouton Retirer disparaît avec sa ligne : le focus revient à un élément stable (le champ email).
          refChamp.current?.focus();
        } else {
          setRetrait({ type: "erreur", erreur: r.erreur });
        }
      } catch {
        setRetrait({ type: "erreur", erreur: "generique" });
      } finally {
        enVol.current = false;
      }
    });
  }

  const erreurChamp = etat?.statut === "erreur" && etat.erreur === "email_invalide";
  const erreurAutre = etat?.statut === "erreur" && etat.erreur !== "email_invalide" ? etat.erreur : null;
  const libelleJour = (a: AccesBenevole) => {
    const debut = formaterJour(a.valableDu, locale);
    const fin = formaterJour(new Date(new Date(a.valableJusquAu).getTime() - 1).toISOString(), locale);
    return debut === fin ? t("liste.jour", { jour: debut }) : t("liste.jours", { debut, fin });
  };
  const libelleStatut = (a: AccesBenevole) => t(`liste.${a.etat === "valide" ? "valide" : a.etat === "avenir" ? "avenir" : "termine"}`);

  return (
    <section aria-labelledby="admin-benevoles" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="admin-benevoles" className="t-h3">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      <p className="t-small text-text-secondary">{t("aideFin")}</p>
      <p className="t-small text-text-secondary">{t("prerequis")}</p>

      <form action={action} className="flex max-w-md flex-col items-start gap-3">
        <input type="hidden" name="evenementId" value={evenementId} />
        <label htmlFor={idChamp} className="t-label text-text-primary">
          {t("champ.libelle")}
        </label>
        <p id={idAide} className="t-small text-text-secondary">
          {t("champ.aide")}
        </p>
        <input
          ref={refChamp}
          id={idChamp}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-invalid={erreurChamp || undefined}
          aria-describedby={erreurChamp ? `${idAide} ${idErreur}` : idAide}
          className={CHAMP}
        />
        {erreurChamp ? (
          <p id={idErreur} role="alert" className="t-small text-danger">
            {t("erreurs.email_invalide")}
          </p>
        ) : null}
        <Bouton type="submit" enCours={enCours}>
          {enCours ? t("enCours") : t("donner")}
        </Bouton>
      </form>

      {erreurAutre ? <MessageEtat type="erreur">{t(`erreurs.${erreurAutre}`)}</MessageEtat> : null}
      {etat?.statut === "succes" && etat.resultat === "sans_compte" ? <MessageEtat type="attention">{t("sansCompte")}</MessageEtat> : null}
      {etat?.statut === "succes" && etat.resultat !== "sans_compte" ? <MessageEtat type="succes">{t(`succes.${etat.resultat}`, { email: etat.email.trim().toLowerCase() })}</MessageEtat> : null}

      <h3 className="t-label mt-2">{t("liste.titre")}</h3>
      {acces.length === 0 ? (
        <p className="t-small text-text-secondary">{t("liste.vide")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {acces.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="t-body break-all font-bold">{a.email}</span>
                <span className="t-small text-text-secondary">
                  {`${libelleJour(a)} · ${libelleStatut(a)}`}
                </span>
              </div>
              <Bouton variante="secondaire" enCours={retraitEnCours} onClick={() => retirer(a.id)} aria-label={t("liste.retirerPour", { email: a.email })}>
                {t("liste.retirer")}
              </Bouton>
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite">
        {retrait?.type === "ok" ? <MessageEtat type="succes">{t("liste.retire")}</MessageEtat> : null}
        {retrait?.type === "erreur" ? <MessageEtat type="erreur">{t(`erreurs.${retrait.erreur}`)}</MessageEtat> : null}
      </div>
    </section>
  );
}
