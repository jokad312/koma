import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

// Emails commerciaux ciblés (story 9.6, FR-59) : textes validés par Jonathan le 2026-11-10, dans messages/*.json (espace Emails).
// Chaque email porte le lien de désinscription (FR-45), en dernier paragraphe.

type Commun = { nomSite: string; url: string; lienDesinscription: string };

function finir(langue: LangueEmail, titre: string, paragraphes: string[], d: Commun, texteLien: string, libelleBouton: string) {
  const t = TEXTES[langue].commercial;
  return envelopper({
    langue,
    nomSite: d.nomSite,
    titre,
    paragraphes,
    texteLien,
    libelleBouton,
    url: d.url,
    desinscription: { texte: t.desinscriptionTexte, libelle: t.desinscriptionLien, url: d.lienDesinscription },
  });
}

export function rendrePanierAbandonne(langue: LangueEmail, d: Commun): MessageEmail {
  const t = TEXTES[langue].panier_abandonne;
  const { html, texte } = finir(langue, t.titre, [remplir(t.intro, { nomSite: d.nomSite })], d, t.lien, t.bouton);
  return { sujet: t.sujet, html, texte };
}

export function rendreRappelKit(langue: LangueEmail, d: Commun & { kit: string; chapitre: number | null }): MessageEmail {
  const t = TEXTES[langue].rappel_kit;
  const phrase = d.chapitre === null ? remplir(t.debut, { kit: d.kit }) : remplir(t.reprise, { kit: d.kit, n: d.chapitre });
  const { html, texte } = finir(langue, remplir(t.titre, { kit: d.kit }), [phrase], d, t.lien, t.bouton);
  return { sujet: remplir(t.sujet, { kit: d.kit }), html, texte };
}

export function rendreNouveauProduit(langue: LangueEmail, d: Commun & { produit: string; univers: string }): MessageEmail {
  const t = TEXTES[langue].nouveau_produit;
  const { html, texte } = finir(langue, remplir(t.titre, { univers: d.univers }), [remplir(t.intro, { produit: d.produit, univers: d.univers })], d, t.lien, t.bouton);
  return { sujet: remplir(t.sujet, { produit: d.produit, univers: d.univers }), html, texte };
}
