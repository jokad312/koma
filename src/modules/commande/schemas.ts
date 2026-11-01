import { z } from "zod";

// Version du texte de la Licence de kit enregistrée avec l'acceptation (AD-34). À changer dès que Jonathan fournit le texte
// définitif (Q-5) : les acceptations déjà données gardent leur version.
export const VERSION_LICENCE_KIT = "v0-provisoire";
// Versions des textes des cases de l'étape de commande (AD-34), enregistrées avec chaque acceptation.
export const VERSION_CGV = "v0-provisoire";
export const VERSION_KIT_ACCES = "v0-provisoire";
export const VERSION_SUR_MESURE = "v1";

// Formulaire « Obtenir le kit gratuit » : le Kit, la case de la Licence cochée, une clé générée par le formulaire (une même clé = une même Commande).
export const obtenirKitGratuitSchema = z.object({
  produitId: z.uuid(),
  licenceAcceptee: z.literal(true),
  cleIdempotence: z.string().min(8).max(100),
});

export type EntreeObtenirKitGratuit = z.input<typeof obtenirKitGratuitSchema>;

export const ZONES = ["goma", "bukavu"] as const;
export const MODES = ["retrait", "livraison"] as const;
export type ZoneRemise = (typeof ZONES)[number];
export type ModeRemise = (typeof MODES)[number];

// Zone et Mode de remise : les deux ou aucun. Bukavu : livraison obligatoire (retrait gratuit à Goma seulement).
const remiseSchema = z
  .object({ zone: z.enum(ZONES).nullish(), mode: z.enum(MODES).nullish() })
  .refine((v) => (v.zone == null) === (v.mode == null), { message: "remise_incomplete" })
  .refine((v) => !(v.zone === "bukavu" && v.mode === "retrait"), { message: "remise_invalide" });

export const recapitulatifSchema = remiseSchema;
export type EntreeRecapitulatif = z.input<typeof recapitulatifSchema>;

// Origine de la vente (AD-19) : texte court en minuscules, validé aussi par la base.
export const origineSchema = z.string().regex(/^[a-z0-9_-]{1,40}$/);

// Étape de commande. Cases : CGV toujours ; Kit (accès immédiat) et sur mesure selon le contenu (la base vérifie lesquelles sont exigées).
export const creerCommandeSchema = z
  .object({
    zone: z.enum(ZONES).nullish(),
    mode: z.enum(MODES).nullish(),
    telephone: z.string().max(40).nullish(),
    adresse: z.string().max(500).nullish(),
    acceptations: z.object({ cgv: z.boolean(), kit: z.boolean().optional(), surMesure: z.boolean().optional() }),
    origine: origineSchema.nullish(),
    totalAttenduCents: z.number().int().min(0).max(100_000_000),
    empreinte: z.string().regex(/^[0-9a-f]{32}$/),
    cleIdempotence: z.string().min(8).max(100),
  })
  .refine((v) => (v.zone == null) === (v.mode == null), { message: "remise_incomplete" })
  .refine((v) => !(v.zone === "bukavu" && v.mode === "retrait"), { message: "remise_invalide" });

export type EntreeCreerCommande = z.input<typeof creerCommandeSchema>;
