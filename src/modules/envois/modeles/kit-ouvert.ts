import type { LangueEmail, MessageEmail } from "../types";
import { envelopper, remplir, TEXTES } from "./commun";

export type DonneesKitOuvert = { nomSite: string; numero: string; titreKit: string; url: string };

export function rendreKitOuvert(langue: LangueEmail, d: DonneesKitOuvert): MessageEmail {
  const t = TEXTES[langue].kit_ouvert;
  const { html, texte } = envelopper({
    langue,
    nomSite: d.nomSite,
    titre: t.titre,
    paragraphes: [remplir(t.intro, { titre: d.titreKit, numero: d.numero })],
    texteLien: t.lien,
    libelleBouton: t.bouton,
    url: d.url,
  });
  return { sujet: remplir(t.sujet, { titre: d.titreKit }), html, texte };
}
