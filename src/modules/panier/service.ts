import { AUTEUR_VISITEUR, construireAuteur, type Auteur } from "@/lib/auth/auteur";
import { lirePanierSigne, signerPanier } from "@/lib/panier/cookie";
import { ajoutSchema, modificationSchema, retraitSchema } from "./schemas";
import type { EntreeAjout } from "./schemas";
import type { CodeErreurPanier, DependancesPanier, EtatLigne, LigneBrute, LignePanier, PanierLu, ResultatPanier } from "./types";

// Seul le code de l'erreur est journalisé : ni identifiant de Panier ni de Compte.
function journaliser(contexte: string) {
  console.error(`[panier] ${contexte}`);
}

const CODES_BASE: [string, CodeErreurPanier][] = [
  ["KS_PRODUIT_GRATUIT", "gratuit"],
  ["KS_KIT_DEJA_POSSEDE", "deja_possede"],
  ["KS_PRODUIT_INTROUVABLE", "introuvable"],
  ["KS_INDISPONIBLE", "indisponible"],
  ["KS_VARIANTE_INTROUVABLE", "taille"],
  ["KS_VARIANTE_INVALIDE", "taille"],
  ["KS_QUANTITE_INVALIDE", "quantite"],
  ["KS_LIGNE_UNIQUE", "ligne_unique"],
];

function codeDeLaBase(message: string): CodeErreurPanier {
  for (const [code, erreur] of CODES_BASE) if (message.includes(code)) return erreur;
  return "erreur";
}

const ETATS: readonly EtatLigne[] = ["disponible", "dernieres_pieces", "sur_commande", "complet", "epuise"];

// Identifiant du Panier du cookie s'il est correctement signé, sinon null.
async function panierDuCookie(deps: DependancesPanier): Promise<string | null> {
  return lirePanierSigne(await deps.lireCookie(), deps.secret());
}

async function auteurCourant(deps: DependancesPanier): Promise<{ auteur: Auteur; compteId: string | null }> {
  const compteId = await deps.compteId().catch(() => null);
  return { auteur: compteId ? construireAuteur(compteId) : AUTEUR_VISITEUR, compteId };
}

// Crée un Panier en base, puis pose le cookie signé. Le cookie n'est posé qu'après la réponse réelle de la base (règle 13).
async function nouveauPanier(deps: DependancesPanier, auteur: Auteur): Promise<string | null> {
  const r = await deps.creerPanier(auteur);
  if ("erreur" in r) {
    journaliser("création du Panier impossible");
    return null;
  }
  await deps.poserCookie(signerPanier(r.id, deps.secret()));
  return r.id;
}

// Ajoute un article. Un cookie absent, modifié ou devenu inconnu de la base donne un nouveau Panier (une seule reprise).
export async function ajouter(deps: DependancesPanier, entree: EntreeAjout): Promise<ResultatPanier<{ nombre: number }>> {
  const lu = ajoutSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  try {
    const { auteur, compteId } = await auteurCourant(deps);
    let panierId = await panierDuCookie(deps);
    let neuf = false;
    if (!panierId) {
      panierId = await nouveauPanier(deps, auteur);
      if (!panierId) return { ok: false, erreur: "erreur" };
      neuf = true;
    }
    const essai = (id: string) =>
      deps.ajouter({ auteur, panierId: id, compteId, produitId: lu.data.produitId, taille: lu.data.taille ?? null, nombre: lu.data.nombre });
    let r = await essai(panierId);
    let utilise = panierId;
    if (r.erreur?.includes("KS_PANIER_INTROUVABLE") && !neuf) {
      const id = await nouveauPanier(deps, auteur);
      if (!id) return { ok: false, erreur: "erreur" };
      r = await essai(id);
      utilise = id;
    }
    if (r.erreur) {
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("ajouter_au_panier : échec");
      return { ok: false, erreur };
    }
    const compte = await deps.compter(utilise);
    return { ok: true, nombre: "nombre" in compte ? compte.nombre : 0 };
  } catch {
    journaliser("ajout : exception");
    return { ok: false, erreur: "erreur" };
  }
}

export async function modifier(deps: DependancesPanier, entree: { ligneId: string; nombre: number }): Promise<ResultatPanier> {
  const lu = modificationSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "quantite" };
  try {
    const panierId = await panierDuCookie(deps);
    if (!panierId) return { ok: false, erreur: "introuvable" };
    const { auteur } = await auteurCourant(deps);
    const r = await deps.modifier({ auteur, panierId, ligneId: lu.data.ligneId, nombre: lu.data.nombre });
    if (r.erreur) {
      if (r.erreur.includes("KS_LIGNE_INTROUVABLE") || r.erreur.includes("KS_PANIER_INTROUVABLE")) return { ok: false, erreur: "introuvable" };
      const erreur = codeDeLaBase(r.erreur);
      if (erreur === "erreur") journaliser("modifier_ligne_panier : échec");
      return { ok: false, erreur };
    }
    return { ok: true };
  } catch {
    journaliser("modification : exception");
    return { ok: false, erreur: "erreur" };
  }
}

export async function retirer(deps: DependancesPanier, entree: { ligneId: string }): Promise<ResultatPanier> {
  const lu = retraitSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "invalide" };
  try {
    const panierId = await panierDuCookie(deps);
    if (!panierId) return { ok: false, erreur: "introuvable" };
    const { auteur } = await auteurCourant(deps);
    const r = await deps.retirer({ auteur, panierId, ligneId: lu.data.ligneId });
    if (r.erreur) {
      if (r.erreur.includes("KS_LIGNE_INTROUVABLE") || r.erreur.includes("KS_PANIER_INTROUVABLE")) return { ok: false, erreur: "introuvable" };
      journaliser("retirer_ligne_panier : échec");
      return { ok: false, erreur: "erreur" };
    }
    return { ok: true };
  } catch {
    journaliser("retrait : exception");
    return { ok: false, erreur: "erreur" };
  }
}

function enLigne(b: LigneBrute, langue: "fr" | "en"): LignePanier | null {
  const etat = ETATS.find((e) => e === b.etat);
  const famille = b.famille === "cosplay" || b.famille === "accessoire" || b.famille === "kit" ? b.famille : null;
  if (!etat || !famille) return null;
  return {
    id: b.ligne_id,
    produitId: b.produit_id,
    famille,
    slug: b.slug,
    titre: langue === "en" && b.titre_en ? b.titre_en : b.titre_fr,
    taille: b.taille,
    nombre: b.nombre,
    prixCents: b.prix_cents ?? 0,
    etat,
    delaiJours: b.delai_jours,
  };
}

// Panier du visiteur, relu en base : prix, disponibilité et délai ne sont jamais figés (règle 3). Un Panier vide, absent ou illisible
// donne une liste vide (la lecture impossible est signalée par `null`).
export async function lire(deps: DependancesPanier, langue: "fr" | "en"): Promise<PanierLu | null> {
  const vide: PanierLu = { lignes: [], nombreArticles: 0, sousTotalCents: 0, bloque: false, avisKitPossede: false };
  try {
    const panierId = await panierDuCookie(deps);
    if (!panierId) return vide;
    const r = await deps.lire(panierId);
    if ("erreur" in r) {
      journaliser("lecture du Panier impossible");
      return null;
    }
    const avis = await deps.avis(panierId);
    const lignes = r.lignes.map((b) => enLigne(b, langue)).filter((l): l is LignePanier => l !== null);
    const disponibles = lignes.filter((l) => l.etat !== "complet" && l.etat !== "epuise");
    return {
      lignes,
      nombreArticles: lignes.reduce((s, l) => s + l.nombre, 0),
      sousTotalCents: disponibles.reduce((s, l) => s + l.prixCents * l.nombre, 0),
      bloque: disponibles.length < lignes.length,
      // Une annonce illisible n'empêche jamais d'afficher le Panier.
      avisKitPossede: "avis" in avis && avis.avis,
    };
  } catch {
    journaliser("lecture : exception");
    return null;
  }
}

// Nombre d'articles pour l'en-tête. Toute erreur vaut 0 : l'en-tête ne bloque jamais la page.
export async function compter(deps: DependancesPanier): Promise<number> {
  try {
    const panierId = await panierDuCookie(deps);
    if (!panierId) return 0;
    const r = await deps.compter(panierId);
    return "nombre" in r ? r.nombre : 0;
  } catch {
    return 0;
  }
}

// À la connexion (story 4.2) : rattache le Panier du cookie au Compte, ou le réunit au Panier déjà lié au Compte, puis pointe le cookie
// sur le Panier retenu. Ne bloque jamais la connexion : toute erreur est journalisée (code seulement) et le Panier reste tel quel.
export async function fusionner(deps: DependancesPanier, compteId: string): Promise<void> {
  try {
    const courant = await panierDuCookie(deps);
    const r = await deps.fusionner({ auteur: construireAuteur(compteId), compteId, panierId: courant });
    if ("erreur" in r) {
      journaliser("fusion du Panier impossible");
      return;
    }
    if (r.panierId && r.panierId !== courant) await deps.poserCookie(signerPanier(r.panierId, deps.secret()));
  } catch {
    journaliser("fusion : exception");
  }
}
