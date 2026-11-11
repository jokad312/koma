import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { droitAutorise, exigerConnectePage } from "@/lib/auth/droits";
import { lireEvenementsDeLAccesBenevole, lireEvenementsScannables } from "@/modules/scan/queries";
import type { EvenementScannable } from "@/modules/scan/types";
import { EcranScan } from "./EcranScan";

// Droit vérifié sur la page elle-même (visiteur : connexion avec retour). L'Admin voit les Événements publiés, à venir ou du jour. Un bénévole (story 7.7)
// ne voit QUE l'Événement de son accès, valable maintenant d'après la base ; sans aucun accès, la page est un 404 comme pour tout Compte sans droit ;
// avec un accès pas encore ouvert ou terminé, un message clair. Le serveur revérifie l'accès à chaque scan : ce choix d'affichage n'ouvre aucun droit.
export async function ScanSelonDroit({ locale, chemin }: { locale: Locale; chemin: string }) {
  const { compteId, role } = await exigerConnectePage(locale, chemin);
  const t = await getTranslations("Scan");
  const estAdmin = droitAutorise(role, "pass.scanner");
  let evenements: EvenementScannable[] | null = null;
  // Compte sans droit : une lecture en échec donne le 404, jamais un écran d'erreur (qui révélerait la page).
  let accesConnus = estAdmin;
  try {
    if (estAdmin) {
      evenements = await lireEvenementsScannables(locale === "en" ? "en" : "fr");
    } else {
      const lecture = await lireEvenementsDeLAccesBenevole(locale === "en" ? "en" : "fr", compteId);
      evenements = lecture.evenements;
      accesConnus = lecture.accesConnus;
    }
  } catch {
    console.error("[scan] lecture des événements impossible");
  }
  // Compte sans droit et sans aucun accès : 404, comme partout ailleurs.
  if (!accesConnus) notFound();
  const accesTermine = !estAdmin && evenements !== null && evenements.length === 0;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="t-h1">{t("titre")}</h1>
      {evenements === null ? (
        <MessageEtat type="erreur">{t("evenement.erreurLecture")}</MessageEtat>
      ) : accesTermine ? (
        <MessageEtat type="attention">{t("acces.indisponible")}</MessageEtat>
      ) : (
        <EcranScan evenements={evenements} benevole={!estAdmin} />
      )}
      {estAdmin ? (
        <Link href="/admin" className="t-small text-text-secondary underline">
          {t("retourAdmin")}
        </Link>
      ) : null}
    </div>
  );
}
