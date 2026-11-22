import { getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { lireMesuresARecevoir, type MesuresARecevoir } from "@/modules/commande/admin-queries";
import { CLASSES_PANNEAU, CLASSES_TITRE_PANNEAU } from "./ui/Panneau";
import { nb } from "@/components/ui/Nombre";

// Tâche « Mesures à recevoir » (story 6.5) : compteur réel et lien vers chaque Commande. Lecture impossible : message d'erreur, jamais un faux zéro.
export async function TacheMesuresARecevoir() {
  const t = await getTranslations("Admin.taches.mesures");
  let lue: { total: number; commandes: MesuresARecevoir[] } | null = null;
  try {
    lue = await lireMesuresARecevoir();
  } catch {
    console.error("[commande] lecture des mesures à recevoir impossible");
  }
  if (!lue) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  return (
    <section aria-labelledby="tache-mesures" className={`flex flex-col gap-3 ${CLASSES_PANNEAU}`}>
      <h2 id="tache-mesures" className={CLASSES_TITRE_PANNEAU}>
        {t("titre")}
      </h2>
      <p role="status" className="t-h3 text-text-primary">
        {t.rich("compteur", { nombre: lue.total, nb })}
      </p>
      {lue.commandes.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {lue.commandes.map((c) => (
            <li key={c.numero}>
              <Link href={`/admin/commandes/${c.numero}`} className="t-body inline-flex min-h-touch items-center text-text-primary underline">
                {t.rich("commande", { numero: c.numero, nombre: c.lignes, nb })}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
