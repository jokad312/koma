import { getTranslations } from "next-intl/server";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import type { NombresAlertes } from "@/modules/alertes/types";

type Props = { evenementId: string; nombres: NombresAlertes };

// Section « Alertes » de la page d'un Événement (story 7.3, FR-32) : nombre d'inscrits actifs par canal et export CSV des numéros WhatsApp.
// Le site n'envoie aucun message WhatsApp : Jonathan écrit lui-même aux numéros exportés. L'export est journalisé côté serveur.
export async function SectionAlertes({ evenementId, nombres }: Props) {
  const t = await getTranslations("Admin.evenements.alertes");
  const lignes: Array<[string, number]> = [
    [t("email"), nombres.email],
    [t("compte"), nombres.compte],
    [t("whatsapp"), nombres.whatsapp],
    [t("desinscrits"), nombres.desinscrits],
  ];
  return (
    <section aria-labelledby="admin-alertes" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="admin-alertes" className="t-h3">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:max-w-sm">
        {lignes.map(([libelle, nombre]) => (
          <div key={libelle} className="contents">
            <dt className="t-body text-text-primary">{libelle}</dt>
            <dd className="t-body text-right font-bold text-text-primary">{nombre}</dd>
          </div>
        ))}
      </dl>
      {nombres.whatsapp > 0 ? (
        <div className="flex flex-col items-start gap-1">
          {/* Lien de téléchargement simple : la route vérifie le droit côté serveur et journalise l'export. */}
          <a href={`/api/admin/evenements/${evenementId}/alertes-whatsapp`} download className={CLASSES_SECONDAIRE}>
            {t("exporter")}
          </a>
          <p className="t-small text-text-secondary">{t("exportAide")}</p>
        </div>
      ) : (
        <p className="t-small text-text-secondary">{t("aucunNumero")}</p>
      )}
    </section>
  );
}
