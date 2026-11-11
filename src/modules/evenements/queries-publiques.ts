import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientPublic } from "@/lib/supabase/public";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { lireImages } from "./images";
import { CUMUL_MAX_EVENEMENTS, TAILLE_PAGE_EVENEMENTS } from "./types";
import type { CarteEvenement, EvenementPublic, ImageEvenement, PageEvenements, TypePassPublic } from "./types";

// Lecture publique (story 7.2) : client PUBLIC seulement. La RLS ne montre que les Événements publiés ; les colonnes sont nommées
// (jamais select("*")) car le droit de lecture anonyme est limité aux colonnes listées. Une erreur de lecture est relancée :
// jamais une liste vide inventée (l'appelant masque la section ou affiche un message sobre).

const COLONNES_CARTE = "id, slug, titre_fr, titre_en, lieu_fr, lieu_en, debut_le, images";

type LigneCarte = {
  id: string;
  slug: string;
  titre_fr: string;
  titre_en: string | null;
  lieu_fr: string | null;
  lieu_en: string | null;
  debut_le: string | null;
  images: unknown;
};

function dansLaLangue(locale: "fr" | "en", fr: string | null, en: string | null): string | null {
  const texte = (locale === "en" ? en?.trim() : "") || fr?.trim() || "";
  return texte === "" ? null : texte;
}

// Le texte alternatif suit la langue quand il existe ; repli sur le français, jamais un texte inventé.
function altDeLaLangue(locale: "fr" | "en", image: ImageEvenement): string {
  return locale === "en" ? image.altEn.trim() || image.altFr : image.altFr;
}

function versCarte(locale: "fr" | "en", ligne: LigneCarte, passe: boolean): CarteEvenement | null {
  if (!ligne.slug || !ligne.debut_le) return null;
  const premiere = lireImages(ligne.images)[0];
  return {
    id: ligne.id,
    slug: ligne.slug,
    titre: dansLaLangue(locale, ligne.titre_fr, ligne.titre_en) ?? ligne.titre_fr,
    debutLe: ligne.debut_le,
    lieu: dansLaLangue(locale, ligne.lieu_fr, ligne.lieu_en),
    vignetteUrl: premiere ? urlPhotoPublique(premiere.fichier) : null,
    vignetteAlt: premiere ? altDeLaLangue(locale, premiere) : null,
    passe,
  };
}

// Une page de la liste publique : d'abord les Événements à venir (début le plus proche en premier), puis les passés (le plus récent
// en premier), 12 à la fois. « deja » est le nombre d'Événements déjà montrés :
//  - cumul (page rendue par le serveur) : relit depuis le début les « deja » Événements puis les 12 suivants ;
//  - sinon (Server Action « Voir plus ») : seulement les 12 suivants.
export async function listerEvenementsPublies(locale: "fr" | "en", deja: number, options: { cumul?: boolean } = {}): Promise<PageEvenements> {
  "use cache";
  cacheTag(ETIQUETTES.evenements);
  cacheLife("minutes");
  const maintenant = new Date().toISOString();
  const client = creerClientPublic();
  const debut = options.cumul ? 0 : deja;
  const fin = deja + TAILLE_PAGE_EVENEMENTS;

  const { count, error: erreurCompte } = await client
    .from("evenement")
    .select("id", { count: "exact", head: true })
    .not("slug", "is", null)
    .gte("debut_le", maintenant);
  if (erreurCompte || count === null) throw new Error("Lecture des événements impossible.");
  const nbAvenir = count;

  // Un Événement de plus que demandé, pour savoir s'il reste une suite (jamais de « Voir plus » devant rien).
  const lues: CarteEvenement[] = [];
  const finAvenir = Math.min(fin + 1, nbAvenir);
  if (debut < finAvenir) {
    const { data, error } = await client
      .from("evenement")
      .select(COLONNES_CARTE)
      .not("slug", "is", null)
      .gte("debut_le", maintenant)
      .order("debut_le", { ascending: true })
      .order("id", { ascending: true })
      .range(debut, finAvenir - 1);
    if (error || !data) throw new Error("Lecture des événements impossible.");
    for (const ligne of data) {
      const carte = versCarte(locale, ligne, false);
      if (carte) lues.push(carte);
    }
  }
  const debutPasse = Math.max(debut, nbAvenir);
  if (fin + 1 > debutPasse) {
    const { data, error } = await client
      .from("evenement")
      .select(COLONNES_CARTE)
      .not("slug", "is", null)
      .lt("debut_le", maintenant)
      .order("debut_le", { ascending: false })
      .order("id", { ascending: false })
      .range(debutPasse - nbAvenir, fin - nbAvenir);
    if (error || !data) throw new Error("Lecture des événements impossible.");
    for (const ligne of data) {
      const carte = versCarte(locale, ligne, true);
      if (carte) lues.push(carte);
    }
  }

  const taille = fin - debut;
  const evenements = lues.slice(0, taille);
  const suite = lues.length > taille && fin < CUMUL_MAX_EVENEMENTS ? fin : null;
  return { evenements, suite, nbAvenir };
}

// Le prochain Événement à venir, pour le bloc 5 de l'accueil ; null s'il n'y en a aucun. Une erreur est relancée : l'appelant masque le bloc.
export async function lireProchainEvenement(locale: "fr" | "en"): Promise<CarteEvenement | null> {
  "use cache";
  cacheTag(ETIQUETTES.evenements);
  cacheLife("minutes");
  const { data, error } = await creerClientPublic()
    .from("evenement")
    .select(COLONNES_CARTE)
    .not("slug", "is", null)
    .gte("debut_le", new Date().toISOString())
    .order("debut_le", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  if (error || !data) throw new Error("Lecture du prochain événement impossible.");
  const ligne = data[0];
  return ligne ? versCarte(locale, ligne, false) : null;
}

// Un Événement publié par son adresse, avec ses Types de pass dans l'ordre saisi ; null : inconnu ou non publié (404).
// Aucun compteur de places : seules les données de présentation sont lues.
export async function lireEvenementPublie(locale: "fr" | "en", slug: string): Promise<EvenementPublic | null> {
  "use cache";
  cacheTag(ETIQUETTES.evenements);
  cacheLife("minutes");
  const client = creerClientPublic();
  const { data, error } = await client
    .from("evenement")
    .select("id, slug, titre_fr, titre_en, description_fr, description_en, lieu_fr, lieu_en, debut_le, fin_le, images")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Lecture de l'événement impossible.");
  if (!data || !data.slug || !data.debut_le) return null;

  const { data: lignes, error: erreurTypes } = await client
    .from("type_pass")
    .select("id, nom_fr, nom_en, prix_cents, inclus_fr, inclus_en, est_stand, ordre")
    .eq("evenement_id", data.id)
    .order("ordre", { ascending: true })
    .order("cree_le", { ascending: true });
  if (erreurTypes || !lignes) throw new Error("Lecture des Types de pass impossible.");
  const types: TypePassPublic[] = lignes.map((t) => ({
    id: t.id,
    nom: dansLaLangue(locale, t.nom_fr, t.nom_en) ?? t.nom_fr,
    prixCents: t.prix_cents,
    inclus: dansLaLangue(locale, t.inclus_fr, t.inclus_en),
    estStand: t.est_stand,
  }));

  return {
    id: data.id,
    slug: data.slug,
    titre: dansLaLangue(locale, data.titre_fr, data.titre_en) ?? data.titre_fr,
    programme: dansLaLangue(locale, data.description_fr, data.description_en),
    lieu: dansLaLangue(locale, data.lieu_fr, data.lieu_en),
    debutLe: data.debut_le,
    finLe: data.fin_le,
    passe: new Date(data.debut_le).getTime() < Date.now(),
    images: lireImages(data.images).map((image) => ({ url: urlPhotoPublique(image.fichier), alt: altDeLaLangue(locale, image) })),
    types,
  };
}
