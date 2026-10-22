import { getFormatter, getTranslations } from "next-intl/server";
import { BoutonMarquerTraite } from "@/components/admin/BoutonMarquerTraite";
import type { MessageContactAdmin } from "@/modules/admin/types";

// Fuseau de la boutique (Goma) pour afficher la date de réception, identique pour tout le monde.
const FUSEAU_BOUTIQUE = "Africa/Lubumbashi";

// Messages « nouveau » : nom, email (mailto), message, date. État vide explicite.
export async function ListeMessages({ messages }: { messages: readonly MessageContactAdmin[] }) {
  const t = await getTranslations("Admin.messages");
  const format = await getFormatter();
  if (messages.length === 0) {
    return <p className="t-body rounded-lg border border-border bg-surface p-5 text-text-secondary">{t("vide")}</p>;
  }
  return (
    <ul className="flex flex-col gap-ecart-cartes">
      {messages.map((m) => (
        <li key={m.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="t-h2">{m.nom}</h2>
          <p className="t-small text-text-secondary">
            <a href={`mailto:${m.email}`} className="break-all underline">
              {m.email}
            </a>
          </p>
          <p className="t-small text-text-secondary">
            {t("recuLe", { date: format.dateTime(new Date(m.creeLe), { dateStyle: "long", timeStyle: "short", timeZone: FUSEAU_BOUTIQUE }) })}
          </p>
          <p className="t-body whitespace-pre-wrap break-words text-text-primary">{m.message}</p>
          <BoutonMarquerTraite id={m.id} />
        </li>
      ))}
    </ul>
  );
}
