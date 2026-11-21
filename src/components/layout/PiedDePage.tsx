import { getLocale, getTranslations } from "next-intl/server";
import { cheminPublic } from "@/i18n/adresses";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PAGES_LEGALES } from "@/lib/vitrine/pages-legales";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";
import { lireMurPublie } from "@/modules/communaute/queries";
import { lireMoyensPaiementActifs } from "@/modules/paiement/queries";

const LIEN = "t-small inline-flex min-h-touch items-center text-text-primary underline";

// Pied de page : cartes identité et Aide (FAQ, Contact, WhatsApp si un numéro est réglé). Infos légales (1.9) : quatre pages. La carte Paiement
// est ajoutée par sa story ; Galerie et réseaux sociaux seulement quand ils existent.
export async function PiedDePage({ nomSite, numeroWhatsapp = null }: { nomSite: string; numeroWhatsapp?: string | null }) {
  const t = await getTranslations("Pied");
  const tw = await getTranslations("Whatsapp");
  const locale = (await getLocale()) as Locale;
  const whatsapp = lienWhatsapp(numeroWhatsapp);
  // Le lien vers le mur « Ils le portent » n'existe qu'une fois une photo publiée (FR-2) ; une erreur de lecture le masque.
  const murPublie = await lireMurPublie();
  // Moyens des Prestataires actifs, lus côté serveur : aucun Prestataire inactif ; sans Prestataire actif, la carte n'est pas affichée.
  const moyensPaiement = await lireMoyensPaiementActifs();
  return (
    <footer className="pied-site mt-12 pb-8">
      {/* Même conteneur que <main> (max-w-7xl, marge à l'intérieur) : les cartes s'alignent sur la colonne du contenu. */}
      {/* Autant de colonnes que de cartes à partir de 1024 px (3 sans la carte Paiement, 4 avec) : les cartes occupent toute la largeur du conteneur. */}
      {/* De 768 à 1023 px (2 colonnes), avec 3 cartes, la dernière s'étend sur les deux colonnes : jamais une carte seule sur une demi-ligne. */}
      <div
        className={`mx-auto grid max-w-7xl gap-ecart-cartes px-marge md:grid-cols-2 ${moyensPaiement.length > 0 ? "lg:grid-cols-4" : "md:[&>section:last-child]:col-span-2 lg:grid-cols-3 lg:[&>section:last-child]:col-span-1"}`}
      >
        <section aria-labelledby="pied-identite" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="pied-identite" className="t-label text-text-primary">
            {nomSite}
          </h2>
          <p className="t-small mt-2 text-text-secondary">{t("identite")}</p>
          {/* Story 9.15, option C : « Autres articles » est sous « Boutique » dans l'en-tête, et aussi atteint ici et par les tuiles de l'accueil. */}
          <p className="mt-2">
            <Link href={cheminPublic(locale, "/autres-articles")} className={LIEN}>
              {t("autresArticles")}
            </Link>
          </p>
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
            {murPublie ? (
              <li>
                <Link href="/#galerie" className={LIEN}>
                  {t("aide.galerie")}
                </Link>
              </li>
            ) : null}
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
        {moyensPaiement.length > 0 ? (
          <section aria-labelledby="pied-paiement" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="pied-paiement" className="t-label text-text-primary">
              {t("paiement.titre")}
            </h2>
            <ul className="mt-2 flex flex-col items-start">
              {moyensPaiement.map((p) => (
                <li key={p.code} className="t-small text-text-primary">
                  {t("paiement.ligne", { prestataire: p.nom, moyens: p.moyens.map((m) => t(`paiement.moyen.${m}`)).join(", ") })}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
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
