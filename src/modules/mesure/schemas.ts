import { z } from "zod";
import { ACTIONS_MESURE } from "./actions";
import { APPAREILS, LANGUES_MESURE } from "./types";

// Story 9.7 : schéma strict du corps de POST /api/mesure. Aucun champ inconnu n'est toléré (pas de « page » envoyée par le
// client : le serveur recalcule le chemin depuis le Referer), aucune donnée personnelle n'a sa place ici.

const origineSchema = z.string().regex(/^[a-z0-9_-]{1,40}$/);
const domaineSchema = z.string().regex(/^[a-z0-9.-]{1,100}$/);

export const schemaEvenement = z
  .object({
    action: z.enum(ACTIONS_MESURE),
    langue: z.enum(LANGUES_MESURE),
    appareil: z.enum(APPAREILS),
    session: z.uuid(),
    origine: origineSchema.nullish(),
    provenance: domaineSchema.nullish(),
    duree: z.number().int().min(0).max(60000).nullish(),
  })
  .strict()
  .refine((valeur) => valeur.duree == null || valeur.action === "chargement_heros", { path: ["duree"] });

export type EntreeEvenement = z.infer<typeof schemaEvenement>;
