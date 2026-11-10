"use server";

import { decoderCurseurMurs } from "./adresse";
import { lireMurs } from "./queries";
import type { CurseurMur, MurPublic } from "./types";

// Action du bouton « Voir plus » du mur : les entrées suivantes. Le curseur et la langue viennent du navigateur et sont revalidés ici ;
// un curseur illisible est refusé, jamais deviné. Une erreur de lecture rend ok: false (l'interface garde le lien et affiche l'erreur).
export type ResultatVoirPlusMurs = { ok: true; murs: MurPublic[]; suite: string | null } | { ok: false };

export async function chargerPlusMurs(curseur: string): Promise<ResultatVoirPlusMurs> {
  if (typeof curseur !== "string" || curseur.length > 200 || curseur === "") return { ok: false };
  const decode: CurseurMur | null = decoderCurseurMurs(curseur);
  if (!decode) return { ok: false };
  try {
    const page = await lireMurs(decode, { cumul: true });
    return { ok: true, murs: page.murs, suite: page.suite };
  } catch {
    console.error("[communaute] voir plus : lecture du mur impossible");
    return { ok: false };
  }
}
