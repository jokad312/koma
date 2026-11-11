import { formaterUsd } from "@/lib/argent";
import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

export type DonneesPassStatut = {
  nomSite: string;
  numero: string;
  // Page « Mes Pass » (adresse lue depuis NEXT_PUBLIC_SITE_URL).
  url: string;
  nomTitulaire: string;
  evenement: string;
  // Montant figé dans le remboursement par annuler_pass, relu en base au moment du rendu (USD seulement).
  montantCents: number;
};

// Emails « Pass annulé » (annuler_pass) et « Pass remboursé » (confirmer_remboursement) : story 7.9, textes dans messages/*.json (espace Emails).
// Aucun jeton ni code court : un Pass annulé n'ouvre plus l'entrée.
export function rendrePassAnnule(langue: LangueEmail, d: DonneesPassStatut): MessageEmail {
  const t = TEXTES[langue].pass_annule;
  const paragraphes = [remplir(t.intro, { numero: d.numero, nom: d.nomTitulaire, evenement: d.evenement }), remplir(t.montant, { montant: formaterUsd(d.montantCents, langue) })];
  const { html, texte } = envelopper({ langue, nomSite: d.nomSite, titre: t.titre, paragraphes, texteLien: t.lien, libelleBouton: t.bouton, url: d.url });
  return { sujet: remplir(t.sujet, { evenement: d.evenement }), html, texte };
}

export function rendrePassRembourse(langue: LangueEmail, d: DonneesPassStatut): MessageEmail {
  const t = TEXTES[langue].pass_rembourse;
  const paragraphes = [remplir(t.intro, { numero: d.numero, nom: d.nomTitulaire, evenement: d.evenement }), remplir(t.montant, { montant: formaterUsd(d.montantCents, langue) })];
  const { html, texte } = envelopper({ langue, nomSite: d.nomSite, titre: t.titre, paragraphes, texteLien: t.lien, libelleBouton: t.bouton, url: d.url });
  return { sujet: remplir(t.sujet, { evenement: d.evenement }), html, texte };
}
