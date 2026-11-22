import { messageSur } from "@/lib/journal-cause";

// Bug A2 (2026-11-22) : un échec de lecture du catalogue est journalisé avec sa cause, pour savoir quoi corriger.
// Cause = « Nom: message » assaini par la règle commune (src/lib/journal-cause.ts), puis, si l'erreur garde une erreur Supabase en
// cause, « (code=… message=…) ». Un seul niveau de cause, jamais details ni hint (qui peuvent citer des valeurs). Jamais l'adresse,
// les paramètres de la requête, un identifiant ou une donnée de la personne.
export function causeErreur(erreur: unknown): string {
  if (!(erreur instanceof Error)) return "erreur inconnue";
  const message = messageSur(erreur.message);
  return `${message ? `${erreur.name}: ${message}` : erreur.name}${causeSupabase(erreur.cause)}`;
}

function causeSupabase(cause: unknown): string {
  if (typeof cause !== "object" || cause === null) return "";
  const { code, message } = cause as { code?: unknown; message?: unknown };
  if (typeof code !== "string" && typeof message !== "string") return "";
  const codeLu = typeof code === "string" && code ? messageSur(code) : "?";
  const messageLu = typeof message === "string" ? messageSur(message) : "";
  return ` (code=${codeLu} message=${messageLu})`;
}

// Lecture du catalogue nommée : en cas d'échec, l'erreur dit laquelle (produits, univers ou tranches de prix).
export type LectureCatalogue = "produits" | "univers" | "tranches";

export class ErreurLectureCatalogue extends Error {
  constructor(
    readonly lecture: LectureCatalogue,
    cause: unknown,
  ) {
    super(`lecture ${lecture} impossible`, { cause });
    this.name = "ErreurLectureCatalogue";
  }
}

export async function lectureNommee<T>(lecture: LectureCatalogue, promesse: Promise<T>): Promise<T> {
  try {
    return await promesse;
  } catch (e) {
    throw new ErreurLectureCatalogue(lecture, e);
  }
}

export function journaliserLectureImpossible(contexte: string, erreur: unknown) {
  const lecture = erreur instanceof ErreurLectureCatalogue ? ` (${erreur.lecture})` : "";
  const cause = causeErreur(erreur instanceof ErreurLectureCatalogue ? erreur.cause : erreur);
  console.error(`[catalogue] ${contexte}${lecture} : ${cause}`);
}
