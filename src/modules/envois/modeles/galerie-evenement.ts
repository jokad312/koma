import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

export type DonneesGalerieEvenement = {
  nomSite: string;
  // Titre de l'Événement dans la langue de l'envoi.
  evenement: string;
  // Lien public de la Galerie (Google Drive ou Google Photos), relu en base au moment du rendu.
  lienGalerie: string;
};

// Email « Galerie d'événement » (story 7.10, FR-39) : un seul lien, celui de la Galerie, et le rappel qu'une photo se fait retirer par le contact
// (Jonathan la retire à la main). Aucun jeton, aucun code, aucune adresse d'un autre client.
export function rendreGalerieEvenement(langue: LangueEmail, d: DonneesGalerieEvenement): MessageEmail {
  const t = TEXTES[langue].galerie_evenement;
  const { html, texte } = envelopper({
    langue,
    nomSite: d.nomSite,
    titre: t.titre,
    paragraphes: [remplir(t.intro, { evenement: d.evenement }), t.retrait],
    texteLien: t.lien,
    libelleBouton: t.bouton,
    url: d.lienGalerie,
  });
  return { sujet: remplir(t.sujet, { evenement: d.evenement }), html, texte };
}
