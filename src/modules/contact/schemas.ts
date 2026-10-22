import { z } from "zod";

export const LANGUES_CONTACT = ["fr", "en"] as const;

// Nom 1 à 80, email valide et 254 au plus, message 10 à 2000 (mêmes bornes que la base).
export const nomSchema = z.string().trim().min(1).max(80);
export const emailSchema = z.string().trim().max(254).pipe(z.email());
export const messageSchema = z.string().trim().min(10).max(2000);

export const langueContactSchema = z.enum(LANGUES_CONTACT);

export const messageContactSchema = z.object({
  nom: nomSchema,
  email: emailSchema,
  message: messageSchema,
  langue: langueContactSchema,
});

export type EntreeContact = z.input<typeof messageContactSchema>;
