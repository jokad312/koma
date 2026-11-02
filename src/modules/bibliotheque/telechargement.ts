import { z } from "zod";
import { masquerEmail } from "./filigrane";

// Durée de vie d'un lien de téléchargement (AD-11) : 60 secondes, un nouveau lien à chaque clic.
export const DUREE_LIEN_SECONDES = 60;

const fichierIdSchema = z.uuid();

export type FichierAServir = {
  fichier_id: string;
  format: "pdf_a4" | "pdf_letter" | "svg" | "stl" | "transcription";
  version: number;
  nom_fr: string;
  nom_en: string;
  chemin_stockage: string;
  email: string;
  numero_commande: string;
  chemin_filigrane: string | null;
};

export type DependancesTelechargement = {
  compteId: () => Promise<string | null>;
  // Null sans accès au Kit du fichier (la base vérifie l'accès).
  fichierAServir: (compteId: string, fichierId: string) => Promise<FichierAServir | null>;
  nomSite: () => Promise<string>;
  libelleFiligrane: (v: { email: string; numero: string; site: string }) => string;
  lireObjet: (chemin: string) => Promise<Uint8Array>;
  deposerObjet: (chemin: string, octets: Uint8Array) => Promise<void>;
  enregistrerFiligrane: (compteId: string, fichierId: string, version: number, chemin: string) => Promise<string | null>;
  police: () => Promise<Uint8Array>;
  filigraner: (pdf: Uint8Array, texte: string, police: Uint8Array) => Promise<Uint8Array>;
  signer: (chemin: string, secondes: number, nomTelechargement: string) => Promise<string>;
};

export type ResultatTelechargement =
  | { statut: "ok"; url: string }
  | { statut: "non_connecte" }
  | { statut: "refuse" }
  | { statut: "erreur" };

const EXTENSIONS: Record<FichierAServir["format"], string> = { pdf_a4: "pdf", pdf_letter: "pdf", svg: "svg", stl: "stl", transcription: "txt" };

// Nom proposé au navigateur : le nom FR du fichier, sans caractère de chemin, avec l'extension du format.
export function nomTelechargement(f: Pick<FichierAServir, "format" | "nom_fr">): string {
  const base = f.nom_fr.replace(/[\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "kit";
  const ext = EXTENSIONS[f.format];
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

// Ordre : session, puis accès (la base), puis copie filigranée pour un PDF (créée à la première remise par Compte et par version,
// réutilisée ensuite), puis lien signé de 60 secondes. Sans accès : refus, sans aucun lien. SVG, STL et transcriptions : sans filigrane.
export async function preparerTelechargement(deps: DependancesTelechargement, fichierId: string): Promise<ResultatTelechargement> {
  try {
    const compte = await deps.compteId();
    if (!compte) return { statut: "non_connecte" };
    // Un identifiant invalide et un fichier sans accès reçoivent le même refus : rien ne révèle ce qui existe.
    if (!fichierIdSchema.safeParse(fichierId).success) return { statut: "refuse" };
    const fichier = await deps.fichierAServir(compte, fichierId);
    if (!fichier) return { statut: "refuse" };

    let chemin = fichier.chemin_stockage;
    if (fichier.format === "pdf_a4" || fichier.format === "pdf_letter") {
      if (fichier.chemin_filigrane) {
        chemin = fichier.chemin_filigrane;
      } else {
        const [original, police, site] = await Promise.all([deps.lireObjet(fichier.chemin_stockage), deps.police(), deps.nomSite()]);
        const texte = deps.libelleFiligrane({ email: masquerEmail(fichier.email), numero: fichier.numero_commande, site });
        const copie = await deps.filigraner(original, texte, police);
        const cible = `filigranes/${compte}/${fichier.fichier_id}-v${fichier.version}.pdf`;
        await deps.deposerObjet(cible, copie);
        const retenu = await deps.enregistrerFiligrane(compte, fichier.fichier_id, fichier.version, cible);
        // Plus d'accès, ou version remplacée entre-temps : aucun lien.
        if (!retenu) return { statut: "refuse" };
        chemin = retenu;
      }
    }
    const url = await deps.signer(chemin, DUREE_LIEN_SECONDES, nomTelechargement(fichier));
    return { statut: "ok", url };
  } catch {
    console.error("[bibliotheque] préparation du téléchargement impossible");
    return { statut: "erreur" };
  }
}
