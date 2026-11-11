import { z } from "zod";
import { CANAUX_ALERTE } from "./types";

export const canalSchema = z.enum(CANAUX_ALERTE);
export const evenementIdSchema = z.uuid();
export const langueAlerteSchema = z.enum(["fr", "en"]);
// Mêmes bornes que la base (inscrire_alerte_evenement) : adresse de 3 à 254 caractères, en minuscules.
export const emailAlerteSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((e) => e.toLowerCase());
// Même format que le réglage numero_whatsapp : « + » puis 8 à 15 chiffres, espaces ignorés.
export const whatsappAlerteSchema = z
  .string()
  .transform((n) => n.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\+[0-9]{8,15}$/));
