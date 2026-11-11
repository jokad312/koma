"use server";

import { lireNombreAffiches } from "./adresse";
import { listerEvenementsPublies } from "./queries-publiques";
import type { CarteEvenement } from "./types";

// Action du bouton « Voir plus » : les 12 Événements suivants. Le nombre et la langue viennent du navigateur et sont revalidés ici ;
// une valeur illisible est refusée, jamais devinée. Une erreur de lecture rend ok: false (l'interface garde le lien et affiche l'erreur).
export type ResultatVoirPlusEvenements = { ok: true; evenements: CarteEvenement[]; suite: number | null } | { ok: false };

export async function chargerPlusEvenements(affiches: number, locale: string): Promise<ResultatVoirPlusEvenements> {
  if (locale !== "fr" && locale !== "en") return { ok: false };
  const n = lireNombreAffiches(String(affiches));
  if (!n) return { ok: false };
  try {
    const page = await listerEvenementsPublies(locale, n);
    return { ok: true, evenements: page.evenements, suite: page.suite };
  } catch {
    console.error("[festival] voir plus : lecture impossible");
    return { ok: false };
  }
}
