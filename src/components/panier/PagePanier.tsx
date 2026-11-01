import { getTranslations } from "next-intl/server";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { DOSSIERS_FICHE } from "@/components/fiche/FicheProduit";
import { DOSSIER_KITS } from "@/components/fiche/FicheKit";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { modifierLigneParFormulaire, retirerLigneParFormulaire } from "@/modules/panier/actions";
import { lirePanier } from "@/modules/panier/queries";
import { NOMBRE_MAX_LIGNE } from "@/modules/panier/schemas";
import type { LignePanier } from "@/modules/panier/types";

const CLASSE_NOMBRE = "t-body min-h-touch w-24 rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
const CLASSES_LIEN = "t-body inline-flex min-h-touch items-center text-text-primary underline";

const indisponible = (l: LignePanier) => l.etat === "complet" || l.etat === "epuise";

// Panier du visiteur : prix, disponibilité et délai relus en base à chaque affichage (règle 3, UX-DR32). Aucun prix n'est figé.
// Page privée (noindex). Les formulaires marchent avant l'hydratation ; la page se relit après chaque action.
export async function PagePanier({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Panier" });
  const panier = await lirePanier(locale);

  if (!panier) return <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>;

  if (panier.lignes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        {panier.avisKitPossede ? <MessageEtat type="information">{t("kitDejaPossede")}</MessageEtat> : null}
        <p className="t-body text-text-primary">{t("vide")}</p>
        <p className="t-body text-text-secondary">{t("versCatalogues")}</p>
        <ul className="flex flex-wrap gap-4">
          <li>
            <Link href={cheminPublic(locale, "/cosplays")} className={CLASSES_LIEN}>
              {t("liensCatalogues.cosplays")}
            </Link>
          </li>
          <li>
            <Link href={cheminPublic(locale, "/accessoires")} className={CLASSES_LIEN}>
              {t("liensCatalogues.accessoires")}
            </Link>
          </li>
          <li>
            <Link href={cheminPublic(locale, "/kits")} className={CLASSES_LIEN}>
              {t("liensCatalogues.kits")}
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  const aUnePiecePhysique = panier.lignes.some((l) => l.famille !== "kit");

  return (
    <div className="flex flex-col gap-6">
      {panier.avisKitPossede ? <MessageEtat type="information">{t("kitDejaPossede")}</MessageEtat> : null}
      <ul aria-label={t("liste")} className="flex flex-col gap-4">
        {panier.lignes.map((l) => {
          const dossier = l.famille === "kit" ? DOSSIER_KITS : DOSSIERS_FICHE[l.famille];
          const hors = indisponible(l);
          return (
            <li key={l.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              {hors ? (
                <p className="t-h3 text-text-primary">{l.titre}</p>
              ) : (
                <Link href={cheminPublic(locale, `${dossier}/${l.slug}`)} className="t-h3 text-text-primary underline">
                  {l.titre}
                </Link>
              )}
              {l.famille === "kit" ? (
                <p className="t-small text-text-secondary">{t("kitUnExemplaire")}</p>
              ) : (
                <p className="t-small text-text-secondary">{l.taille === "sur_mesure" ? t("tailleSurMesure") : t("taille", { taille: l.taille ?? "" })}</p>
              )}
              {hors ? (
                <>
                  <p className="t-label text-text-primary">{t(`etat.${l.etat}`)}</p>
                  <MessageEtat type="attention">{t("plusDisponible")}</MessageEtat>
                </>
              ) : (
                <>
                  <p className="t-small text-text-primary">{t(`etat.${l.etat}`)}</p>
                  {l.delaiJours !== null ? <p className="t-small text-text-primary">{t("delai", { n: l.delaiJours })}</p> : null}
                  <p className="t-body text-text-primary">{t("prixUnitaire", { prix: formaterUsd(l.prixCents, locale) })}</p>
                  {l.famille !== "kit" ? (
                    <form action={modifierLigneParFormulaire} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="ligne" value={l.id} />
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`nombre-${l.id}`} className="t-label text-text-primary">
                          {t("quantite")}
                        </label>
                        <input
                          id={`nombre-${l.id}`}
                          name="nombre"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={NOMBRE_MAX_LIGNE}
                          defaultValue={l.nombre}
                          className={CLASSE_NOMBRE}
                        />
                      </div>
                      <Bouton type="submit" variante="secondaire">
                        {t("mettreAJour")}
                      </Bouton>
                    </form>
                  ) : null}
                  <p className="t-label text-text-primary">{t("totalLigne", { prix: formaterUsd(l.prixCents * l.nombre, locale) })}</p>
                </>
              )}
              <form action={retirerLigneParFormulaire}>
                <input type="hidden" name="ligne" value={l.id} />
                <Bouton type="submit" variante="secondaire" aria-label={t("retirerNom", { titre: l.titre })}>
                  {t("retirer")}
                </Bouton>
              </form>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="panier-recap" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="panier-recap" className="t-h2">
          {t("sousTotal")}
        </h2>
        <p className="t-price-card text-text-primary">{formaterUsd(panier.sousTotalCents, locale)}</p>
        <p className="t-small text-text-secondary">{t("sousTotalAide")}</p>
        {aUnePiecePhysique ? <p className="t-small text-text-secondary">{t("delaiLivraison")}</p> : null}
        {panier.bloque ? (
          <Bouton desactive raison={t("raisonBloque")}>
            {t("passer")}
          </Bouton>
        ) : (
          <Bouton href="/commande">{t("passer")}</Bouton>
        )}
      </section>
    </div>
  );
}

