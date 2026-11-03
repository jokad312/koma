import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { formaterUsd } from "@/lib/argent";
import { formaterDateBoutique } from "@/lib/dates";
import { listerCommandes, TAILLE_PAGE_COMMANDES } from "@/modules/commande/queries";
import { versConnexion } from "./PageCommande";

const CLASSES_LIEN = "t-body inline-flex min-h-touch items-center text-text-primary underline";

// « Mes commandes » (story 6.1) : seules les Commandes du Compte connecté, lues côté serveur par son identifiant. « Voir plus » ajoute 12 Commandes.
export async function ListeCommandes({ locale, nombre }: { locale: Locale; nombre: number }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Commande" });
  const retour = `/${locale}${cheminPublic(locale, "/compte/commandes")}`;
  const etat = await lireEtatCompte();
  if (etat === "anonyme" || etat === "incomplet") versConnexion(locale, retour);
  const session = await lireSessionVerifiee();
  if (!session) versConnexion(locale, retour);

  let lue;
  try {
    lue = await listerCommandes(session.compteId, nombre);
  } catch {
    console.error("[commande] lecture de la liste impossible");
    return <MessageEtat type="erreur">{t("erreurs.erreur")}</MessageEtat>;
  }
  if (lue.commandes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="t-body text-text-primary">{t("liste.vide")}</p>
        <Link href={cheminPublic(locale, "/cosplays")} className={CLASSES_LIEN}>
          {t("liste.versCatalogues")}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t("liste.titre")} className="flex flex-col gap-3">
        {lue.commandes.map((c) => (
          <li key={c.numero} className="rounded-lg border border-border bg-surface p-4">
            <Link href={`${cheminPublic(locale, "/commande")}/${c.numero}`} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
              {t("liste.commande", { numero: c.numero })}
            </Link>
            <p className="t-small text-text-secondary">{formaterDateBoutique(c.creeLe, locale)}</p>
            <p className="t-body text-text-primary">{t("detail.statut", { statut: t(`detail.statuts.${c.statut}`) })}</p>
            <p className="t-body text-text-primary">{c.offerte ? t("liste.offert") : formaterUsd(c.totalCents, locale)}</p>
          </li>
        ))}
      </ul>
      {lue.reste ? (
        <Link href={`${cheminPublic(locale, "/compte/commandes")}?n=${nombre + TAILLE_PAGE_COMMANDES}`} className={CLASSES_LIEN}>
          {t("liste.voirPlus")}
        </Link>
      ) : null}
    </div>
  );
}
