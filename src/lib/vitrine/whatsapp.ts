// Lien WhatsApp depuis le numéro réglé par l'admin (format « + » puis 8 à 15 chiffres). Sans message prérempli (hypothèse non validée).
// Un numéro absent ou mal formé ne donne aucun lien : jamais de numéro de repli.
export function lienWhatsapp(numero: string | null | undefined): string | null {
  const chiffres = (numero ?? "").trim().replace(/\s/g, "");
  if (!/^\+[0-9]{8,15}$/.test(chiffres)) return null;
  return `https://wa.me/${chiffres.slice(1)}`;
}
