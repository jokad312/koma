import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

// Email « Me prévenir » (story 7.3, FR-32) : envoyé à l'ouverture de la vente des Pass d'un événement. Textes écrits par l'assistant,
// dans messages/*.json (espace Emails.alerte_evenement), à valider par Jonathan. Lien de désinscription en pied (FR-45).
type Donnees = { nomSite: string; evenement: string; url: string; lienDesinscription: string };

export function rendreAlerteEvenement(langue: LangueEmail, d: Donnees): MessageEmail {
  const t = TEXTES[langue].alerte_evenement;
  const c = TEXTES[langue].commercial;
  const { html, texte } = envelopper({
    langue,
    nomSite: d.nomSite,
    titre: remplir(t.titre, { evenement: d.evenement }),
    paragraphes: [remplir(t.intro, { evenement: d.evenement, nomSite: d.nomSite })],
    texteLien: t.lien,
    libelleBouton: t.bouton,
    url: d.url,
    desinscription: { texte: c.desinscriptionTexte, libelle: c.desinscriptionLien, url: d.lienDesinscription },
  });
  return { sujet: remplir(t.sujet, { evenement: d.evenement }), html, texte };
}
