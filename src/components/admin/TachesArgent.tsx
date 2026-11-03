import { getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { lireTachesRemboursement, type TacheRemboursement } from "@/modules/commande/admin-queries";

// Tâches d'argent (story 6.6) : demandes d'annulation ouvertes, remboursements à confirmer, Trop-perçus à rembourser. Chaque ligne mène à la Commande.
// Lecture impossible : message d'erreur, jamais une liste vide qui laisserait croire qu'il n'y a rien à faire.
export async function TachesArgent() {
  const t = await getTranslations("Admin.taches.argent");
  let taches: TacheRemboursement[] | null = null;
  try {
    taches = await lireTachesRemboursement();
  } catch {
    console.error("[commande] lecture des tâches d'argent impossible");
  }
  if (!taches) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  return (
    <section aria-labelledby="tache-argent" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
      <h2 id="tache-argent" className="t-h2">
        {t("titre")}
      </h2>
      {taches.length === 0 ? (
        <p className="t-body text-text-secondary">{t("vide")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {taches.map((x) => (
            <li key={`${x.type}-${x.cibleId}`}>
              <Link href={`/admin/commandes/${x.numero}`} className="t-body inline-flex min-h-touch items-center text-text-primary underline">
                {t(x.type, { numero: x.numero })}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
