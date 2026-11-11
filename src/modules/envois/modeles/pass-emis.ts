import { chargeQr, codeQrEnGif } from "@/modules/evenements/pass-qr";
import type { LangueEmail, MessageEmail, PieceJointe } from "../types";
import { echapperHtml, envelopper, remplir, TEXTES } from "./commun";

export type PassEmail = {
  id: string;
  typeNom: string;
  nomTitulaire: string;
  evenement: string;
  // Date déjà formatée à l'heure de Goma, ou null si l'Événement n'a pas de date (rien n'est inventé).
  date: string | null;
  lieu: string | null;
  codeCourt: string;
  jeton: string;
};

export type DonneesPassEmis = { nomSite: string; numero: string; url: string; pass: PassEmail[] };

// Email « Pass émis » (story 7.5, FR-34, UX-DR40) : tous les Pass de la Commande, chacun avec son nom, son Type, son Événement, sa date et son lieu,
// son code court en texte et son Code QR (image jointe, affichée dans le message, sur fond blanc avec sa zone de silence), alt identique à « Mes Pass ».
// Le client transmet lui-même chaque Pass à la personne concernée. Le jeton ne sort que dans l'image du Code QR.
export function rendrePassEmis(langue: LangueEmail, d: DonneesPassEmis): MessageEmail {
  const t = TEXTES[langue].pass_emis;
  const evenements = [...new Set(d.pass.map((p) => p.evenement))];
  const pieces: PieceJointe[] = [];
  const blocsHtml: string[] = [];
  const blocsTexte: string[] = [];

  d.pass.forEach((p, i) => {
    const contentId = `pass-${p.id}`;
    const alt = remplir(t.qrAlt, { type: p.typeNom, nom: p.nomTitulaire, evenement: p.evenement });
    pieces.push({ nom: `code-qr-${i + 1}.gif`, contenu: codeQrEnGif(chargeQr(p.jeton)), type: "image/gif", contentId });
    const titre = remplir(t.pass, { type: p.typeNom, nom: p.nomTitulaire });
    const lignes = [
      remplir(t.evenement, { evenement: p.evenement }),
      ...(p.date ? [remplir(t.date, { date: p.date })] : []),
      ...(p.lieu ? [remplir(t.lieu, { lieu: p.lieu })] : []),
    ];
    blocsHtml.push(
      [
        `<div style="margin:0 0 16px;padding:16px;border:1px solid #e0d8c8;">`,
        `<p style="margin:0 0 8px;font-size:18px;font-weight:bold;line-height:1.3;">${echapperHtml(titre)}</p>`,
        ...lignes.map((l) => `<p style="margin:0 0 4px;font-size:15px;line-height:1.4;">${echapperHtml(l)}</p>`),
        // Fond blanc pur autour du Code QR (zone de silence comprise dans l'image).
        `<p style="margin:12px 0;background:#ffffff;"><img src="cid:${echapperHtml(contentId)}" alt="${echapperHtml(alt)}" style="display:block;width:250px;max-width:100%;height:auto;background:#ffffff;"></p>`,
        `<p style="margin:0;font-size:16px;line-height:1.4;">${echapperHtml(remplir(t.codeCourt, { code: p.codeCourt }))}</p>`,
        `</div>`,
      ].join(""),
    );
    blocsTexte.push(titre, ...lignes, remplir(t.codeCourt, { code: p.codeCourt }), t.qrTexte, "");
  });

  const { html, texte } = envelopper({
    langue,
    nomSite: d.nomSite,
    titre: t.titre,
    paragraphes: [remplir(t.intro, { numero: d.numero }), t.transmettre],
    bloc: { html: blocsHtml.join(""), texte: blocsTexte },
    texteLien: t.lien,
    libelleBouton: t.bouton,
    url: d.url,
  });
  return { sujet: remplir(t.sujet, { evenement: evenements.join(", ") }), html, texte, pieces };
}
