import { BUCKET_ATTENTE } from "./stockage";

// Envoi direct du navigateur vers un bucket privé (galerie-attente par défaut, kits-private pour les fichiers de Kit), en TUS (reprise après coupure), sur autorisation signée par le serveur :
// le jeton (x-signature) n'ouvre que l'objet choisi par le serveur. Aucune clé secrète ne passe ici.
export const TAILLE_MORCEAU_TUS = 6 * 1024 * 1024;

// Message de l'erreur qui termine un envoi annulé (l'appelant le traite comme une annulation, pas comme un échec).
export const MESSAGE_ANNULE = "annule";

export type ParametresEnvoiTus = {
  fichier: Blob;
  contentType: string;
  objet: string;
  jeton: string;
  // Bucket privé visé (le jeton du serveur n'ouvre que l'objet qu'il a choisi) ; galerie-attente par défaut.
  bucket?: string;
  // Adresse du projet Supabase (NEXT_PUBLIC_SUPABASE_URL) et clé publique (publishable), toutes deux publiques par conception.
  adresseSupabase: string;
  clePublique: string;
  onProgression: (octetsEnvoyes: number, octetsTotal: number) => void;
  // Appelé quand une tentative échoue et qu'une reprise automatique est prévue.
  onReprise: () => void;
};

export type EnvoiTus = {
  // Résout à la fin de l'envoi ; rejette si l'envoi est abandonné après les reprises automatiques.
  terminer: Promise<void>;
  // Arrête l'envoi et demande l'effacement de la partie déjà reçue.
  annuler: () => Promise<void>;
};

export async function demarrerEnvoiTus(p: ParametresEnvoiTus): Promise<EnvoiTus> {
  const { Upload } = await import("tus-js-client");
  let envoi: InstanceType<typeof Upload> | null = null;
  let rejeter: (erreur: unknown) => void = () => {};
  const terminer = new Promise<void>((resolve, reject) => {
    rejeter = reject;
    envoi = new Upload(p.fichier, {
      // Point d'accès des envois signés : « /upload/resumable » seul refuse le jeton x-signature (essai réel sur koma-dev, 403 RLS).
      endpoint: `${p.adresseSupabase.replace(/\/+$/, "")}/storage/v1/upload/resumable/sign`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: TAILLE_MORCEAU_TUS,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { "x-signature": p.jeton, apikey: p.clePublique },
      metadata: { bucketName: p.bucket ?? BUCKET_ATTENTE, objectName: p.objet, contentType: p.contentType, cacheControl: "3600" },
      onShouldRetry: (erreur, nombreDeTentatives, options) => {
        // Un refus du serveur (jeton invalide, fichier refusé) ne se réessaie pas ; une coupure réseau ou une erreur serveur, si.
        const statut = erreur.originalResponse?.getStatus();
        if (statut && statut >= 400 && statut < 500 && ![409, 423, 429].includes(statut)) return false;
        const prevu = nombreDeTentatives < (options.retryDelays?.length ?? 0);
        if (prevu) p.onReprise();
        return prevu;
      },
      onProgress: p.onProgression,
      onSuccess: () => resolve(),
      onError: (erreur) => reject(erreur),
    });
    envoi.start();
  });
  return {
    terminer,
    annuler: async () => {
      try {
        await envoi?.abort(true);
      } catch {
        // L'effacement de la partie reçue est refait côté serveur (annulerEnvoiPhoto).
      }
      // Un envoi abandonné par l'utilisateur ne se termine jamais de lui-même : on le rejette pour libérer l'appelant.
      rejeter(new Error(MESSAGE_ANNULE));
    },
  };
}
