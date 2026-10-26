import "server-only";
import { cacheTag } from "next/cache";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientService } from "@/lib/supabase/service";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { encoderCurseur } from "./adresse";
import { contientMarqueur } from "@/lib/vitrine/marqueur";
import { choisirSlugLibre, SLUG_REGEX } from "./slug";
import { CUMUL_MAX_CATALOGUE, DISPONIBILITES, TAILLE_PAGE_CATALOGUE, TAILLES } from "./types";
import type { CarteProduit, Disponibilite, FamillePhysique, FicheProduit, ProduitPublie, TailleFiche, PageCatalogue, ParamsCatalogue, PhotoAdmin, ProduitAdmin, ProduitListe, ProduitPourPublication, Taille, TranchePrix, UniversAdmin, UniversChoix } from "./types";

// Lectures admin par le client service (après le droit vérifié par la page) : une erreur de lecture est relancée,
// jamais une liste vide inventée. Aucune valeur de repli (règle 15).
export async function lireUniversAdmin(): Promise<UniversAdmin[]> {
  const { data, error } = await creerClientService().from("univers").select("id, nom_fr, nom_en").order("nom_fr", { ascending: true });
  if (error) throw new Error("Lecture des univers impossible.");
  return (data ?? []).map((u) => ({ id: u.id, nomFr: u.nom_fr, nomEn: u.nom_en }));
}

export async function lireProduitsAdmin(): Promise<ProduitListe[]> {
  const { data, error } = await creerClientService()
    .from("produit")
    .select("id, famille, titre_fr, slug, prix_cents, publie_le")
    .order("cree_le", { ascending: false });
  if (error) throw new Error("Lecture des produits impossible.");
  return (data ?? []).map((p) => ({
    id: p.id,
    famille: p.famille as FamillePhysique,
    titreFr: p.titre_fr,
    slug: p.slug,
    prixCents: p.prix_cents,
    publieLe: p.publie_le,
  }));
}

// Un produit et ses variantes pour la fiche d'édition ; null si l'identifiant est inconnu (404).
export async function lireProduitAdmin(id: string): Promise<ProduitAdmin | null> {
  const client = creerClientService();
  const { data, error } = await client
    .from("produit")
    .select(
      "id, famille, slug, titre_fr, titre_en, description_fr, description_en, univers_id, prix_cents, delai_fabrication_jours, publie_le",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lecture du produit impossible.");
  if (!data) return null;
  const variantes = await client
    .from("variante")
    .select("taille, stock, fabrication_sur_commande, delai_fabrication_jours")
    .eq("produit_id", id);
  if (variantes.error) throw new Error("Lecture des variantes impossible.");
  const photos = await client.from("produit_photo").select("id, fichier, alt_fr, alt_en, position").eq("produit_id", id).order("position", { ascending: true });
  if (photos.error) throw new Error("Lecture des photos impossible.");
  return {
    id: data.id,
    famille: data.famille as FamillePhysique,
    slug: data.slug,
    titreFr: data.titre_fr,
    titreEn: data.titre_en,
    descriptionFr: data.description_fr,
    descriptionEn: data.description_en,
    universId: data.univers_id,
    prixCents: data.prix_cents,
    delaiFabricationJours: data.delai_fabrication_jours,
    publieLe: data.publie_le,
    variantes: (variantes.data ?? []).map((v) => ({
      taille: v.taille as Taille,
      stock: v.stock,
      fabricationSurCommande: v.fabrication_sur_commande,
      delaiFabricationJours: v.delai_fabrication_jours,
    })),
    photos: (photos.data ?? []).map(
      (ph): PhotoAdmin => ({ id: ph.id, fichier: ph.fichier, altFr: ph.alt_fr, altEn: ph.alt_en, position: ph.position }),
    ),
  };
}

// Ce que la complétude d'un produit lit en base (comptes de photos et de variantes) ; null si le produit est inconnu.
export async function lireProduitPourPublication(id: string): Promise<ProduitPourPublication | null> {
  const client = creerClientService();
  const { data, error } = await client
    .from("produit")
    .select("prix_cents, titre_en, description_fr, description_en, publie_le")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lecture du produit impossible.");
  if (!data) return null;
  const [photos, variantes] = await Promise.all([
    client.from("produit_photo").select("id", { count: "exact", head: true }).eq("produit_id", id),
    client.from("variante").select("id", { count: "exact", head: true }).eq("produit_id", id),
  ]);
  if (photos.error || variantes.error || photos.count === null || variantes.count === null) throw new Error("Lecture du produit impossible.");
  return {
    prixCents: data.prix_cents,
    titreEn: data.titre_en,
    descriptionFr: data.description_fr,
    descriptionEn: data.description_en,
    nbPhotos: photos.count,
    nbVariantes: variantes.count,
    publieLe: data.publie_le,
  };
}

// Première adresse libre à partir d'une base valide (en excluant le produit lui-même quand il est modifié).
export async function premierSlugLibre(base: string, exclureId: string | null): Promise<string> {
  // La base ne contient que [a-z0-9-] : sans danger dans le motif « commence par ».
  if (!SLUG_REGEX.test(base)) throw new Error("Adresse de départ invalide.");
  let requete = creerClientService().from("produit").select("slug").like("slug", `${base}%`);
  if (exclureId) requete = requete.neq("id", exclureId);
  const { data, error } = await requete;
  if (error) throw new Error("Lecture des adresses impossible.");
  return choisirSlugLibre(base, new Set((data ?? []).map((p) => p.slug)));
}

// Univers proposés à la question d'accueil, dans la langue de la route : lecture publique (RLS), sans session.
// Une erreur est relancée : l'appelant décide (la question est facultative, l'étape continue sans elle).
// Liste des univers dans la langue demandée, en cache `catalogue` (vidée à la création d'un univers).
export async function lireUniversPublics(locale: "fr" | "en"): Promise<UniversChoix[]> {
  "use cache";
  cacheTag(ETIQUETTES.catalogue);
  const colonne = locale === "fr" ? "nom_fr" : "nom_en";
  const { data, error } = await creerClientPublic().from("univers").select(`id, ${colonne}`).order(colonne, { ascending: true });
  if (error) throw new Error("Lecture des univers impossible.");
  return ((data ?? []) as unknown as Array<Record<string, string>>).map((u) => ({ id: u.id, nom: u[colonne] }));
}

type LigneTranche = { ordre: number; libelle_fr: string; libelle_en: string; bas_cents: number; haut_cents: number | null };

function versTranches(lignes: readonly LigneTranche[] | null): TranchePrix[] {
  return (lignes ?? []).map((t) => ({ ordre: t.ordre, libelleFr: t.libelle_fr, libelleEn: t.libelle_en, basCents: t.bas_cents, hautCents: t.haut_cents }));
}

// Tranches de prix du filtre des catalogues (lecture publique en cache `reglages`, invalidé à l'enregistrement).
// Aucune tranche réglée : liste vide, donc aucun filtre de prix, jamais une tranche inventée. Une erreur de lecture est relancée.
export async function lireTranchesPrix(): Promise<TranchePrix[]> {
  "use cache";
  cacheTag(ETIQUETTES.reglages);
  const { data, error } = await creerClientPublic()
    .from("tranche_prix")
    .select("ordre, libelle_fr, libelle_en, bas_cents, haut_cents")
    .order("ordre", { ascending: true });
  if (error) throw new Error("Lecture des tranches de prix impossible.");
  return versTranches(data);
}

// Même lecture pour l'admin, sans cache, par le client service (après le droit vérifié par la page).
export async function lireTranchesPrixAdmin(): Promise<TranchePrix[]> {
  const { data, error } = await creerClientService()
    .from("tranche_prix")
    .select("ordre, libelle_fr, libelle_en, bas_cents, haut_cents")
    .order("ordre", { ascending: true });
  if (error) throw new Error("Lecture des tranches de prix impossible.");
  return versTranches(data);
}

const DISPONIBILITES_CONNUES: readonly string[] = DISPONIBILITES;

// Une page d'un catalogue public, par la fonction SQL lister_catalogue (client public : la RLS ne montre que les produits publiés).
// Rendue à chaque requête, jamais en cache (le badge dépend du stock et de la capacité : AD-17). La base ne renvoie qu'un état, jamais une quantité. Une erreur de lecture est relancée :
// jamais une liste vide inventée. La base lit une ligne de plus que la page : elle ne sert qu'à savoir s'il en reste, elle n'est pas rendue.
// Deux lectures d'un curseur (qui porte la clé de tri du dernier produit vu et le nombre n de produits déjà affichés) :
//  - cumul: true (page à curseur) : relit depuis le début les n produits déjà vus plus les 12 suivants (limite, jamais de décalage) ;
//  - sinon (Server Action « Voir plus ») : seulement les 12 suivants, par la clé de tri.
// Le curseur rendu porte dans les deux cas le nombre total de produits affichés après cette lecture.
export async function listerCatalogue(
  famille: FamillePhysique,
  params: ParamsCatalogue,
  locale: "fr" | "en",
  options: { cumul?: boolean } = {},
): Promise<PageCatalogue> {
  const cumul = Boolean(options.cumul && params.curseur);
  const dejaVus = params.curseur?.n ?? 0;
  const taille = TAILLE_PAGE_CATALOGUE + (cumul ? dejaVus : 0);
  const { data, error } = await creerClientPublic().rpc("lister_catalogue", {
    p_famille: famille,
    p_langue: locale,
    p_univers: params.univers ?? undefined,
    p_prix_bas: params.prixBas ?? undefined,
    p_prix_haut: params.prixHaut ?? undefined,
    p_dispo: params.dispo ?? undefined,
    p_tri: params.tri,
    p_curseur_date: cumul ? undefined : (params.curseur?.date ?? undefined),
    p_curseur_prix: cumul ? undefined : (params.curseur?.prix ?? undefined),
    p_curseur_id: cumul ? undefined : (params.curseur?.id ?? undefined),
    p_limite: taille + 1,
  });
  if (error || !Array.isArray(data)) throw new Error("Lecture du catalogue impossible.");

  const lignes = data.slice(0, taille);
  const produits: CarteProduit[] = lignes.map((l) => {
    if (!DISPONIBILITES_CONNUES.includes(l.disponibilite)) throw new Error("Lecture du catalogue impossible.");
    return {
      id: l.id,
      slug: l.slug,
      famille: l.famille as FamillePhysique,
      titre: l.titre,
      photoAlt: l.photo_alt,
      photoUrl: urlPhotoPublique(l.photo_fichier),
      prixCents: l.prix_cents,
      disponibilite: l.disponibilite as Disponibilite,
    };
  });
  const dernier = lignes[lignes.length - 1];
  // Plafond du cumul : au-delà, plus de « Voir plus » (la liste ne grossit plus par curseur).
  const affiches = (cumul ? 0 : dejaVus) + lignes.length;
  const suite =
    data.length > taille && dernier && affiches <= CUMUL_MAX_CATALOGUE
      ? encoderCurseur(params.tri, { date: dernier.curseur_date, prix: dernier.prix_cents, id: dernier.id, n: affiches })
      : null;
  return { produits, suite };
}

const TAILLES_CONNUES: readonly string[] = TAILLES;

// Description anglaise vide ou portant le marqueur « [Texte à fournir] » : repli sur le français.
function descriptionDeLaLangue(en: boolean, descriptionEn: string | null, descriptionFr: string | null): string | null {
  const anglais = descriptionEn?.trim();
  if (en && anglais && !contientMarqueur(anglais)) return anglais;
  return descriptionFr?.trim() || null;
}

// Fiche d'un produit publié, par le client public (la RLS ne montre que les produits publiés) : photos dans l'ordre et disponibilité
// de chaque taille par la fonction SQL disponibilite_variantes (jamais de quantité). Rendue à chaque requête, jamais en cache (prix et
// disponibilité : AD-17, règle 3). null : produit inconnu, brouillon, dépublié, d'une autre famille que celle demandée, ou sans photo.
// Une erreur de lecture est relancée : jamais une fiche inventée.
export async function lireFicheProduit(famille: FamillePhysique, slug: string, langue: "fr" | "en"): Promise<FicheProduit | null> {
  const client = creerClientPublic();
  const produit = await client
    .from("produit")
    .select("id, slug, famille, titre_fr, titre_en, description_fr, description_en, prix_cents")
    .eq("slug", slug)
    .eq("famille", famille)
    .maybeSingle();
  if (produit.error) throw new Error("Lecture de la fiche impossible.");
  const p = produit.data;
  if (!p || p.prix_cents === null) return null;

  const [photos, dispo] = await Promise.all([
    client.from("produit_photo").select("fichier, alt_fr, alt_en, position").eq("produit_id", p.id).order("position", { ascending: true }),
    client.rpc("disponibilite_variantes", { p_produit: p.id }),
  ]);
  if (photos.error || !photos.data || dispo.error || !Array.isArray(dispo.data)) throw new Error("Lecture de la fiche impossible.");
  if (photos.data.length === 0) return null;

  const tailles: TailleFiche[] = dispo.data.map((d) => {
    if (!TAILLES_CONNUES.includes(d.taille) || !DISPONIBILITES_CONNUES.includes(d.etat)) throw new Error("Lecture de la fiche impossible.");
    return { taille: d.taille as Taille, etat: d.etat as Disponibilite, delaiJours: d.delai_jours };
  });
  const en = langue === "en";
  return {
    id: p.id,
    slug: p.slug,
    famille: p.famille as FamillePhysique,
    titre: (en ? p.titre_en?.trim() : "") || p.titre_fr,
    description: descriptionDeLaLangue(en, p.description_en, p.description_fr),
    prixCents: p.prix_cents,
    photos: photos.data.map((ph) => ({
      url: urlPhotoPublique(ph.fichier),
      alt: en ? ph.alt_en.trim() || ph.alt_fr : ph.alt_fr,
    })),
    tailles,
  };
}

// Adresses des produits publiés qui ont une photo et un prix (les autres donnent une 404), pour le plan du site : lues par pages de 1000 jusqu'à
// épuisement, en cache `catalogue` (vidé à la publication). Une erreur de lecture est relancée.
export async function lireSlugsPublies(): Promise<ProduitPublie[]> {
  "use cache";
  cacheTag(ETIQUETTES.catalogue);
  const TAILLE = 1000;
  const produits: ProduitPublie[] = [];
  for (let debut = 0; ; debut += TAILLE) {
    const { data, error } = await creerClientPublic()
      .from("produit")
      .select("famille, slug, produit_photo!inner(id)")
      .not("prix_cents", "is", null)
      .order("publie_le", { ascending: false })
      .order("id", { ascending: true })
      .range(debut, debut + TAILLE - 1);
    if (error || !data) throw new Error("Lecture des produits publiés impossible.");
    produits.push(...data.map((p) => ({ famille: p.famille as FamillePhysique, slug: p.slug })));
    if (data.length < TAILLE) return produits;
  }
}
