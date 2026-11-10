import "server-only";
import { cacheTag } from "next/cache";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientPublic } from "@/lib/supabase/public";
import type { CurseurMur, MurPublic, PageMur, TypeMur } from "./types";
import { CUMUL_MAX_MURS, TAILLE_PAGE_MURS } from "./types";
import { encoderCurseurMurs } from "./adresse";

// Colonnes lues par le mur public, d'après la fonction `lister_mur_public` (types générés).
type LigneMur = {
  id: string;
  fichier: string;
  alt_fr: string;
  alt_en: string;
  pseudo: string | null;
  valide_le: string;
  type: string;
  fait_avec_kit: boolean;
  kit_slug: string | null;
  kit_titre_fr: string | null;
  kit_titre_en: string | null;
  curseur_date: string;
};

function client() {
  return creerClientPublic();
}

// Une entrée du mur, telle que rendue : le type vient de la base, la mention et le lien Kit du contexte de la ligne.
function versMur(l: LigneMur): MurPublic {
  return {
    id: l.id,
    fichier: l.fichier,
    altFr: l.alt_fr,
    altEn: l.alt_en,
    pseudo: l.pseudo ?? null,
    valideLe: l.valide_le,
    curseurDate: l.curseur_date,
    type: l.type === "realisation" ? ("realisation" as TypeMur) : "photo",
    faitAvecKit: Boolean(l.fait_avec_kit),
    kitSlug: l.kit_slug ?? null,
    kitTitreFr: l.kit_titre_fr ?? null,
    kitTitreEn: l.kit_titre_en ?? null,
  };
}

// Mur public (story 8.3) : les entrées publiées et non retirées, par la fonction `lister_mur_public` (lecture publique,
// garde AD-17). Une erreur de lecture est relancée : jamais une liste vide inventée.
//   - sans curseur : la première page (24 entrées, tri validation la plus récente d'abord) ;
//   - avec curseur : la page suivante, après la dernière entrée déjà affichée (déjà affichées + nouvelles pour le curseur).
// Lecture SANS cache : pour un curseur venu du navigateur (Server Action « Voir plus », adresse ?curseur=). Un curseur forgé ne crée jamais
// d'entrée de cache (le cache grossirait sans borne) ; seule la première page, sans curseur, est mise en cache (listerMurs).
export async function lireMurs(curseur: CurseurMur | null, options: { cumul?: boolean } = {}): Promise<PageMur> {
  const cumul = Boolean(options.cumul && curseur);
  const dejaVus = curseur?.n ?? 0;
  const taille = TAILLE_PAGE_MURS;
  const args: { p_curseur_date?: string; p_curseur_id?: string; p_limite: number } = { p_limite: taille };
  if (curseur) {
    args.p_curseur_date = curseur.date;
    args.p_curseur_id = curseur.id;
  }
  const { data, error } = await client().rpc("lister_mur_public", args);
  if (error || !data) throw new Error("Lecture du mur impossible.");
  const lignes = (data as LigneMur[]).slice(0, taille);
  const murs = lignes.map(versMur);
  const affiches = (cumul ? dejaVus : 0) + murs.length;
  const dernier = murs[murs.length - 1];
  // La fonction plafonne la page à 24 lignes : une page pleine peut avoir une suite. On la vérifie par une lecture d'une ligne
  // après le curseur, pour ne jamais proposer « Voir plus » devant une liste vide.
  let suite: string | null = null;
  if (lignes.length === taille && dernier && affiches < CUMUL_MAX_MURS) {
    const suivante = await client().rpc("lister_mur_public", { p_curseur_date: dernier.curseurDate, p_curseur_id: dernier.id, p_limite: 1 });
    if (suivante.error || !suivante.data) throw new Error("Lecture du mur impossible.");
    if ((suivante.data as LigneMur[]).length > 0) suite = encoderCurseurMurs({ date: dernier.curseurDate, id: dernier.id, n: affiches });
  }
  return { murs, suite };
}

// Première page du mur, mise en cache sous l'étiquette `galerie` (invalidée par l'admin à chaque validation et retrait).
export async function listerMurs(): Promise<PageMur> {
  "use cache";
  cacheTag(ETIQUETTES.galerie);
  return lireMurs(null);
}

// Le mur a-t-il au moins une entrée publiée ? Une erreur de lecture n'affiche pas le lien (pied de page, entrée secondaire).
export async function lireMurPublie(): Promise<boolean> {
  try {
    const page = await listerMurs();
    return page.murs.length > 0;
  } catch {
    console.error("[communaute] lecture du mur impossible : lien de pied masqué");
    return false;
  }
}
