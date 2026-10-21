import { getTranslations } from "next-intl/server";

// Pied de page : seule la carte identité existe. Les cartes Aide (1.8), Infos légales (1.9) et Paiement
// sont ajoutées par leurs stories ; Galerie et réseaux sociaux seulement quand ils existent.
export async function PiedDePage({ nomSite }: { nomSite: string }) {
  const t = await getTranslations("Pied");
  return (
    <footer className="mt-12 px-marge pb-8">
      <div className="mx-auto grid max-w-7xl gap-ecart-cartes md:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="pied-identite" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="pied-identite" className="t-label text-text-primary">
            {nomSite}
          </h2>
          <p className="t-small mt-2 text-text-secondary">{t("identite")}</p>
        </section>
      </div>
    </footer>
  );
}
