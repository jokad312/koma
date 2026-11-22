import { getTranslations } from "next-intl/server";
import { Bouton } from "@/components/ui/Bouton";
import { Link } from "@/i18n/navigation";
import { formaterDateHeureBoutique } from "@/lib/dates";
import type { EvenementListe } from "@/modules/evenements/types";
import { PastilleStatut } from "./PastilleStatut";
import { nb } from "@/components/ui/Nombre";

// Story 9.16 (étape 8) : cartes de l'admin (fond « en-tête »), deux colonnes à partir de 1280 px, dans le panneau de la page.
// Liste des Événements : cartes empilées (mobile d'abord), nombre annoncé en statut, état vide avec bouton de création.
// Le statut vient de la base, jamais d'une supposition locale ; dates à l'heure de Goma.
export async function ListeEvenements({ evenements, locale }: { evenements: readonly EvenementListe[]; locale: "fr" | "en" }) {
  const t = await getTranslations("Admin.evenements");
  if (evenements.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="status" className="t-body text-text-secondary">
          {t("vide.texte")}
        </p>
        <Bouton href="/admin/evenements/nouveau">{t("vide.creer")}</Bouton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="t-label uppercase text-text-primary">
        {t.rich("nombre", { nombre: evenements.length, nb })}
      </p>
      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {evenements.map((e) => (
          <li key={e.id} className="flex flex-col items-start gap-2 rounded-[16px] bg-admin-entete p-4 text-text-primary">
            <h2 className="t-h3">
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
