import { z } from "zod";
import { analyserMontantUsd } from "@/lib/argent";
import { CHEMIN_IMAGE_EVENEMENT, type CodeErreurEvenement } from "./types";

const videEnNull = (valeur: unknown) => (typeof valeur === "string" && valeur.trim() === "" ? null : valeur);

// Date et heure saisies à l'heure de Goma : « AAAA-MM-JJTHH:mm » ; vide = pas de date.
const dateSaisie = z.preprocess(
  videEnNull,
  z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/, "date_invalide")
    .refine((v) => !Number.isNaN(new Date(`${v}:00Z`).getTime()), "date_invalide")
    .nullish(),
);

const imageSchema = z.object({
  fichier: z.string().regex(CHEMIN_IMAGE_EVENEMENT, "evenement_invalide"),
  altFr: z.string().trim().min(1, "alt_invalide").max(200, "alt_invalide"),
  altEn: z.string().trim().min(1, "alt_invalide").max(200, "alt_invalide"),
});

const entierOptionnel = (max: number, code: CodeErreurEvenement) =>
  z.preprocess(
    videEnNull,
    z
      .string()
      .trim()
      .regex(/^[0-9]{1,6}$/, code)
      .refine((v) => Number(v) >= 1 && Number(v) <= max, code)
      .nullish(),
  );

const typeSchema = z.object({
  id: z.preprocess(videEnNull, z.uuid("type_pass_introuvable").nullish()),
  nomFr: z.string().trim().min(1, "type_pass_invalide").max(80, "type_pass_invalide"),
  nomEn: z.preprocess(videEnNull, z.string().trim().max(80, "type_pass_invalide").nullish()),
  // Prix en USD (zéro permis : Pass offert) ; converti en centimes par le service.
  prixUsd: z.string().refine((v) => analyserMontantUsd(v, 1_000_000).ok, "prix_invalide"),
  quota: entierOptionnel(100_000, "quota_invalide"),
  inclusFr: z.preprocess(videEnNull, z.string().max(1000, "type_pass_invalide").nullish()),
  inclusEn: z.preprocess(videEnNull, z.string().max(1000, "type_pass_invalide").nullish()),
  estStand: z.boolean(),
});

export const schemaEvenement = z.object({
  titreFr: z.string().trim().min(1, "titre_invalide").max(120, "titre_invalide"),
  titreEn: z.preprocess(videEnNull, z.string().trim().max(120, "titre_invalide").nullish()),
  slug: z.preprocess(videEnNull, z.string().trim().max(80, "slug_invalide").regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug_invalide").nullish()),
  descriptionFr: z.preprocess(videEnNull, z.string().max(5000, "texte_invalide").nullish()),
  descriptionEn: z.preprocess(videEnNull, z.string().max(5000, "texte_invalide").nullish()),
  lieuType: z.preprocess(videEnNull, z.enum(["salle", "plein_air"], "lieu_invalide").nullish()),
  lieuFr: z.preprocess(videEnNull, z.string().trim().max(200, "lieu_invalide").nullish()),
  lieuEn: z.preprocess(videEnNull, z.string().trim().max(200, "lieu_invalide").nullish()),
  debut: dateSaisie,
  fin: dateSaisie,
  venteOuvre: dateSaisie,
  venteFerme: dateSaisie,
  capacite: entierOptionnel(100_000, "capacite_invalide"),
  images: z.array(imageSchema).max(10, "images_limite").default([]),
  types: z.array(typeSchema).max(20, "type_pass_invalide").default([]),
});

const CODES: ReadonlySet<string> = new Set<CodeErreurEvenement>([
  "evenement_invalide",
  "titre_invalide",
  "texte_invalide",
  "slug_invalide",
  "slug_pris",
  "lieu_invalide",
  "date_invalide",
  "capacite_invalide",
  "type_pass_invalide",
  "prix_invalide",
  "quota_invalide",
  "evenement_introuvable",
  "type_pass_introuvable",
  "type_pass_vendu",
  "publication_incomplete",
  "non_autorise",
  "format_invalide",
  "fichier_trop_lourd",
  "alt_invalide",
  "images_limite",
  "generique",
]);

export function codeErreurSchema(valeur: unknown): CodeErreurEvenement {
  return typeof valeur === "string" && CODES.has(valeur) ? (valeur as CodeErreurEvenement) : "evenement_invalide";
}
