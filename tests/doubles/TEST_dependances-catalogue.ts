import { vi } from "vitest";
import type { FormatFichierKit } from "@/modules/catalogue/fichiers-kit";
import { BunnyNonConfigureError } from "@/lib/bunny/config";
import type { DependancesCatalogue, DependancesMediasKit, FamilleProduit, ProduitPourPublication } from "@/modules/catalogue/types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/).
export const TEST_ADMIN_ID = "TEST_admin-0001";

// Même forme que DroitRefuseError (src/lib/auth/droits.ts, server-only) : le service ne lit que le code.
class TEST_DroitRefuse extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Reglages = {
  droit?: "KS_NON_CONNECTE" | "KS_DROIT_REFUSE" | "KS_VERIFICATION_IMPOSSIBLE" | null;
  erreurUnivers?: string | null;
  erreurProduit?: string | null;
  idUnivers?: string | null;
  idProduit?: string | null;
  slugLibre?: string | "erreur";
  // Photos et publication.
  erreurSigner?: string | null;
  octetsAttente?: Uint8Array | null;
  erreurLectureAttente?: string | null;
  erreurEcriturePublique?: string | null;
  erreurSuppression?: string | null;
  erreurPhoto?: string | null;
  // L'appel LÈVE au lieu de répondre : résultat inconnu.
  leveEcriturePublique?: boolean;
  levePhoto?: boolean;
  erreurDeplacer?: string | null;
  erreurPublication?: string | null;
  erreurSupprimerPhoto?: string | null;
  erreurAlt?: string | null;
  invalidationEnEchec?: boolean;
  // Produit lu pour la complétude : par défaut complet. null : produit inconnu. Une fonction permet de changer entre deux lectures.
  produitComplet?: ProduitPourPublication | null | (() => ProduitPourPublication | null);
  lectureProduitEnEchec?: boolean;
  // Tranches de prix.
  erreurTranches?: string | null;
  invalidationReglagesEnEchec?: boolean;
  // Kits et fichiers (story 3.1).
  erreurKit?: string | null;
  idKit?: string | null;
  // Chemin déjà enregistré en base (par défaut non). Lève si cheminKitEnregistreLeve.
  cheminEnregistre?: boolean;
  cheminKitEnregistreLeve?: boolean;
  erreurDeplacerObjet?: string | null;
  // Famille lue pour le produit : par défaut « cosplay » (les tests de Kit demandent « kit »). null : produit inconnu.
  familleProduit?: FamilleProduit | null;
  // Fichier lu pour un remplacement : par défaut le fichier TEST_fichier-0001 du produit TEST_produit-0001 au format pdf_a4. null : inconnu.
  fichierKit?: { produitId: string; format: FormatFichierKit } | null;
  erreurSignerKit?: string | null;
  // Objet lu après l'envoi : par défaut absent (trouve: false).
  objetKit?: { trouve: boolean; taille: number; debut: Uint8Array } | null;
  erreurLectureObjetKit?: string | null;
  erreurFichierKit?: string | null;
  erreurRemplacerFichier?: string | null;
  erreurSupprimerFichier?: string | null;
  // L'appel LÈVE au lieu de répondre : résultat inconnu.
  leveFichierKit?: boolean;
  leveRemplacerFichier?: boolean;
  // Chemin renvoyé par le remplacement / la suppression (par défaut un chemin TEST_).
  ancienChemin?: string | null;
  cheminSupprime?: string | null;
};

// Identifiant (minuscules, forme d'un uuid) du Kit des tests de fichiers.
export const TEST_KIT_ID = "00000000-0000-4000-8000-000000000001";

export const TEST_PRODUIT_COMPLET: ProduitPourPublication = {
  famille: "cosplay",
  prixCents: 4990,
  titreFr: "TEST_Titre",
  titreEn: "TEST_Title",
  descriptionFr: "TEST_description",
  descriptionEn: "TEST_description en",
  nbPhotos: 1,
  nbVariantes: 1,
  publieLe: null,
  materielFr: null,
  materielEn: null,
  niveau: null,
  nbFichiers: 0,
  videoPrete: false,
  sousTitresFr: false,
  extraitSansSousTitresFr: false,
};

// Kit complet (story 3.2) : sans sous-titres anglais ni extrait, qui ne bloquent pas la publication.
export const TEST_KIT_COMPLET: ProduitPourPublication = {
  famille: "kit",
  prixCents: 990,
  titreFr: "TEST_Kit",
  titreEn: "TEST_Kit en",
  descriptionFr: "TEST_description",
  descriptionEn: "TEST_description en",
  nbPhotos: 1,
  nbVariantes: 0,
  publieLe: null,
  materielFr: "TEST_mousse",
  materielEn: "TEST_foam",
  niveau: "debutant",
  nbFichiers: 1,
  videoPrete: true,
  sousTitresFr: true,
  extraitSansSousTitresFr: false,
};

export function creerTestDependancesCatalogue(r: Reglages = {}) {
  const appels = {
    ordre: [] as string[],
    droits: [] as string[],
    univers: [] as unknown[],
    produits: [] as Array<Parameters<DependancesCatalogue["ecrireProduit"]>[0]>,
    slugs: [] as unknown[],
    signatures: [] as string[],
    ecritsPublics: [] as Array<{ objet: string; octets: Uint8Array; contentType: string }>,
    suppressions: [] as Array<{ bucket: string; objets: string[] }>,
    photos: [] as Array<Parameters<DependancesCatalogue["ecrirePhoto"]>[0]>,
    deplacements: [] as Array<Parameters<DependancesCatalogue["deplacerPhoto"]>[0]>,
    suppressionsPhoto: [] as Array<Parameters<DependancesCatalogue["supprimerPhoto"]>[0]>,
    alts: [] as Array<Parameters<DependancesCatalogue["modifierAltPhoto"]>[0]>,
    publications: [] as Array<Parameters<DependancesCatalogue["changerPublication"]>[0]>,
    invalidations: 0,
    tranches: [] as Array<Parameters<DependancesCatalogue["ecrireTranches"]>[0]>,
    invalidationsReglages: 0,
    kits: [] as Array<Parameters<DependancesCatalogue["ecrireKit"]>[0]>,
    signaturesKit: [] as string[],
    lecturesObjetKit: [] as Array<{ objet: string; octets: number }>,
    fichiersKit: [] as Array<Parameters<DependancesCatalogue["ecrireFichierKit"]>[0]>,
    remplacementsKit: [] as Array<Parameters<DependancesCatalogue["remplacerFichierKit"]>[0]>,
    deplacementsKit: [] as Array<{ de: string; vers: string }>,
    suppressionsFichierKit: [] as Array<Parameters<DependancesCatalogue["supprimerFichierKit"]>[0]>,
  };
  const deps: DependancesCatalogue = {
    exigerDroit: vi.fn(async (droit) => {
      appels.ordre.push("droit");
      appels.droits.push(droit);
      if (r.droit) throw new TEST_DroitRefuse(r.droit);
      return { auteur: { type: "compte" as const, id: TEST_ADMIN_ID, role: "admin" as const } };
    }),
    ecrireUnivers: vi.fn(async (args) => {
      appels.ordre.push("univers");
      appels.univers.push(args);
      return { erreur: r.erreurUnivers ?? null, id: r.erreurUnivers ? null : (r.idUnivers === undefined ? "TEST_univers-0001" : r.idUnivers) };
    }),
    ecrireProduit: vi.fn(async (args) => {
      appels.ordre.push("produit");
      appels.produits.push(args);
      return { erreur: r.erreurProduit ?? null, id: r.erreurProduit ? null : (r.idProduit === undefined ? (args.id ?? "TEST_produit-0001") : r.idProduit) };
    }),
    premierSlugLibre: vi.fn(async (base, exclureId) => {
      appels.slugs.push({ base, exclureId });
      if (r.slugLibre === "erreur") throw new Error("TEST_lecture");
      return r.slugLibre ?? `${base}-2`;
    }),
    signerEnvoiPhoto: vi.fn(async ({ objet }) => {
      appels.ordre.push("signer");
      appels.signatures.push(objet);
      return { erreur: r.erreurSigner ?? null, jeton: r.erreurSigner ? null : "TEST_jeton" };
    }),
    lireObjetAttente: vi.fn(async () => {
      appels.ordre.push("lireAttente");
      if (r.erreurLectureAttente) return { erreur: r.erreurLectureAttente, octets: null };
      return { erreur: null, octets: r.octetsAttente ?? null };
    }),
    ecrireObjetPublic: vi.fn(async (args) => {
      appels.ordre.push("ecrirePublic");
      appels.ecritsPublics.push(args);
      if (r.leveEcriturePublique) throw new Error("TEST_coupure");
      return { erreur: r.erreurEcriturePublique ?? null };
    }),
    supprimerObjets: vi.fn(async (args) => {
      appels.ordre.push(`supprimer:${args.bucket}`);
      appels.suppressions.push(args);
      return { erreur: r.erreurSuppression ?? null };
    }),
    ecrirePhoto: vi.fn(async (args) => {
      appels.ordre.push("photo");
      appels.photos.push(args);
      if (r.levePhoto) throw new Error("TEST_coupure");
      return { erreur: r.erreurPhoto ?? null, id: r.erreurPhoto ? null : "TEST_photo-0001" };
    }),
    deplacerPhoto: vi.fn(async (args) => {
      appels.ordre.push("deplacer");
      appels.deplacements.push(args);
      return { erreur: r.erreurDeplacer ?? null };
    }),
    supprimerPhoto: vi.fn(async (args) => {
      appels.ordre.push("supprimerPhoto");
      appels.suppressionsPhoto.push(args);
      return { erreur: r.erreurSupprimerPhoto ?? null, fichier: r.erreurSupprimerPhoto ? null : "TEST_produit/TEST_fichier.jpg" };
    }),
    modifierAltPhoto: vi.fn(async (args) => {
      appels.ordre.push("alt");
      appels.alts.push(args);
      return { erreur: r.erreurAlt ?? null };
    }),
    changerPublication: vi.fn(async (args) => {
      appels.ordre.push("publication");
      appels.publications.push(args);
      return { erreur: r.erreurPublication ?? null };
    }),
    ecrireTranches: vi.fn(async (args) => {
      appels.ordre.push("tranches");
      appels.tranches.push(args);
      return { erreur: r.erreurTranches ?? null };
    }),
    invaliderReglages: vi.fn(async () => {
      appels.ordre.push("invalidationReglages");
      appels.invalidationsReglages += 1;
      if (r.invalidationReglagesEnEchec) throw new Error("TEST_cache");
    }),
    invaliderCatalogue: vi.fn(async () => {
      appels.ordre.push("invalidation");
      appels.invalidations += 1;
      if (r.invalidationEnEchec) throw new Error("TEST_cache");
    }),
    lireProduitComplet: vi.fn(async () => {
      if (r.lectureProduitEnEchec) throw new Error("TEST_lecture");
      const p = r.produitComplet === undefined ? TEST_PRODUIT_COMPLET : r.produitComplet;
      return typeof p === "function" ? p() : p;
    }),
    ecrireKit: vi.fn(async (args) => {
      appels.ordre.push("kit");
      appels.kits.push(args);
      return { erreur: r.erreurKit ?? null, id: r.erreurKit ? null : (r.idKit === undefined ? (args.id ?? "TEST_kit-0001") : r.idKit) };
    }),
    lireFamilleProduit: vi.fn(async () => {
      appels.ordre.push("familleProduit");
      return r.familleProduit === undefined ? "cosplay" : r.familleProduit;
    }),
    lireFichierKit: vi.fn(async () => {
      appels.ordre.push("lireFichierKit");
      return r.fichierKit === undefined ? { produitId: TEST_KIT_ID, format: "pdf_a4" as const } : r.fichierKit;
    }),
    cheminKitEnregistre: vi.fn(async () => {
      appels.ordre.push("cheminEnregistre");
      if (r.cheminKitEnregistreLeve) throw new Error("TEST_lecture");
      return r.cheminEnregistre ?? false;
    }),
    deplacerObjetKit: vi.fn(async (args) => {
      appels.ordre.push("deplacer");
      appels.deplacementsKit.push(args);
      return { erreur: r.erreurDeplacerObjet ?? null };
    }),
    signerEnvoiFichierKit: vi.fn(async ({ objet }) => {
      appels.ordre.push("signerKit");
      appels.signaturesKit.push(objet);
      return { erreur: r.erreurSignerKit ?? null, jeton: r.erreurSignerKit ? null : "TEST_jeton-kit" };
    }),
    lireObjetKit: vi.fn(async (args) => {
      appels.ordre.push("lireObjetKit");
      appels.lecturesObjetKit.push(args);
      if (r.erreurLectureObjetKit) return { erreur: r.erreurLectureObjetKit, trouve: false, taille: 0, debut: new Uint8Array(0) };
      const o = r.objetKit ?? { trouve: false, taille: 0, debut: new Uint8Array(0) };
      return { erreur: null, ...o };
    }),
    ecrireFichierKit: vi.fn(async (args) => {
      appels.ordre.push("fichierKit");
      appels.fichiersKit.push(args);
      if (r.leveFichierKit) throw new Error("TEST_coupure");
      return { erreur: r.erreurFichierKit ?? null, id: r.erreurFichierKit ? null : "TEST_fichier-0001" };
    }),
    remplacerFichierKit: vi.fn(async (args) => {
      appels.ordre.push("remplacerFichierKit");
      appels.remplacementsKit.push(args);
      if (r.leveRemplacerFichier) throw new Error("TEST_coupure");
      return { erreur: r.erreurRemplacerFichier ?? null, ancienChemin: r.erreurRemplacerFichier ? null : (r.ancienChemin === undefined ? "TEST_kit/TEST_ancien.pdf" : r.ancienChemin) };
    }),
    supprimerFichierKit: vi.fn(async (args) => {
      appels.ordre.push("supprimerFichierKit");
      appels.suppressionsFichierKit.push(args);
      return { erreur: r.erreurSupprimerFichier ?? null, chemin: r.erreurSupprimerFichier ? null : (r.cheminSupprime === undefined ? "TEST_kit/TEST_fichier.pdf" : r.cheminSupprime) };
    }),
  };
  return { deps, appels };
}

// ---- Vidéo, chapitres et sous-titres d'un Kit (story 3.2) ----

type VideoBunnyTest = { guid: string; title: string; status: number; encodeProgress?: number; length?: number };

type ReglagesMedias = {
  droit?: "KS_NON_CONNECTE" | "KS_DROIT_REFUSE" | "KS_VERIFICATION_IMPOSSIBLE" | null;
  familleProduit?: FamilleProduit | null;
  // Variable Bunny absente (BunnyNonConfigureError).
  configPriveeManquante?: boolean;
  configPubliqueManquante?: boolean;
  // Vidéos présentes chez Bunny, par identifiant (bibliothèques privée et publique confondues dans ce faux).
  videos?: Record<string, VideoBunnyTest>;
  // Identifiant donné à la prochaine vidéo créée.
  idCree?: string;
  creationEnEchec?: boolean;
  // Vidéo enregistrée en base.
  videoKit?: { bunnyIdPrive: string; extraitId: string | null; dureeSecondes: number } | null;
  erreurVideo?: string | null;
  ancienVideo?: string | null;
  erreurExtrait?: string | null;
  ancienExtrait?: string | null;
  erreurSupprimerVideo?: string | null;
  erreurChapitre?: string | null;
  // Sous-titres.
  cheminEnregistre?: boolean;
  objetKit?: { trouve: boolean; taille: number; debut: Uint8Array } | null;
  erreurLectureObjet?: string | null;
  erreurDeplacer?: string | null;
  erreurSousTitres?: string | null;
  leveSousTitres?: boolean;
  ancienCheminSousTitres?: string | null;
  erreurSupprimerSousTitres?: string | null;
  // Sous-titres de l'extrait (story 3.3).
  captionsEnEchec?: boolean;
  erreurSousTitresExtrait?: string | null;
  erreurSansParole?: string | null;
};

const TEST_BUNNY = "https://video.bunnycdn.com/library/";

export function creerTestDependancesMediasKit(r: ReglagesMedias = {}) {
  const videos: Record<string, VideoBunnyTest> = { ...(r.videos ?? {}) };
  const appels = {
    ordre: [] as string[],
    bunny: [] as string[],
    videosEcrites: [] as Array<Parameters<DependancesMediasKit["ecrireVideoKit"]>[0]>,
    extraitsEcrits: [] as Array<Parameters<DependancesMediasKit["ecrireExtraitKit"]>[0]>,
    chapitres: [] as unknown[],
    signatures: [] as string[],
    deplacements: [] as Array<{ de: string; vers: string }>,
    sousTitres: [] as Array<Parameters<DependancesMediasKit["ecrireSousTitres"]>[0]>,
    suppressionsObjets: [] as string[][],
    invalidations: 0,
  };
  const deps: DependancesMediasKit = {
    exigerDroit: vi.fn(async (droit) => {
      appels.ordre.push(`droit:${droit}`);
      if (r.droit) throw new TEST_DroitRefuse(r.droit);
      return { auteur: { type: "compte" as const, id: TEST_ADMIN_ID, role: "admin" as const } };
    }),
    configBunnyPrive: () => {
      if (r.configPriveeManquante) throw new BunnyNonConfigureError(["BUNNY_PRIVE_API_KEY"]);
      return { bibliothequeId: "111", cle: "TEST_cle-privee" };
    },
    configBunnyPublic: () => {
      if (r.configPubliqueManquante) throw new BunnyNonConfigureError(["BUNNY_PUBLIC_API_KEY"]);
      return { bibliothequeId: "222", cle: "TEST_cle-publique" };
    },
    reseau: (async (url: string, init?: RequestInit) => {
      const methode = init?.method ?? "GET";
      const chemin = url.replace(TEST_BUNNY, "");
      appels.bunny.push(`${methode} ${chemin}`);
      appels.ordre.push(`bunny:${methode}`);
      // API captions (sous-titres de l'extrait) : dépôt ou suppression, échec réglable.
      if (url.includes("/captions/")) return new Response("{}", { status: r.captionsEnEchec ? 503 : 200 });
      const id = url.split("/videos/")[1];
      if (methode === "POST") {
        if (r.creationEnEchec) return new Response("{}", { status: 500 });
        const guid = r.idCree ?? "00000000-0000-4000-8000-0000000000e1";
        const titre = JSON.parse(String(init?.body)).title as string;
        videos[guid] = { guid, title: titre, status: 0 };
        return new Response(JSON.stringify(videos[guid]), { status: 200 });
      }
      if (methode === "DELETE") {
        delete videos[id];
        return new Response("{}", { status: 200 });
      }
      return videos[id] ? new Response(JSON.stringify(videos[id]), { status: 200 }) : new Response("{}", { status: 404 });
    }) as unknown as typeof fetch,
    maintenant: () => 1_000_000_000_000,
    lireFamilleProduit: vi.fn(async () => (r.familleProduit === undefined ? "kit" : r.familleProduit)),
    lireVideoKit: vi.fn(async () => r.videoKit ?? null),
    ecrireVideoKit: vi.fn(async (args) => {
      appels.ordre.push("ecrireVideo");
      appels.videosEcrites.push(args);
      return { erreur: r.erreurVideo ?? null, ancien: r.erreurVideo ? null : (r.ancienVideo ?? null) };
    }),
    supprimerVideoKit: vi.fn(async () => {
      appels.ordre.push("supprimerVideo");
      if (r.erreurSupprimerVideo) return { erreur: r.erreurSupprimerVideo, prive: null, extrait: null };
      return { erreur: null, prive: r.videoKit?.bunnyIdPrive ?? null, extrait: r.videoKit?.extraitId ?? null };
    }),
    ecrireExtraitKit: vi.fn(async (args) => {
      appels.ordre.push("ecrireExtrait");
      appels.extraitsEcrits.push(args);
      return { erreur: r.erreurExtrait ?? null, ancien: r.erreurExtrait ? null : (r.ancienExtrait ?? null) };
    }),
    ajouterChapitre: vi.fn(async (args) => {
      appels.ordre.push("ajouterChapitre");
      appels.chapitres.push(args);
      return { erreur: r.erreurChapitre ?? null, id: r.erreurChapitre ? null : "TEST_chapitre-0001" };
    }),
    modifierChapitre: vi.fn(async (args) => {
      appels.ordre.push("modifierChapitre");
      appels.chapitres.push(args);
      return { erreur: r.erreurChapitre ?? null };
    }),
    deplacerChapitre: vi.fn(async (args) => {
      appels.ordre.push("deplacerChapitre");
      appels.chapitres.push(args);
      return { erreur: r.erreurChapitre ?? null };
    }),
    supprimerChapitre: vi.fn(async (args) => {
      appels.ordre.push("supprimerChapitre");
      appels.chapitres.push(args);
      return { erreur: r.erreurChapitre ?? null };
    }),
    signerEnvoiSousTitres: vi.fn(async ({ objet }) => {
      appels.ordre.push("signer");
      appels.signatures.push(objet);
      return { erreur: null, jeton: "TEST_jeton-vtt" };
    }),
    cheminSousTitresEnregistre: vi.fn(async () => r.cheminEnregistre ?? false),
    lireObjetKit: vi.fn(async () => {
      appels.ordre.push("lireObjet");
      if (r.erreurLectureObjet) return { erreur: r.erreurLectureObjet, trouve: false, taille: 0, debut: new Uint8Array(0) };
      return { erreur: null, ...(r.objetKit ?? { trouve: false, taille: 0, debut: new Uint8Array(0) }) };
    }),
    deplacerObjetKit: vi.fn(async (args) => {
      appels.ordre.push("deplacer");
      appels.deplacements.push(args);
      return { erreur: r.erreurDeplacer ?? null };
    }),
    ecrireSousTitres: vi.fn(async (args) => {
      appels.ordre.push("ecrireSousTitres");
      appels.sousTitres.push(args);
      if (r.leveSousTitres) throw new Error("TEST_coupure");
      return { erreur: r.erreurSousTitres ?? null, ancienChemin: r.erreurSousTitres ? null : (r.ancienCheminSousTitres ?? null) };
    }),
    supprimerSousTitres: vi.fn(async () => {
      appels.ordre.push("supprimerSousTitres");
      return { erreur: r.erreurSupprimerSousTitres ?? null, chemin: r.erreurSupprimerSousTitres ? null : `${TEST_KIT_ID}/sous-titres/TEST.vtt` };
    }),
    supprimerObjetsKit: vi.fn(async (objets) => {
      appels.ordre.push("supprimerObjets");
      appels.suppressionsObjets.push(objets);
      return { erreur: null };
    }),
    ecrireSousTitresExtrait: vi.fn(async () => {
      appels.ordre.push("ecrireSousTitresExtrait");
      return { erreur: r.erreurSousTitresExtrait ?? null };
    }),
    supprimerSousTitresExtrait: vi.fn(async () => {
      appels.ordre.push("supprimerSousTitresExtrait");
      return { erreur: r.erreurSousTitresExtrait ?? null };
    }),
    definirExtraitSansParole: vi.fn(async () => {
      appels.ordre.push("definirSansParole");
      return { erreur: r.erreurSansParole ?? null };
    }),
    invaliderCatalogue: vi.fn(async () => {
      appels.ordre.push("invalidation");
      appels.invalidations += 1;
    }),
  };
  return { deps, appels, videos };
}
