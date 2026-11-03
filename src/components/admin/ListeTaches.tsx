import { getFormatter, getTranslations } from "next-intl/server";
import type { TacheAdmin } from "@/modules/admin/types";

// Fuseau de la boutique (Goma) pour afficher la date, identique pour tout le monde.
const FUSEAU_BOUTIQUE = "Africa/Lubumbashi";
const GRAVITES = ["info", "attention", "critique"] as const;
const TYPES_CONNUS = ["envoi_echec_definitif"] as const;
const MODELES_CONNUS = ["commande_payee", "kit_ouvert", "commande_en_fabrication", "commande_expediee", "commande_livree"] as const;

// Tâches ouvertes : type, gravité, date, détail. Jamais de donnée personnelle (la tâche ne porte que des identifiants). État vide explicite.
export async function ListeTaches({ taches }: { taches: readonly TacheAdmin[] }) {
  const t = await getTranslations("Admin.taches");
  const format = await getFormatter();
  if (taches.length === 0) {
    return <p className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{t("vide")}</p>;
  }
  return (
    <ul className="flex flex-col gap-ecart-cartes">
      {taches.map((tache) => {
        const type = (TYPES_CONNUS as readonly string[]).includes(tache.type) ? (tache.type as (typeof TYPES_CONNUS)[number]) : null;
        const modele = (MODELES_CONNUS as readonly string[]).includes(tache.details.modele ?? "") ? (tache.details.modele as (typeof MODELES_CONNUS)[number]) : null;
        return (
          <li key={tache.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
            <h2 className="t-h2">{type ? t(`types.${type}`) : tache.type}</h2>
            <p className="t-label text-text-primary">{t(`gravite.${GRAVITES.includes(tache.gravite) ? tache.gravite : "attention"}`)}</p>
            {type === "envoi_echec_definitif" && modele && typeof tache.details.tentatives === "number" ? (
              <p className="t-body text-text-secondary">{t("detailEnvoi", { modele: t(`modeles.${modele}`), tentatives: tache.details.tentatives })}</p>
            ) : null}
            <p className="t-small text-text-secondary">
              {t("creeLe", { date: format.dateTime(new Date(tache.creeLe), { dateStyle: "long", timeStyle: "short", timeZone: FUSEAU_BOUTIQUE }) })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
