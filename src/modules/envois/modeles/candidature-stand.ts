import { formaterUsd } from "@/lib/argent";
import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

export type DonneesCandidatureValidee = {
  nomSite: string;
  evenement: string;
  // Heure limite de paiement, déjà formatée à l'heure de la boutique, relue en base au moment du rendu.
  limite: string;
  // Lien de paiement absolu (NEXT_PUBLIC_SITE_URL) : il ne contient aucun secret, la page exige le Compte du candidat.
  url: string;
};

export type DonneesCandidatureRefusee = {
  nomSite: string;
  evenement: string;
  motif: string | null;
  // Montant à rembourser (USD) quand le Stand était payé ; null sinon.
  montantCents: number | null;
  url: string;
};

// Email « candidature acceptée » (story 7.11, décision du 2026-11-11) : ni description, ni Instagram, ni photo, ni jeton.
export function rendreCandidatureValidee(langue: LangueEmail, d: DonneesCandidatureValidee): MessageEmail {
  const t = TEXTES[langue].candidature_validee;
  const { html, texte } = envelopper({
    langue,
    nomSite: d.nomSite,
    titre: t.titre,
    paragraphes: [remplir(t.intro, { evenement: d.evenement }), remplir(t.delai, { limite: d.limite })],
    texteLien: t.lien,
    libelleBouton: t.bouton,
    url: d.url,
  });
  return { sujet: remplir(t.sujet, { evenement: d.evenement }), html, texte };
}

// Email « candidature refusée » après coup par l'Admin : motif facultatif, remboursement annoncé seulement s'il est dû.
export function rendreCandidatureRefusee(langue: LangueEmail, d: DonneesCandidatureRefusee): MessageEmail {
  const t = TEXTES[langue].candidature_refusee;
  const paragraphes = [remplir(t.intro, { evenement: d.evenement })];
  if (d.motif) paragraphes.push(remplir(t.motif, { motif: d.motif }));
  if (d.montantCents !== null && d.montantCents > 0) paragraphes.push(remplir(t.remboursement, { montant: formaterUsd(d.montantCents, langue) }));
  const { html, texte } = envelopper({ langue, nomSite: d.nomSite, titre: t.titre, paragraphes, texteLien: t.lien, libelleBouton: t.bouton, url: d.url });
  return { sujet: remplir(t.sujet, { evenement: d.evenement }), html, texte };
}
