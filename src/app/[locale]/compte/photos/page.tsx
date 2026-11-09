import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { versConnexion } from "@/components/commande/PageCommande";
import { EnvoiPhotoClient } from "@/components/compte/EnvoiPhotoClient";
import { RetirerPhoto } from "@/components/compte/RetirerPhoto";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { formaterDateBoutique } from "@/lib/dates";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { dependancesCommunaute } from "@/modules/communaute/dependances";
import { listerMesPhotos } from "@/modules/communaute/service";

// « Mon compte › Envoyer une photo » (story 8.1) : page privée, rendue à la demande, jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/photos">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.comptePhotos" });
  return construireMetadata({ locale, chemin: "/compte/photos", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale }: { locale: Locale }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "Communaute" });
  const lu = await listerMesPhotos(dependancesCommunaute());
  if (!lu.ok && lu.erreur === "non_connecte") versConnexion(locale, `/${locale}/compte/photos`);
  if (!lu.ok) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;
  return (
    <>
      {lu.mineur ? <MessageEtat type="information">{t("mineur")}</MessageEtat> : <EnvoiPhotoClient />}
      <section className="flex flex-col gap-3">
        <h3 className="t-h2">{t("mesPhotos.titre")}</h3>
        {lu.photos.length === 0 ? (
          <p className="t-body text-text-secondary">{t("mesPhotos.vide")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lu.photos.map((p) => {
              const date = formaterDateBoutique(p.creeLe, locale) ?? "";
              return (
                <li key={p.id} className="flex flex-wrap items-start gap-4 rounded-lg border border-border bg-surface p-4">
                  {p.apercu ? (
                    // Aperçu signé de courte durée (bucket privé) : pas d'optimisation d'image, l'adresse expire.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.apercu} alt={t("mesPhotos.alt", { date })} width={96} height={96} className="size-24 rounded-md object-cover" />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="t-label text-text-primary">{t(`mesPhotos.statut.${p.statut}`)}</p>
                    <p className="t-small text-text-secondary">{t("mesPhotos.envoyeeLe", { date })}</p>
                    <p className="t-small text-text-secondary">{p.nomAffiche ? t("mesPhotos.pseudo", { nom: p.nomAffiche }) : t("mesPhotos.sansPseudo")}</p>
                    <p className="t-small text-text-secondary">{p.ville ? t("mesPhotos.ville", { ville: p.ville }) : t("mesPhotos.sansVille")}</p>
                    {p.retraitDemande && p.statut !== "retiree" ? <p className="t-small text-text-primary">{t("mesPhotos.retraitDemande")}</p> : null}
                  </div>
                  {(p.statut === "en_attente" || p.statut === "publiee") && !p.retraitDemande ? <RetirerPhoto id={p.id} publiee={p.statut === "publiee"} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function PagePhotos({ params }: PageProps<"/[locale]/compte/photos">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Communaute");
  return (
    <section className="flex flex-col gap-4">
      <h2 className="t-h2">{t("titre")}</h2>
      <p className="t-body text-text-secondary">{t("intro")}</p>
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} />
      </Suspense>
    </section>
  );
}
