import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import type { LangueEmail, MessageEmail } from "../types";

// Textes des emails : messages/*.json (espace « Emails »), jamais en dur ici. Interpolation simple {variable}.
export type TextesEmails = typeof fr.Emails;
export const TEXTES: Record<LangueEmail, TextesEmails> = { fr: fr.Emails, en: en.Emails };

export function remplir(modele: string, valeurs: Record<string, string | number>): string {
  return modele.replace(/\{(\w+)\}/g, (tout, cle: string) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

export function echapperHtml(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Gabarit commun : polices système, fond clair, un bouton rouge à texte blanc (#E3261C), le lien aussi écrit en texte (UX-DR31).
// Pas de logo : aucun fichier de logo validé n'est encore utilisé dans les emails.
export function envelopper(args: {
  langue: LangueEmail;
  nomSite: string;
  titre: string;
  paragraphes: string[];
  lignes?: string[];
  total?: string;
  // Paragraphe écrit après le total et avant le lien (facultatif).
  paragrapheFinal?: string;
  // Bloc libre écrit après les paragraphes (Pass émis, story 7.5) : le HTML doit être déjà échappé par l'appelant.
  bloc?: { html: string; texte: string[] };
  texteLien: string;
  libelleBouton: string;
  url: string;
  // Email commercial (stories 9.4 et 9.6) : lien de désinscription en pied, toujours présent dans ces emails.
  desinscription?: { texte: string; libelle: string; url: string };
}): { html: string; texte: string } {
  const t = TEXTES[args.langue];
  const p = (s: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${echapperHtml(s)}</p>`;
  const html = [
    `<!doctype html><html lang="${args.langue}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapperHtml(args.titre)}</title></head>`,
    `<body style="margin:0;padding:24px 16px;background:#f6f1e7;color:#1a1a1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:24px;border:1px solid #e0d8c8;">`,
    `<p style="margin:0 0 8px;font-size:14px;color:#555555;">${echapperHtml(args.nomSite)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${echapperHtml(args.titre)}</h1>`,
    p(t.commun.bonjour),
    ...args.paragraphes.map(p),
    ...(args.bloc ? [args.bloc.html] : []),
    ...(args.lignes && args.lignes.length > 0 ? [`<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.5;">${args.lignes.map((l) => `<li>${echapperHtml(l)}</li>`).join("")}</ul>`] : []),
    ...(args.total ? [`<p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${echapperHtml(args.total)}</p>`] : []),
    ...(args.paragrapheFinal ? [p(args.paragrapheFinal)] : []),
    p(args.texteLien),
    `<p style="margin:0 0 16px;"><a href="${echapperHtml(args.url)}" style="display:inline-block;background:#E3261C;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;font-size:16px;">${echapperHtml(args.libelleBouton)}</a></p>`,
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;word-break:break-all;">${echapperHtml(remplir(t.commun.lienTexte, { url: args.url }))}</p>`,
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#555555;">${echapperHtml(remplir(t.commun.pied, { nomSite: args.nomSite }))}</p>`,
    ...(args.desinscription
      ? [
          `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#555555;">${echapperHtml(args.desinscription.texte)} <a href="${echapperHtml(args.desinscription.url)}" style="color:#1a1a1a;">${echapperHtml(args.desinscription.libelle)}</a></p>`,
        ]
      : []),
    `</div></body></html>`,
  ].join("");
  const texte = [
    args.titre,
    "",
    t.commun.bonjour,
    "",
    ...args.paragraphes.flatMap((x) => [x, ""]),
    ...(args.bloc ? [...args.bloc.texte, ""] : []),
    ...(args.lignes && args.lignes.length > 0 ? [...args.lignes.map((l) => `- ${l}`), ""] : []),
    ...(args.total ? [args.total, ""] : []),
    ...(args.paragrapheFinal ? [args.paragrapheFinal, ""] : []),
    args.texteLien,
    args.url,
    "",
    remplir(t.commun.pied, { nomSite: args.nomSite }),
    ...(args.desinscription ? ["", `${args.desinscription.texte} ${args.desinscription.libelle}`, args.desinscription.url] : []),
  ].join("\n");
  return { html, texte };
}

export type { MessageEmail };
