import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { versConnexion } from "@/components/commande/PageCommande";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireEtatCompte, lireSessionVerifiee } from "@/lib/auth/compte";
import { formaterDateBoutique } from "@/lib/dates";
import { grouperParEvenement } from "@/modules/evenements/pass-groupes";
import { listerMesPass } from "@/modules/evenements/pass-queries";
import { CartePass } from "./CartePass";

const CLASSES_LIEN = "t-body inline-flex min-h-touch items-center text-text-primary underline";

// « Mes Pass » (story 7.5) : seuls les Pass des Commandes du Compte connecté, lus côté serveur par son identifiant, regroupés par Événement
// (à venir d'abord). Les Pass n'existent qu'une fois le paiement confirmé par le serveur : rien n'est affiché avant.
export async function ListeMesPass({ locale }: { locale: Locale }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Pass" });
  const retour = `/${locale}/compte/pass`;
  const etat = await lireEtatCompte();
  if (etat === "anonyme" || etat === "incomplet") versConnexion(locale, retour);
  const session = await lireSessionVerifiee();
  if (!session) versConnexion(locale, retour);

  let pass;
  try {
    pass = await listerMesPass(session.compteId, locale);
  } catch {
    console.error("[pass] lecture de Mes Pass impossible");
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }
  if (pass.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="t-body text-text-primary">{t("vide")}</p>
        <Link href="/festival" className={CLASSES_LIEN}>
          {t("versFestival")}
        </Link>
      </div>
    );
  }
  const groupes = grouperParEvenement(pass);
  return (
    <div className="flex flex-col gap-8">
      <p className="t-body text-text-secondary">{t("intro")}</p>
      {groupes.map((g) => {
        const date = formaterDateBoutique(g.evenement.debutLe, locale);
        return (
          <section key={g.evenement.id} aria-labelledby={`evt-${g.evenement.id}`} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 id={`evt-${g.evenement.id}`} className="t-h2">
                {g.evenement.titre}
              </h3>
              <p className="t-small text-text-secondary">
                {g.avenir ? t("avenir") : t("passe")}
                {date ? ` · ${date}` : ""}
              </p>
            </div>
            <ul className="grid gap-4 md:grid-cols-2">
              {g.pass.map((p) => (
                <li key={p.id}>
                  <CartePass pass={p} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
