import { z } from "zod";
import { MAX_PASS_PAR_COMMANDE } from "./achat-types";

const lignePassSchema = z.object({
  typePassId: z.uuid(),
  // Un nom par Pass ; le nettoyage et les bornes sont revérifiés par la base.
  titulaires: z.array(z.string().max(200)).min(1).max(MAX_PASS_PAR_COMMANDE),
});

const codeSaisi = z.string().max(40).nullish();

// Récapitulatif : l'Événement, les lignes et le code éventuel. « pourMoi » : le premier nom est celui de l'acheteur.
export const recapitulatifPassSchema = z.object({
  evenementId: z.uuid(),
  lignes: z.array(lignePassSchema).min(1).max(MAX_PASS_PAR_COMMANDE),
  pourMoi: z.boolean(),
  code: codeSaisi,
});
export type EntreeRecapitulatifPass = z.input<typeof recapitulatifPassSchema>;

// Création : la case de la mention (obligatoire, jamais pré-cochée), le total vu et une clé d'idempotence générée par le formulaire.
export const creerCommandePassSchema = recapitulatifPassSchema.extend({
  mention: z.literal(true),
  totalAttenduCents: z.number().int().min(0).max(100_000_000),
  cleIdempotence: z.string().min(8).max(100),
});
export type EntreeCreerCommandePass = z.input<typeof creerCommandePassSchema>;
