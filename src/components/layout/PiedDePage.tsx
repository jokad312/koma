import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PAGES_LEGALES } from "@/lib/vitrine/pages-legales";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";

const LIEN = "t-small inline-flex min-h-touch items-center text-text-primary underline";

// Pied de page : cartes identité et Aide (FAQ, Contact, WhatsApp si un numéro est réglé). Infos légales (1.9) : quatre pages. La carte Paiement
// est ajoutée par sa story ; Galerie et réseaux sociaux seulement quand ils existent.
export async function PiedDePage({ nomSite, numeroWhatsapp = null }: { nomSite: string; numeroWhatsapp?: string | null }) {
  const t = await getTranslations("Pied");
  const tw = await getTranslations("Whatsapp");
  const whatsapp = lienWhatsapp(numeroWhatsapp);
  return (
    <footer className="mt-12 px-marge pb-8">
      <div className="mx-auto grid max-w-7xl gap-ecart-cartes md:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="pied-identite" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="pied-identite" className="t-label text-text-primary">
            {nomSite}
          </h2>
          <p className="t-small mt-2 text-text-secondary">{t("identite")}</p>
        </section>
        <section aria-labelledby="pied-aide" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="pied-aide" className="t-label text-text-primary">
            {t("aide.titre")}
          </h2>
          <ul className="mt-2 flex flex-col items-start">
            <li>
              <Link href="/faq" className={LIEN}>
                {t("aide.faq")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className={LIEN}>
                {t("aide.contact")}
              </Link>
            </li>
            {whatsapp ? (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={LIEN}>
                  {tw("ecrire")}
                  <span className="sr-only">{tw("nouvelOnglet")}</span>
                </a>
              </li>
            ) : null}
          </ul>
        </section>
        <section aria-labelledby="pied-legal" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="pied-legal" className="t-label text-text-primary">
            {t("legal.titre")}
          </h2>
          <ul className="mt-2 flex flex-col items-start">
            {PAGES_LEGALES.map(({ cle, chemin }) => (
              <li key={cle}>
                <Link href={chemin} className={LIEN}>
                  {t(`legal.${cle}`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </footer>
  );
}
