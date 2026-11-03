import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

export type DonneesStatutCommande = {
  nomSite: string;
  numero: string;
  url: string;
  // Numéro de suivi saisi à la main, affiché tel quel ; absent : aucune ligne (règle 12).
  numeroSuivi?: string | null;
  // Retrait à Goma : « prête à retirer » au lieu de « expédiée ».
  retrait?: boolean;
  // Lien WhatsApp du numéro réglé (jamais en dur) ; absent : l'invitation n'est pas écrite (règle 15).
  lienWhatsapp?: string | null;
};

// Emails d'avancement (story 6.3) : textes dans messages/*.json (espace Emails), montants et données relus en base au moment du rendu.
export function rendreCommandeEnFabrication(langue: LangueEmail, d: DonneesStatutCommande): MessageEmail {
  const t = TEXTES[langue].commande_en_fabrication;
  const { html, texte } = envelopper({ langue, nomSite: d.nomSite, titre: t.titre, paragraphes: [remplir(t.intro, { numero: d.numero })], texteLien: t.lien, libelleBouton: t.bouton, url: d.url });
  return { sujet: remplir(t.sujet, { numero: d.numero }), html, texte };
}

export function rendreCommandeExpediee(langue: LangueEmail, d: DonneesStatutCommande): MessageEmail {
  const t = TEXTES[langue].commande_expediee;
  const paragraphes = [remplir(d.retrait ? t.introRetrait : t.intro, { numero: d.numero })];
  if (d.numeroSuivi) paragraphes.push(remplir(t.suivi, { suivi: d.numeroSuivi }));
  const { html, texte } = envelopper({ langue, nomSite: d.nomSite, titre: d.retrait ? t.titreRetrait : t.titre, paragraphes, texteLien: t.lien, libelleBouton: t.bouton, url: d.url });
  return { sujet: remplir(d.retrait ? t.sujetRetrait : t.sujet, { numero: d.numero }), html, texte };
}

export function rendreCommandeLivree(langue: LangueEmail, d: DonneesStatutCommande): MessageEmail {
  const t = TEXTES[langue].commande_livree;
  const paragraphes = [remplir(t.intro, { numero: d.numero })];
  if (d.lienWhatsapp) paragraphes.push(remplir(t.photo, { lien: d.lienWhatsapp }));
  const { html, texte } = envelopper({ langue, nomSite: d.nomSite, titre: t.titre, paragraphes, texteLien: t.lien, libelleBouton: t.bouton, url: d.url });
  return { sujet: remplir(t.sujet, { numero: d.numero }), html, texte };
}
