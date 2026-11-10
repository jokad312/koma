import { getLocale, getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/modules/tableau-de-bord/calculs";
import type { CommandePayee, Zone } from "@/modules/tableau-de-bord/queries";

const PRESTATAIRES = ["pawapay", "maishapay", "polar"] as const;
// Plafond de tableau_commandes_payees (limit 200 dans la fonction SQL).
const PLAFOND_COMMANDES = 200;
const FAMILLES = ["cosplay", "accessoire", "kit", "pass", "livraison"] as const;

// Nouvelles Commandes payées : numéro, montant en USD, Prestataire, Familles. Aucune donnée de client. Lecture impossible : message
// d'erreur (jamais « aucune commande »). Sans commande : phrase d'état vide avec le lien vers les 7 derniers jours (UX-DR44).
export async function CommandesPayees({ commandes, septJours }: { commandes: Zone<CommandePayee[]>; septJours: boolean }) {
  const t = await getTranslations("Admin.tableau.commandes");
  const te = await getTranslations("Admin.tableau");
  const locale = await getLocale();
  return (
    <section aria-labelledby="tableau-commandes" className="flex flex-col gap-3">
      <h2 id="tableau-commandes" className="t-h2">
        {septJours ? t("titreSept") : t("titre")}
      </h2>
      {commandes === null ? (
        <MessageEtat type="erreur">{te("erreurLecture")}</MessageEtat>
      ) : commandes.length === 0 ? (
        <p className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{septJours ? t("videSept") : t("vide")}</p>
      ) : (
        <ul className="flex flex-col gap-ecart-cartes">
          {commandes.map((c) => (
            <li key={c.numero} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
              <Link href={`/admin/commandes/${c.numero}`} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                {t("ouvrir", { numero: c.numero })}
              </Link>
              <p className="t-body text-text-secondary">
                {t("ligne", {
                  montant: formaterUsd(c.totalCents, locale),
                  prestataire: (PRESTATAIRES as readonly string[]).includes(c.prestataire) ? te(`prestataires.${c.prestataire as (typeof PRESTATAIRES)[number]}`) : c.prestataire,
                  familles: new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(c.familles.map((f) => ((FAMILLES as readonly string[]).includes(f) ? te(`familles.${f as (typeof FAMILLES)[number]}`) : f))),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {commandes !== null && commandes.length >= PLAFOND_COMMANDES ? <p className="t-small text-text-secondary">{t("plafond", { nombre: PLAFOND_COMMANDES })}</p> : null}
      {commandes !== null && commandes.length === 0 ? (
        <Link href={septJours ? "/admin" : "/admin?periode=7"} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
          {septJours ? t("lienAujourdhui") : t("lienSept")}
        </Link>
      ) : null}
    </section>
  );
}
