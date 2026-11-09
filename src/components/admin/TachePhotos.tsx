import { getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import { creerClientService } from "@/lib/supabase/service";

// Tâches « Photos à valider » et « Retraits demandés » (story 8.2, AD-21) : compteurs réels lus en base ; lecture impossible : message d'erreur,
// jamais un faux zéro.
export async function TachePhotos() {
  const t = await getTranslations("Admin.taches.photos");
  let compte: { aValider: number; realisations: number; retraits: number } | null = null;
  try {
    const { data, error } = await creerClientService().rpc("compter_photos_a_traiter");
    if (!error && data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      // Deux entiers attendus : sinon, message d'erreur (jamais un zéro inventé).
      if (Number.isInteger(d.a_valider) && Number.isInteger(d.realisations) && Number.isInteger(d.retraits)) {
        compte = { aValider: d.a_valider as number, realisations: d.realisations as number, retraits: d.retraits as number };
      }
    }
  } catch {
    compte = null;
  }
  if (!compte) {
    console.error("[galerie] lecture des photos à traiter impossible");
    return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  }
  return (
    <section aria-labelledby="tache-photos" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
      <h2 id="tache-photos" className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-label text-text-primary">{t("aValider", { nombre: compte.aValider })}</p>
      <p className="t-label text-text-primary">{t("realisations", { nombre: compte.realisations })}</p>
      <p className="t-label text-text-primary">{t("retraits", { nombre: compte.retraits })}</p>
      <Link href="/admin/galerie" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
        {t("lien")}
      </Link>
    </section>
  );
}
