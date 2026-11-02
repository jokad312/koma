import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { lireBibliotheque, type KitBibliotheque } from "@/modules/bibliotheque/queries";

export const CHEMIN_BIBLIOTHEQUE = "/compte/bibliotheque";

export function versConnexionBibliotheque(locale: Locale, suite = ""): never {
  redirect(`/${locale}/connexion?retour=${encodeURIComponent(`/${locale}${CHEMIN_BIBLIOTHEQUE}${suite}`)}`);
}

// Bibliothèque : une ligne par Kit (vignette, titre, lien étendu à toute la ligne). Visiteur sans session : connexion, puis retour ici.
export async function PageBibliotheque({ locale }: { locale: Locale }) {
  const session = await lireSessionVerifiee();
  if (!session) versConnexionBibliotheque(locale);
  const t = await getTranslations({ locale, namespace: "Bibliotheque" });

  let kits: KitBibliotheque[];
  try {
    kits = await lireBibliotheque(session.compteId);
  } catch {
    console.error("[bibliotheque] lecture de la bibliothèque impossible");
    return <MessageEtat type="erreur">{t("indisponible")}</MessageEtat>;
  }

  if (kits.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>{t("vide")}</p>
        <Link href="/kits" className="t-small underline underline-offset-4">
          {t("versCatalogue")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {kits.map((k) => {
        const titre = (locale === "en" ? k.titre.en : null) ?? k.titre.fr;
        return (
          <li key={k.produitId} className="relative flex items-center gap-4 rounded-md border border-border bg-surface p-3">
            {k.vignette ? (
              // eslint-disable-next-line @next/next/no-img-element -- vignette d'un bucket public, dimensions fixes
              <img src={k.vignette.url} alt={locale === "en" ? k.vignette.alt.en : k.vignette.alt.fr} width={64} height={64} className="size-16 shrink-0 rounded-sm object-cover" />
            ) : (
              <span aria-hidden="true" className="size-16 shrink-0 rounded-sm bg-border" />
            )}
            {/* Lien étendu à la ligne entière (UX-DR39) : la zone cliquable couvre tout l'élément. */}
            <Link href={`${CHEMIN_BIBLIOTHEQUE}/${k.slug}`} className="t-h3 after:absolute after:inset-0">
              {titre}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
