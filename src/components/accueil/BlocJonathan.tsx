import { useTranslations } from "next-intl";
import { TitreVitrine } from "@/components/ui/TitreVitrine";

const PHRASES = ["phrase1", "phrase2", "phrase3"] as const;

// Bloc 6 « Jonathan en trois phrases » : textes fournis par Jonathan (marqueur tant qu'ils manquent).
// Le bloc reste affiché avec le marqueur : c'est le rappel à Jonathan, jamais masqué en silence.
export function BlocJonathan() {
  const t = useTranslations("Accueil.jonathan");
  return (
    <section aria-labelledby="accueil-jonathan" className="flex flex-col gap-4">
      <div id="accueil-jonathan">
        <TitreVitrine niveau={2}>{t("titre")}</TitreVitrine>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
        {PHRASES.map((cle) => (
          <p key={cle} className="t-body text-text-secondary">
            {t(cle)}
          </p>
        ))}
      </div>
    </section>
  );
}
