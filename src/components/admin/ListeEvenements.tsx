import { getTranslations } from "next-intl/server";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import { formaterDateHeureBoutique } from "@/lib/dates";
import type { EvenementListe } from "@/modules/evenements/types";
import { PastilleStatut } from "./PastilleStatut";

// Liste des Événements : cartes empilées (mobile d'abord), nombre annoncé en statut, état vide avec bouton de création.
// Le statut vient de la base, jamais d'une supposition locale ; dates à l'heure de Goma.
export async function ListeEvenements({ evenements, locale }: { evenements: readonly EvenementListe[]; locale: "fr" | "en" }) {
  const t = await getTranslations("Admin.evenements");
  if (evenements.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        <Bouton href="/admin/evenements/nouveau">{t("vide.creer")}</Bouton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="t-small text-text-secondary">
        {t("nombre", { nombre: evenements.length })}
      </p>
      <ul className="flex flex-col gap-ecart-cartes">
        {evenements.map((e) => (
          <li key={e.id} className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-5">
            <h2 className="t-h2">
              <Link href={`/admin/evenements/${e.id}`} className="inline-flex min-h-touch items-center underline">
                {e.titreFr}
              </Link>
            </h2>
            <PastilleStatut publie={e.publieLe !== null} libelle={t(e.publieLe === null ? "statut.brouillon" : "statut.publie")} />
            <p className="t-small text-text-secondary">
              {e.debutLe ? t("liste.debut", { date: formaterDateHeureBoutique(e.debutLe, locale) ?? "" }) : t("liste.sansDate")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
