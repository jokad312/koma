import Image from "next/image";
import { useLocale } from "next-intl";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import type { CarteProduit as Donnees } from "@/modules/catalogue/types";
import { BadgeDisponibilite } from "./BadgeDisponibilite";

const DOSSIER: Record<Donnees["famille"], string> = { cosplay: "/cosplays", accessoire: "/accessoires" };

// Carte d'un produit : photo (texte alternatif de la photo), nom en h3 > a étendu à toute la carte, prix en USD, badge de disponibilité.
// Utilisable côté serveur et côté client (« Voir plus » ajoute des cartes dans le navigateur).
export function CarteProduit({ produit }: { produit: Donnees }) {
  const locale = useLocale() as Locale;
  const href = cheminPublic(locale, `${DOSSIER[produit.famille]}/${produit.slug}`);
  return (
    <article
      data-carte={produit.id}
      className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
    >
      <div className="relative aspect-[4/5] w-full bg-background">
        <Image src={produit.photoUrl} alt={produit.photoAlt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="t-h3">
          <Link href={href} className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
            {produit.titre}
          </Link>
        </h3>
        <p className="t-price-card text-text-primary">{formaterUsd(produit.prixCents, locale)}</p>
        <BadgeDisponibilite etat={produit.disponibilite} />
      </div>
    </article>
  );
}
