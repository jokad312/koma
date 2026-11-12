import { z } from "zod";
import type { Droit } from "@/lib/auth/matrice-droits";
import type { AuteurCompte } from "@/lib/auth/auteur";

// Opération « 10 Pass gratuits » (story 8.5, FR-42, AD-33) : l'Admin offre un Pass Standard à l'auteur d'une Réalisation validée.
// Droit « evenements.gerer » (Admin seulement). La base revérifie tout (Réalisation validée, Kit payé, rang 1 à 10, un Pass par Compte et par Événement,
// place restante) et fait tout dans une transaction ; le succès n'est annoncé qu'après sa réponse réelle (règle 13). Aucun email ici : le Pass émis
// planifie lui-même l'email « pass_emis » dans la boîte d'envoi.

export type OptionsPassOffert = {
  evenements: { id: string; titreFr: string; titreEn: string | null; debutLe: string; attribues: number; types: { id: string; nomFr: string; nomEn: string | null }[] }[];
  // Attributions déjà faites, par photo de Réalisation.
  attributions: { photoId: string; evenementId: string; titreFr: string; titreEn: string | null; rang: number }[];
};

export type ErreurPassOffert =
  | "non_autorise"
  | "entree_invalide"
  | "introuvable"
  | "non_validee"
  | "kit_non_paye"
  | "type_introuvable"
  | "evenement_indisponible"
  | "deja_utilisee"
  | "deja_offert"
  | "terminee"
  | "complet"
  | "nom_requis"
  | "generique";
export type ResultatPassOffert = { ok: true; rang: number } | { ok: false; erreur: ErreurPassOffert };

export type DependancesPassOffert = {
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  // Compte, Réalisation et pseudo d'une photo de Réalisation.
  lireRealisation(args: { auteur: AuteurCompte; photoId: string }): Promise<{ realisationId: string; compteId: string; nomAffiche: string | null } | { erreur: string }>;
  nomDuCompte(compteId: string): Promise<string | null>;
  attribuer(args: { auteur: AuteurCompte; realisationId: string; typePassId: string; titulaire: string }): Promise<{ attribue: boolean; rang: number; erreur: string | null }>;
  invalider(): Promise<void>;
};

const CORRESPONDANCES: readonly [string, ErreurPassOffert][] = [
  ["KS_REALISATION_INTROUVABLE", "introuvable"],
  ["KS_REALISATION_NON_VALIDEE", "non_validee"],
  ["KS_KIT_NON_PAYE", "kit_non_paye"],
  ["KS_TYPE_PASS_INTROUVABLE", "type_introuvable"],
  ["KS_EVENEMENT_INDISPONIBLE", "evenement_indisponible"],
  ["KS_REALISATION_DEJA_UTILISEE", "deja_utilisee"],
  ["KS_DEJA_OFFERT", "deja_offert"],
  ["KS_OPERATION_TERMINEE", "terminee"],
  ["KS_COMPLET", "complet"],
  ["KS_TITULAIRE_INVALIDE", "nom_requis"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

const entreeSchema = z.object({ photoId: z.string().uuid(), typePassId: z.string().uuid() });

function nettoyerNom(nom: string): string {
  return nom.replace(/\s+/g, " ").trim();
}

export async function attribuerPassOffert(deps: DependancesPassOffert, entree: unknown): Promise<ResultatPassOffert> {
  const lu = entreeSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "entree_invalide" };
  let auteur: AuteurCompte;
  try {
    ({ auteur } = await deps.exigerDroit("evenements.gerer"));
  } catch {
    return { ok: false, erreur: "non_autorise" };
  }
  try {
    const r = await deps.lireRealisation({ auteur, photoId: lu.data.photoId });
    if ("erreur" in r) {
      console.error(`[pass-offert] lecture de la Réalisation : ${/KS_[A-Z_]+/.exec(r.erreur)?.[0] ?? "inconnue"}`);
      return { ok: false, erreur: r.erreur.includes("KS_REALISATION_INTROUVABLE") ? "introuvable" : r.erreur.includes("KS_DROIT_REFUSE") ? "non_autorise" : "generique" };
    }
    // Nom du Compte, sinon pseudo choisi pour la galerie ; jamais un nom inventé : sans nom, l'Admin doit le demander au client.
    const nom = nettoyerNom((await deps.nomDuCompte(r.compteId)) ?? r.nomAffiche ?? "");
    if (nom.length < 2) return { ok: false, erreur: "nom_requis" };
    const a = await deps.attribuer({ auteur, realisationId: r.realisationId, typePassId: lu.data.typePassId, titulaire: nom });
    if (a.erreur) {
      console.error(`[pass-offert] attribution : ${/KS_[A-Z_]+/.exec(a.erreur)?.[0] ?? "inconnue"}`);
      const trouve = CORRESPONDANCES.find(([code]) => a.erreur?.includes(code));
      return { ok: false, erreur: trouve ? trouve[1] : "generique" };
    }
    // Événement complet : la base a créé l'anomalie « pass_offert_impossible » et n'a rien attribué.
    if (!a.attribue) {
      await deps.invalider();
      return { ok: false, erreur: "complet" };
    }
    await deps.invalider();
    return { ok: true, rang: a.rang };
  } catch {
    console.error("[pass-offert] exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}
