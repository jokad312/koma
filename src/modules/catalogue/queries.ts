import "server-only";
import { cacheTag } from "next/cache";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientService } from "@/lib/supabase/service";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { encoderCurseur, pourFamille } from "./adresse";
import { contientMarqueur } from "@/lib/vitrine/marqueur";
import { choisirSlugLibre, SLUG_REGEX } from "./slug";
import { CUMUL_MAX_CATALOGUE, DISPONIBILITES, LANGUES_SOUS_TITRES, NIVEAUX_KIT, TAILLE_PAGE_CATALOGUE, TAILLES } from "./types";
import { FORMATS_FICHIER_KIT, type FormatFichierKit } from "./fichiers-kit";
import type { FicheKit, CarteProduit, ChapitreAdmin, Disponibilite, LangueSousTitres, SousTitreAdmin, FamillePhysique, FamilleProduit, FichierKitAdmin, FicheProduit, KitLieFiche, NiveauKit, ProduitLiable, ProduitPublie, TailleFiche, PageCatalogue, ParamsCatalogue, PhotoAdmin, ProduitAdmin, ProduitListe, ProduitPourPublication, Taille, TranchePrix, UniversAdmin, UniversChoix } from "./types";

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
    famille: p.famille as FamilleProduit,
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
      "id, famille, slug, titre_fr, titre_en, description_fr, description_en, univers_id, prix_cents, delai_fabrication_jours, publie_le, materiel_fr, materiel_en, niveau, produit_lie_id",
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
  // Fichiers d'un Kit : jamais le chemin de stockage (table fichier_kit_prive).
  const fichiers = await client.from("fichier_kit").select("id, nom_fr, nom_en, format, taille_octets, ordre, version").eq("produit_id", id).order("ordre", { ascending: true });
  if (fichiers.error) throw new Error("Lecture des fichiers impossible.");
  // Vidéo, chapitres et sous-titres d'un Kit : jamais l'identifiant Bunny privé (video_kit_prive) ni un chemin (sous_titre_kit_prive).
  const [video, chapitres, sousTitres] = await Promise.all([
    client.from("video_kit").select("duree_secondes, extrait_bunny_id, extrait_sans_parole, extrait_sous_titres").eq("produit_id", id).maybeSingle(),
    client.from("chapitre_kit").select("id, titre_fr, titre_en, debut_secondes, ordre").eq("produit_id", id).order("ordre", { ascending: true }),
    client.from("sous_titre_kit").select("langue, taille_octets, version").eq("produit_id", id).order("langue", { ascending: false }),
  ]);
  if (video.error || chapitres.error || sousTitres.error) throw new Error("Lecture des médias du Kit impossible.");
  return {
    id: data.id,
    famille: data.famille as FamilleProduit,
    slug: data.slug,
    titreFr: data.titre_fr,
    titreEn: data.titre_en,
    descriptionFr: data.description_fr,
    descriptionEn: data.description_en,
    universId: data.univers_id,
    prixCents: data.prix_cents,
    delaiFabricationJours: data.delai_fabrication_jours,
    publieLe: data.publie_le,
    materielFr: data.materiel_fr,
    materielEn: data.materiel_en,
    niveau: data.niveau as NiveauKit | null,
    produitLieId: data.produit_lie_id,
    video: video.data
      ? {
          dureeSecondes: video.data.duree_secondes,
          extrait: video.data.extrait_bunny_id !== null,
          extraitSansParole: video.data.extrait_sans_parole,
          extraitSousTitres: languesSousTitres(video.data.extrait_sous_titres),
        }
      : null,
    chapitres: (chapitres.data ?? []).map(
      (c): ChapitreAdmin => ({ id: c.id, titreFr: c.titre_fr, titreEn: c.titre_en, debutSecondes: c.debut_secondes, ordre: c.ordre }),
    ),
    sousTitres: (sousTitres.data ?? []).map(
      (st): SousTitreAdmin => ({ langue: st.langue as LangueSousTitres, tailleOctets: st.taille_octets, version: st.version }),
    ),
    fichiers: (fichiers.data ?? []).map(
      (f): FichierKitAdmin => ({ id: f.id, nomFr: f.nom_fr, nomEn: f.nom_en, format: f.format as FormatFichierKit, tailleOctets: Number(f.taille_octets), ordre: f.ordre, version: f.version }),
    ),
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

// Cosplays et accessoires qu'un Kit peut lier : ceux qui n'ont pas de Kit, plus celui du Kit édité (kitId). Une erreur est relancée.
export async function lireProduitsLiables(kitId: string | null): Promise<ProduitLiable[]> {
  const client = creerClientService();
  const [cibles, kits] = await Promise.all([
    client.from("produit").select("id, titre_fr, famille").in("famille", ["cosplay", "accessoire"]).order("titre_fr", { ascending: true }),
    client.from("produit").select("id, produit_lie_id").eq("famille", "kit").not("produit_lie_id", "is", null),
  ]);
  if (cibles.error || kits.error) throw new Error("Lecture des produits à lier impossible.");
  const pris = new Set((kits.data ?? []).filter((k) => k.id !== kitId).map((k) => k.produit_lie_id));
  return (cibles.data ?? []).filter((c) => !pris.has(c.id)).map((c) => ({ id: c.id, titreFr: c.titre_fr, famille: c.famille as FamillePhysique }));
}

// Famille d'un produit (null si inconnu) ; une erreur de lecture est relancée.
export async function lireFamilleProduit(id: string): Promise<FamilleProduit | null> {
  const { data, error } = await creerClientService().from("produit").select("famille").eq("id", id).maybeSingle();
  if (error) throw new Error("Lecture du produit impossible.");
  return data ? (data.famille as FamilleProduit) : null;
}

// Produit et format d'un fichier de Kit (null si inconnu) ; une erreur de lecture est relancée.
export async function lireFichierKit(id: string): Promise<{ produitId: string; format: FormatFichierKit } | null> {
  const { data, error } = await creerClientService().from("fichier_kit").select("produit_id, format").eq("id", id).maybeSingle();
  if (error) throw new Error("Lecture du fichier impossible.");
  return data ? { produitId: data.produit_id, format: data.format as FormatFichierKit } : null;
}

// Ce que la complétude d'un produit lit en base (comptes de photos et de variantes ; pour un Kit, matériel, niveau, fichiers, vidéo et
// sous-titres français) ; null si le produit est inconnu. Une erreur de lecture est relancée.
export async function lireProduitPourPublication(id: string): Promise<ProduitPourPublication | null> {
  const client = creerClientService();
  const { data, error } = await client
    .from("produit")
    .select("famille, prix_cents, titre_fr, titre_en, description_fr, description_en, publie_le, materiel_fr, materiel_en, niveau")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lecture du produit impossible.");
  if (!data) return null;
  const [photos, variantes] = await Promise.all([
    client.from("produit_photo").select("id", { count: "exact", head: true }).eq("produit_id", id),
    client.from("variante").select("id", { count: "exact", head: true }).eq("produit_id", id),
  ]);
  if (photos.error || variantes.error || photos.count === null || variantes.count === null) throw new Error("Lecture du produit impossible.");
  const famille = data.famille as FamilleProduit;
  let nbFichiers = 0;
  let videoPrete = false;
  let sousTitresFr = false;
  let extraitSansSousTitresFr = false;
  if (famille === "kit") {
    const [fichiers, video, sousTitres] = await Promise.all([
      client.from("fichier_kit").select("id", { count: "exact", head: true }).eq("produit_id", id),
      client.from("video_kit").select("extrait_bunny_id, extrait_sans_parole, extrait_sous_titres").eq("produit_id", id).maybeSingle(),
      client.from("sous_titre_kit").select("id", { count: "exact", head: true }).eq("produit_id", id).eq("langue", "fr"),
    ]);
    if (fichiers.error || video.error || sousTitres.error || fichiers.count === null || sousTitres.count === null) {
      throw new Error("Lecture du produit impossible.");
    }
    nbFichiers = fichiers.count;
    videoPrete = video.data !== null;
    sousTitresFr = sousTitres.count > 0;
    extraitSansSousTitresFr =
      video.data !== null && Boolean(video.data.extrait_bunny_id) && !video.data.extrait_sans_parole && !(video.data.extrait_sous_titres ?? []).includes("fr");
  }
  return {
    famille,
    prixCents: data.prix_cents,
    titreFr: data.titre_fr,
    titreEn: data.titre_en,
    descriptionFr: data.description_fr,
    descriptionEn: data.description_en,
    nbPhotos: photos.count,
    nbVariantes: variantes.count,
    publieLe: data.publie_le,
    materielFr: data.materiel_fr,
    materielEn: data.materiel_en,
    niveau: data.niveau as NiveauKit | null,
    nbFichiers,
    videoPrete,
    sousTitresFr,
    extraitSansSousTitresFr,
  };
}

// Langues de sous-titres connues, dans l'ordre fr puis en ; une valeur inconnue est ignorée.
function languesSousTitres(brut: readonly string[] | null): LangueSousTitres[] {
  const lues = new Set(brut ?? []);
  return LANGUES_SOUS_TITRES.filter((l) => lues.has(l));
}

// Vidéo enregistrée d'un Kit, pour le service seulement (client service) : identifiant privé compris, jamais rendu au navigateur.
// null si aucune vidéo ; une erreur de lecture est relancée.
export async function lireVideoKitService(produitId: string): Promise<{ bunnyIdPrive: string; extraitId: string | null; dureeSecondes: number } | null> {
  const client = creerClientService();
  const { data, error } = await client.from("video_kit").select("duree_secondes, extrait_bunny_id").eq("produit_id", produitId).maybeSingle();
  if (error) throw new Error("Lecture de la vidéo impossible.");
  if (!data) return null;
  const prive = await client.from("video_kit_prive").select("bunny_video_id_prive").eq("produit_id", produitId).maybeSingle();
  if (prive.error || !prive.data) throw new Error("Lecture de la vidéo impossible.");
  return { bunnyIdPrive: prive.data.bunny_video_id_prive, extraitId: data.extrait_bunny_id, dureeSecondes: data.duree_secondes };
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
const NIVEAUX_CONNUS: readonly (string | null)[] = NIVEAUX_KIT;

// Une page d'un catalogue public, par la fonction SQL lister_catalogue (client public : la RLS ne montre que les produits publiés).
// Rendue à chaque requête, jamais en cache (le badge dépend du stock et de la capacité : AD-17). La base ne renvoie qu'un état, jamais une quantité. Une erreur de lecture est relancée :
// jamais une liste vide inventée. La base lit une ligne de plus que la page : elle ne sert qu'à savoir s'il en reste, elle n'est pas rendue.
// Deux lectures d'un curseur (qui porte la clé de tri du dernier produit vu et le nombre n de produits déjà affichés) :
//  - cumul: true (page à curseur) : relit depuis le début les n produits déjà vus plus les 12 suivants (limite, jamais de décalage) ;
//  - sinon (Server Action « Voir plus ») : seulement les 12 suivants, par la clé de tri.
// Le curseur rendu porte dans les deux cas le nombre total de produits affichés après cette lecture.
export async function listerCatalogue(
  famille: FamilleProduit,
  paramsBruts: ParamsCatalogue,
  locale: "fr" | "en",
  options: { cumul?: boolean } = {},
): Promise<PageCatalogue> {
  // Niveau pour les Kits seulement, disponibilité pour les produits physiques seulement.
  const params = pourFamille(paramsBruts, famille);
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
    p_niveau: params.niveau ?? undefined,
  });
  if (error || !Array.isArray(data)) throw new Error("Lecture du catalogue impossible.");

  const lignes = data.slice(0, taille);
  const produits: CarteProduit[] = lignes.map((l) => {
    if (!DISPONIBILITES_CONNUES.includes(l.disponibilite)) throw new Error("Lecture du catalogue impossible.");
    return {
      id: l.id,
      slug: l.slug,
      famille: l.famille as FamilleProduit,
      titre: l.titre,
      photoAlt: l.photo_alt,
      photoUrl: urlPhotoPublique(l.photo_fichier),
      prixCents: l.prix_cents,
      disponibilite: l.disponibilite as Disponibilite,
      niveau: NIVEAUX_CONNUS.includes(l.niveau) ? (l.niveau as NiveauKit) : null,
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

  // Kit lié publié (double option, story 3.4) : le lien est porté par le Kit (produit_lie_id = id du produit physique, unique). Un seul
  // possible ; le visiteur n'est proposé qu'à fabriquer un Kit publié et visible publiquement. Le prix est celui du Kit, lu en base,
  // jamais calculé côté client. null : pas de Kit lié, ou Kit non publié. Une erreur de lecture est relancée.
  let kitLie: KitLieFiche | null = null;
  const kit = await client
    .from("produit")
    .select("slug, titre_fr, titre_en, prix_cents, niveau, publie_le")
    .eq("famille", "kit")
    .eq("produit_lie_id", p.id)
    .maybeSingle();
  if (kit.error) throw new Error("Lecture de la fiche impossible.");
  const k = kit.data;
  if (k && k.publie_le && k.prix_cents !== null) {
    kitLie = {
      slug: k.slug,
      titre: (langue === "en" ? k.titre_en?.trim() : "") || k.titre_fr,
      prixCents: k.prix_cents,
      niveau: NIVEAUX_CONNUS.includes(k.niveau) ? (k.niveau as NiveauKit) : null,
    };
  }

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
    kitLie,
  };
}

// Adresses des cosplays, accessoires et Kits publiés qui ont une photo et un prix (les autres donnent une 404), pour le plan du site :
// lues par pages de 1000 jusqu'à épuisement, en cache `catalogue` (vidé à la publication). Une erreur de lecture est relancée.
export async function lireSlugsPublies(): Promise<ProduitPublie[]> {
  "use cache";
  cacheTag(ETIQUETTES.catalogue);
  const TAILLE = 1000;
  const produits: ProduitPublie[] = [];
  for (let debut = 0; ; debut += TAILLE) {
    const { data, error } = await creerClientPublic()
      .from("produit")
      .select("famille, slug, produit_photo!inner(id)")
      .in("famille", ["cosplay", "accessoire", "kit"])
      .not("prix_cents", "is", null)
      .order("publie_le", { ascending: false })
      .order("id", { ascending: true })
      .range(debut, debut + TAILLE - 1);
    if (error || !data) throw new Error("Lecture des produits publiés impossible.");
    produits.push(...data.map((p) => ({ famille: p.famille as FamilleProduit, slug: p.slug })));
    if (data.length < TAILLE) return produits;
  }
}

// Fiche d'un Kit publié, par le client public (la RLS ne montre que les Kits publiés et leurs données publiables) : photos, fichiers (nom
// dans la langue, format, taille), chapitres, langues des sous-titres et extrait public. Jamais une table _prive, jamais un chemin de
// kits-private ni un identifiant de la bibliothèque Bunny privée. Rendue à chaque requête (prix lu en base : règle 3). null : Kit inconnu,
// brouillon, dépublié, sans prix ou sans photo. Une erreur de lecture est relancée : jamais une fiche inventée.
export async function lireFicheKit(slug: string, langue: "fr" | "en"): Promise<FicheKit | null> {
  const client = creerClientPublic();
  const produit = await client
    .from("produit")
    .select("id, slug, titre_fr, titre_en, description_fr, description_en, materiel_fr, materiel_en, prix_cents, niveau")
    .eq("slug", slug)
    .eq("famille", "kit")
    .maybeSingle();
  if (produit.error) throw new Error("Lecture de la fiche impossible.");
  const p = produit.data;
  if (!p || p.prix_cents === null) return null;

  const [photos, fichiers, chapitres, sousTitres, video] = await Promise.all([
    client.from("produit_photo").select("fichier, alt_fr, alt_en, position").eq("produit_id", p.id).order("position", { ascending: true }),
    client.from("fichier_kit").select("nom_fr, nom_en, format, taille_octets, ordre").eq("produit_id", p.id).order("ordre", { ascending: true }),
    client.from("chapitre_kit").select("titre_fr, titre_en, debut_secondes, ordre").eq("produit_id", p.id).order("ordre", { ascending: true }),
    client.from("sous_titre_kit").select("langue").eq("produit_id", p.id),
    client
      .from("video_kit")
      .select("duree_secondes, extrait_bunny_id, extrait_sans_parole, extrait_sous_titres, extrait_le")
      .eq("produit_id", p.id)
      .maybeSingle(),
  ]);
  if (photos.error || !photos.data || fichiers.error || chapitres.error || sousTitres.error || video.error) throw new Error("Lecture de la fiche impossible.");
  if (photos.data.length === 0) return null;

  const en = langue === "en";
  const formats: readonly string[] = FORMATS_FICHIER_KIT;
  const v = video.data;
  return {
    id: p.id,
    slug: p.slug,
    titre: (en ? p.titre_en?.trim() : "") || p.titre_fr,
    description: descriptionDeLaLangue(en, p.description_en, p.description_fr),
    materiel: descriptionDeLaLangue(en, p.materiel_en, p.materiel_fr),
    prixCents: p.prix_cents,
    niveau: NIVEAUX_CONNUS.includes(p.niveau) ? (p.niveau as NiveauKit) : null,
    photos: photos.data.map((ph) => ({ url: urlPhotoPublique(ph.fichier), alt: en ? ph.alt_en.trim() || ph.alt_fr : ph.alt_fr })),
    fichiers: (fichiers.data ?? []).map((f) => {
      if (!formats.includes(f.format)) throw new Error("Lecture de la fiche impossible.");
      return { nom: (en ? f.nom_en.trim() : "") || f.nom_fr, format: f.format as FormatFichierKit, tailleOctets: Number(f.taille_octets) };
    }),
    chapitres: (chapitres.data ?? []).map((c) => ({ ordre: c.ordre, titre: (en ? c.titre_en.trim() : "") || c.titre_fr, debutSecondes: c.debut_secondes })),
    sousTitres: languesSousTitres((sousTitres.data ?? []).map((st) => st.langue)),
    dureeSecondes: v ? v.duree_secondes : null,
    // Un extrait parlé sans sous-titres français n'est pas montré au public (amendement de la revue 1) : ni lecteur ni VideoObject.
    extrait:
      v && v.extrait_bunny_id && (v.extrait_sans_parole || (v.extrait_sous_titres ?? []).includes("fr"))
        ? { id: v.extrait_bunny_id, sousTitres: languesSousTitres(v.extrait_sous_titres), sansParole: v.extrait_sans_parole, enregistreLe: v.extrait_le }
        : null,
  };
}
