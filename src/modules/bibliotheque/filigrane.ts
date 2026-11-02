import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// « jo•••@gmail.com » : les 2 premiers caractères de l'email, « ••• », puis le domaine (décision du 2026-10-21).
// Un email sans « @ » exploitable ne laisse rien filtrer d'autre que « ••• ».
export function masquerEmail(email: string): string {
  const arobase = email.lastIndexOf("@");
  if (arobase < 1) return "•••";
  const local = Array.from(email.slice(0, arobase));
  return `${local.slice(0, 2).join("")}•••${email.slice(arobase)}`;
}

const TAILLE_MAX = 8;
const TAILLE_MIN = 5;
const MARGE_BAS = 14;
const MARGE_COTE = 24;

// Écrit le texte en bas de chaque page, en gris discret, dans la marge basse (hors de la zone imprimée habituelle).
// La taille diminue si la ligne dépasse la largeur de la page. Renvoie les octets du nouveau PDF ; l'original n'est pas modifié.
export async function appliquerFiligrane(pdf: Uint8Array, texte: string, police: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.load(pdf, { ignoreEncryption: false });
  document.registerFontkit(fontkit);
  const fonte = await document.embedFont(police, { subset: false });
  for (const page of document.getPages()) {
    const { width } = page.getSize();
    const disponible = Math.max(width - 2 * MARGE_COTE, 20);
    let taille = TAILLE_MAX;
    while (taille > TAILLE_MIN && fonte.widthOfTextAtSize(texte, taille) > disponible) taille -= 0.5;
    const largeur = fonte.widthOfTextAtSize(texte, taille);
    page.drawText(texte, {
      x: Math.max((width - largeur) / 2, MARGE_COTE / 2),
      y: MARGE_BAS,
      size: taille,
      font: fonte,
      color: rgb(0.45, 0.45, 0.45),
      opacity: 0.8,
    });
  }
  return document.save();
}
