// Lien WhatsApp depuis le numéro réglé par l'admin (format « + » puis 8 à 15 chiffres). Sans message prérempli (hypothèse non validée).
// Un numéro absent ou mal formé ne donne aucun lien : jamais de numéro de repli.
// Message prérempli facultatif (story 6.4) : texte venu des fichiers de messages, encodé pour l'adresse.
export function lienWhatsapp(numero: string | null | undefined, message?: string): string | null {
  const chiffres = (numero ?? "").trim().replace(/\s/g, "");
  if (!/^\+[0-9]{8,15}$/.test(chiffres)) return null;
  const base = `https://wa.me/${chiffres.slice(1)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
