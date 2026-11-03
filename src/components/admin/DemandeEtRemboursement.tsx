"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { confirmerRemboursementAction, traiterDemandeAction } from "@/modules/commande/admin-actions";
import type { ErreurAdminCommande } from "@/modules/commande/admin-service";

const ERREURS_CONNUES = ["non_autorise", "annulation_impossible", "demande_introuvable", "demande_deja_traitee", "preuve_requise", "remboursement_impossible"] as const;
const erreurAffichee = (e: ErreurAdminCommande) => ((ERREURS_CONNUES as readonly string[]).includes(e) ? e : "generique");

// Demande d'annulation ouverte : accepter (la Commande est annulée, le montant à rendre est figé) ou refuser (la Commande ne change pas).
export function DecisionDemande({ demandeId }: { demandeId: string }) {
  const t = useTranslations("Admin.commandes.annulation");
  const router = useRouter();
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [enCours, lancer] = useTransition();
  function decider(decision: "accepter" | "refuser") {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await traiterDemandeAction({ demandeId, decision });
        if (r.ok) router.refresh();
        else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Bouton enCours={enCours} onClick={() => decider("accepter")}>
          {t("accepter")}
        </Bouton>
        <Bouton variante="secondaire" enCours={enCours} onClick={() => decider("refuser")}>
          {t("refuser")}
        </Bouton>
      </div>
      {erreur ? <MessageEtat type="erreur">{t(`erreurs.${erreurAffichee(erreur)}`)}</MessageEtat> : null}
    </div>
  );
}

// Confirmation d'un remboursement fait à la main : la preuve est obligatoire ; sans elle, un résumé d'erreur s'affiche et rien n'est enregistré (UX-DR44).
export function FormulaireRemboursement({ cibleType, cibleId }: { cibleType: "commande" | "trop_percu"; cibleId: string }) {
  const t = useTranslations("Admin.commandes.remboursement");
  const ta = useTranslations("Admin.commandes.annulation");
  const id = useId();
  const router = useRouter();
  const [preuve, setPreuve] = useState("");
  const [erreur, setErreur] = useState<ErreurAdminCommande | null>(null);
  const [enCours, lancer] = useTransition();
  function confirmer() {
    setErreur(null);
    lancer(async () => {
      try {
        const r = await confirmerRemboursementAction({ cibleType, cibleId, preuve });
        if (r.ok) router.refresh();
        else setErreur(r.erreur);
      } catch {
        setErreur("generique");
      }
    });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        confirmer();
      }}
      className="flex flex-col gap-2"
    >
      {erreur ? (
        <div role="alert" tabIndex={-1} className="rounded-md border border-border-field p-3">
          <p className="t-label text-text-primary">{ta("resumeErreur")}</p>
          <a href={`#${id}-preuve`} className="t-body text-text-primary underline">
            {ta(`erreurs.${erreurAffichee(erreur)}`)}
          </a>
        </div>
      ) : null}
      <label htmlFor={`${id}-preuve`} className="t-small text-text-primary">
        {t("preuve")}
      </label>
      <input
        id={`${id}-preuve`}
        type="text"
        maxLength={200}
        value={preuve}
        onChange={(e) => setPreuve(e.target.value)}
        aria-describedby={`${id}-aide`}
        {...(erreur === "preuve_requise" ? { "aria-invalid": true } : {})}
        className="min-h-touch rounded-md border border-border-field bg-surface px-3"
      />
      <p id={`${id}-aide`} className="t-small text-text-secondary">
        {t("aide")}
      </p>
      <div>
        <Bouton type="submit" enCours={enCours}>
          {t("confirmer")}
        </Bouton>
      </div>
    </form>
  );
}
