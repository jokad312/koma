import "server-only";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { creerClientService } from "@/lib/supabase/service";
import { lireTachesAdmin, compterMessagesNouveaux } from "@/modules/admin/queries";
import { lireMesuresARecevoir, lireTachesRemboursement } from "@/modules/commande/admin-queries";
import type { LigneEchec, LignePaiement } from "./calculs";
import { joursFenetre, minuitGoma } from "./periode";

// Lecture du tableau de bord (story 9.8, partie 2). Seules sources : les cinq fonctions d'agrégats de la partie 1, les vues de
// la story 9.7 et les compteurs de tâches déjà existants. Jamais une table de Commande, de Compte ou de client. Toutes les
// lectures passent par le client service, côté serveur ; chaque zone échoue seule (null) : jamais un zéro inventé.
export type Zone<T> = T | null;

export type CommandePayee = { numero: string; totalCents: number; prestataire: string; familles: string[] };
export type TropPercu = { motif: string; aRembourser: number; plusAncienLe: string };
export type DelaiMesures = { lignesRecues: number; lignesEnAttente: number; delaiMoyenHeures: number | null };
export type LigneVisite = { jour: string | null; action: string | null; evenements: number | null; sessions: number | null };
export type LigneEntonnoir = { jour: string | null; etape: string | null; sessions: number | null; commandes: number | null };
export type LigneOrigine = { jour: string | null; origine: string | null; commandes_payees: number | null; montant_paye_cents: number | null };
export type VenteCode = { code: string; commandesPayees: number; reductionCents: number; montantPayeCents: number };
export type DeuxiemesAchats = { clientsPayants: number; clientsDeuxAchats: number };
export type CarteTache = { cle: CleTache; nombre: number | null; href: string };
export type CleTache =
  | "mesures"
  | "annulations"
  | "remboursements"
  | "remplacements"
  | "tropPercus"
  | "stock"
  | "photos"
  | "retraits"
  | "realisations"
  | "messages"
  | "anomalies";

export type DonneesTableau = {
  commandesPayees: Zone<CommandePayee[]>;
  paiements: Zone<LignePaiement[]>;
  tropPercus: Zone<TropPercu[]>;
  echecs7: Zone<LigneEchec[]>;
  echecs30: Zone<LigneEchec[]>;
  delai7: Zone<DelaiMesures>;
  delai30: Zone<DelaiMesures>;
  visites: Zone<LigneVisite[]>;
  entonnoir: Zone<LigneEntonnoir[]>;
  origines: Zone<LigneOrigine[]>;
  ventesCodes: Zone<VenteCode[]>;
  deuxiemesAchats: Zone<DeuxiemesAchats>;
  desinscriptions: Zone<{ jour: string | null; desinscriptions: number | null }[]>;
  taches: CarteTache[];
};

// Exécute une lecture : en cas d'erreur, journal sans donnée et zone vide (null).
async function lire<T>(nom: string, fn: () => Promise<T>): Promise<Zone<T>> {
  try {
    return await fn();
  } catch {
    console.error(`[tableau-de-bord] lecture impossible : ${nom}`);
    return null;
  }
}

// Nombre attendu (PostgREST renvoie bigint et numeric en nombres JSON) ; une chaîne numérique est acceptée. Tout autre format lève :
// la zone devient illisible (lire), jamais un zéro inventé.
function entier(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  throw new Error("Valeur numérique inattendue.");
}

// PostgREST plafonne chaque réponse (1 000 lignes par défaut) : on lit page par page, avec un tri complet et stable, jusqu'à la dernière.
const TAILLE_PAGE = 1000;
async function lirePages<T>(page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const lignes: T[] = [];
  for (let de = 0; ; de += TAILLE_PAGE) {
    const { data, error } = await page(de, de + TAILLE_PAGE - 1);
    if (error) throw new Error(error.message);
    lignes.push(...(data ?? []));
    if (!data || data.length < TAILLE_PAGE) return lignes;
  }
}

// Les fonctions de la partie 1 reçoivent l'auteur construit depuis la session vérifiée et revérifient l'Admin en base.
// Les types générés les déclarent avec un Json : l'auteur est passé tel quel, comme dans les autres modules.
export async function lireTableauDeBord(args: { auteur: AuteurCompte; maintenant: Date; commandesSurSeptJours: boolean }): Promise<DonneesTableau> {
  const { auteur, maintenant } = args;
  const admin = creerClientService();
  const p_auteur = auteur as never;
  const depuis30 = minuitGoma(29, maintenant).toISOString();
  const depuis7 = minuitGoma(6, maintenant).toISOString();
  const depuisCommandes = minuitGoma(args.commandesSurSeptJours ? 6 : 0, maintenant).toISOString();
  // Premier jour de la plus grande fenêtre utile aux vues (30 jours pleins).
  const premierJour = joursFenetre(30, maintenant)[0];

  const lectureTropPercus = lire("trop-perçus", async () => {
    const { data, error } = await admin.rpc("tableau_trop_percus", { p_auteur });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({ motif: t.motif, aRembourser: entier(t.a_rembourser), plusAncienLe: t.plus_ancien_le }));
  });

  const [commandesPayees, paiements, tropPercus, echecs7, echecs30, delai7, delai30, visites, entonnoir, origines, ventesCodes, deuxiemesAchats, desinscriptions, taches] =
    await Promise.all([
      lire("commandes payées", async () => {
        const { data, error } = await admin.rpc("tableau_commandes_payees", { p_auteur, p_depuis: depuisCommandes });
        if (error) throw new Error(error.message);
        return (data ?? []).map((c) => ({ numero: c.numero, totalCents: entier(c.total_cents), prestataire: c.prestataire, familles: c.familles }));
      }),
      lire("paiements", async () => {
        const { data, error } = await admin.rpc("tableau_paiements", { p_auteur, p_depuis: depuis30 });
        if (error) throw new Error(error.message);
        return (data ?? []).map((l) => ({ jour: l.jour, prestataire: l.prestataire, famille: l.famille, commandes: entier(l.commandes), montant_cents: entier(l.montant_cents) }));
      }),
      lectureTropPercus,
      lire("échecs de paiement (7 jours)", () => lireEchecs(admin, p_auteur, depuis7)),
      lire("échecs de paiement (30 jours)", () => lireEchecs(admin, p_auteur, depuis30)),
      lire("délai des mesures (7 jours)", () => lireDelai(admin, p_auteur, depuis7)),
      lire("délai des mesures (30 jours)", () => lireDelai(admin, p_auteur, depuis30)),
      lire("visites", () =>
        lirePages((de, a) =>
          admin.from("vue_visites_jour").select("jour, action, langue, appareil, evenements, sessions").gte("jour", premierJour).order("jour").order("action").order("langue").order("appareil").range(de, a),
        ),
      ),
      lire("entonnoir", async () => {
        const { data, error } = await admin.from("vue_entonnoir_jour").select("jour, etape, sessions, commandes").gte("jour", premierJour);
        if (error) throw new Error(error.message);
        return data ?? [];
      }),
      lire("ventes par origine", () =>
        lirePages((de, a) =>
          admin.from("vue_ventes_origine").select("jour, origine, commandes_payees, montant_paye_cents").gte("jour", premierJour).order("jour").order("origine", { nullsFirst: true }).range(de, a),
        ),
      ),
      lire("ventes par Code promo", async () => {
        const { data, error } = await admin.from("vue_ventes_code_promo").select("code, commandes_payees, reduction_cents, montant_paye_cents").order("code");
        if (error) throw new Error(error.message);
        return (data ?? []).flatMap((v) =>
          v.code ? [{ code: v.code, commandesPayees: entier(v.commandes_payees), reductionCents: entier(v.reduction_cents), montantPayeCents: entier(v.montant_paye_cents) }] : [],
        );
      }),
      lire("deuxièmes achats", async () => {
        const { data, error } = await admin.from("vue_deuxiemes_achats").select("clients_payants, clients_deux_achats").maybeSingle();
        if (error || !data) throw new Error(error?.message ?? "vide");
        return { clientsPayants: entier(data.clients_payants), clientsDeuxAchats: entier(data.clients_deux_achats) };
      }),
      lire("désinscriptions", async () => {
        const { data, error } = await admin.from("vue_desinscriptions_jour").select("jour, desinscriptions").gte("jour", premierJour);
        if (error) throw new Error(error.message);
        return data ?? [];
      }),
      lireCartesTaches(admin, lectureTropPercus),
    ]);

  return { commandesPayees, paiements, tropPercus, echecs7, echecs30, delai7, delai30, visites, entonnoir, origines, ventesCodes, deuxiemesAchats, desinscriptions, taches };
}

type ClientService = ReturnType<typeof creerClientService>;

async function lireEchecs(admin: ClientService, p_auteur: never, p_depuis: string): Promise<LigneEchec[]> {
  const { data, error } = await admin.rpc("tableau_echecs_paiement", { p_auteur, p_depuis });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    prestataire: e.prestataire,
    moyen: e.moyen,
    tentatives: entier(e.tentatives),
    reussies: entier(e.reussies),
    echouees_client: entier(e.echouees_client),
    echouees_prestataire: entier(e.echouees_prestataire),
    abandonnees: entier(e.abandonnees),
    en_cours: entier(e.en_cours),
  }));
}

async function lireDelai(admin: ClientService, p_auteur: never, p_depuis: string): Promise<DelaiMesures> {
  const { data, error } = await admin.rpc("tableau_delai_mesures", { p_auteur, p_depuis });
  const ligne = data?.[0];
  if (error || !ligne) throw new Error(error?.message ?? "vide");
  return { lignesRecues: entier(ligne.lignes_recues), lignesEnAttente: entier(ligne.lignes_en_attente), delaiMoyenHeures: ligne.delai_moyen_heures === null ? null : Number(ligne.delai_moyen_heures) };
}

// Cartes de tâche : un compteur par carte, lu par les requêtes existantes (stories 6.5, 6.6, 8.2, 1.8) et par tableau_trop_percus.
// Un compteur illisible vaut null (la carte l'indique) : jamais un faux zéro.
async function lireCartesTaches(admin: ClientService, lectureTropPercus: Promise<Zone<TropPercu[]>>): Promise<CarteTache[]> {
  const [mesures, argent, trop, photos, messages, anomalies] = await Promise.all([
    lire("tâche mesures", async () => (await lireMesuresARecevoir()).total),
    lire("tâches d'argent", () => lireTachesRemboursement()),
    lectureTropPercus.then((z) => (z ? z.reduce((somme, t) => somme + t.aRembourser, 0) : null)),
    lire("tâche photos", async () => {
      const { data, error } = await admin.rpc("compter_photos_a_traiter");
      if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error(error?.message ?? "forme inattendue");
      const d = data as Record<string, unknown>;
      if (!Number.isInteger(d.a_valider) || !Number.isInteger(d.realisations) || !Number.isInteger(d.retraits)) throw new Error("forme inattendue");
      return { aValider: d.a_valider as number, realisations: d.realisations as number, retraits: d.retraits as number };
    }),
    compterMessagesNouveaux(),
    lire("anomalies", async () => (await lireTachesAdmin()).length),
  ]);
  const compte = (type: string) => (argent ? argent.filter((t) => t.type === type).length : null);
  return [
    { cle: "mesures", nombre: mesures, href: "/admin/taches" },
    { cle: "annulations", nombre: compte("demande"), href: "/admin/taches" },
    { cle: "remboursements", nombre: compte("remboursement"), href: "/admin/taches" },
    { cle: "remplacements", nombre: compte("reclamation"), href: "/admin/taches" },
    { cle: "tropPercus", nombre: trop, href: "/admin/taches" },
    { cle: "stock", nombre: compte("stock"), href: "/admin/taches" },
    { cle: "photos", nombre: photos ? photos.aValider : null, href: "/admin/galerie" },
    { cle: "retraits", nombre: photos ? photos.retraits : null, href: "/admin/galerie" },
    { cle: "realisations", nombre: photos ? photos.realisations : null, href: "/admin/galerie" },
    { cle: "messages", nombre: messages, href: "/admin/messages" },
    { cle: "anomalies", nombre: anomalies, href: "/admin/taches" },
  ];
}
