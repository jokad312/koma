"use server";

import { dependancesHeros } from "./heros-dependances";
import * as service from "./heros-service";
import type { CodeErreurHeros, EnvoiVideoAutorise, EtatVideo, ResultatHeros } from "./heros-types";

// Actions du réglage « héros » : jamais d'écriture depuis le navigateur ; le droit est revérifié dans le service ; le succès n'est rendu
// qu'après la réponse réelle de la base, de Bunny ou du stockage ; une exception ne devient jamais un succès (règle 13).
export type ReponseHeros<T extends object = object> = ({ statut: "succes" } & T) | { statut: "erreur"; erreur: CodeErreurHeros };

async function envelopper<T extends object>(nom: string, appel: () => Promise<ResultatHeros<T>>): Promise<ReponseHeros<T>> {
  try {
    const r = await appel();
    if (!r.ok) return { statut: "erreur", erreur: r.erreur };
    const { ok, ...reste } = r;
    void ok;
    return { statut: "succes", ...(reste as unknown as T) };
  } catch {
    console.error(`[heros] ${nom} : exception inattendue`);
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function choisirVedette(entree: { produitId: string | null }) {
  return envelopper("vedette", () => service.choisirVedette(dependancesHeros(), entree));
}

export async function demanderEnvoiVideo(entree: { type: string; taille: number }) {
  return envelopper<{ envoi: EnvoiVideoAutorise }>("envoi de vidéo", () => service.demanderEnvoiVideo(dependancesHeros(), entree));
}

export async function finaliserVideo(entree: { videoId: string }) {
  return envelopper("vidéo", () => service.finaliserVideo(dependancesHeros(), entree));
}

export async function annulerEnvoiVideo(entree: { videoId: string }) {
  return envelopper("annulation de vidéo", () => service.annulerEnvoiVideo(dependancesHeros(), entree));
}

export async function supprimerVideo() {
  return envelopper("retrait de vidéo", () => service.supprimerVideo(dependancesHeros()));
}

export async function verifierVideo() {
  return envelopper<{ video: EtatVideo }>("vérification de vidéo", () => service.verifierVideo(dependancesHeros()));
}

export async function demanderEnvoiRepli(entree: { type: string; taille: number; altFr: string; altEn: string }) {
  return envelopper<{ objet: string; jeton: string }>("envoi du repli", () => service.demanderEnvoiRepli(dependancesHeros(), entree));
}

export async function finaliserRepli(entree: { objet: string; altFr: string; altEn: string }) {
  return envelopper("repli", () => service.finaliserRepli(dependancesHeros(), entree));
}

export async function annulerEnvoiRepli(entree: { objet: string }) {
  return envelopper("annulation du repli", () => service.annulerEnvoiRepli(dependancesHeros(), entree));
}

export async function modifierAltRepli(entree: { altFr: string; altEn: string }) {
  return envelopper("textes alternatifs du repli", () => service.modifierAltRepli(dependancesHeros(), entree));
}
