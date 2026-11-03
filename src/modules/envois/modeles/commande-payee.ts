import { formaterUsd } from "@/lib/argent";
import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

export type DonneesCommandePayee = {
  nomSite: string;
  numero: string;
  lignes: { titre: string; nombre: number; prixCents: number }[];
  livraisonCents: number;
  totalCents: number;
  url: string;
  // Présent seulement si la Commande contient une ligne Sur-mesure (story 6.4) : lien WhatsApp du numéro réglé, ou null s'il n'est pas réglé.
  mesures?: { lien: string | null };
};

// Montants en USD seulement (règle « Prix et livraison »), calculés depuis la base au moment du rendu.
export function rendreCommandePayee(langue: LangueEmail, d: DonneesCommandePayee): MessageEmail {
  const t = TEXTES[langue].commande_payee;
  const { html, texte } = envelopper({
    langue,
    nomSite: d.nomSite,
    titre: t.titre,
    paragraphes: [remplir(t.intro, { numero: d.numero }), t.articles],
    paragrapheFinal: d.mesures ? (d.mesures.lien ? remplir(t.mesures, { lien: d.mesures.lien }) : t.mesuresSansNumero) : undefined,
    lignes: [
      ...d.lignes.map((l) => remplir(t.ligne, { nombre: l.nombre, titre: l.titre, montant: formaterUsd(l.prixCents * l.nombre, langue) })),
      ...(d.livraisonCents > 0 ? [remplir(t.livraison, { montant: formaterUsd(d.livraisonCents, langue) })] : []),
    ],
    total: remplir(t.total, { total: formaterUsd(d.totalCents, langue) }),
    texteLien: t.lien,
    libelleBouton: t.bouton,
    url: d.url,
  });
  return { sujet: remplir(t.sujet, { numero: d.numero }), html, texte };
}
