import { z } from "zod";

// Version du texte de la Licence de kit enregistrée avec l'acceptation (AD-34). À changer dès que Jonathan fournit le texte
// définitif (Q-5) : les acceptations déjà données gardent leur version.
export const VERSION_LICENCE_KIT = "v0-provisoire";

// Formulaire « Obtenir le kit gratuit » : le Kit, la case de la Licence cochée, une clé générée par le formulaire (une même clé = une même Commande).
export const obtenirKitGratuitSchema = z.object({
  produitId: z.uuid(),
  licenceAcceptee: z.literal(true),
  cleIdempotence: z.string().min(8).max(100),
});

export type EntreeObtenirKitGratuit = z.input<typeof obtenirKitGratuitSchema>;
