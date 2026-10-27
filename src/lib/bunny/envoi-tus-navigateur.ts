import { MESSAGE_ANNULE, TAILLE_MORCEAU_TUS, type EnvoiTus } from "@/lib/supabase/envoi-tus";

// Envoi direct du navigateur vers la bibliothèque Bunny PUBLIQUE, en TUS (reprise après coupure), sur autorisation signée par le serveur :
// la signature n'ouvre que la vidéo créée par le serveur, pour une durée limitée. La clé de l'API ne passe jamais ici.
export type AutorisationNavigateur = {
  adresse: string;
  signature: string;
  expiration: number;
  videoId: string;
  bibliothequeId: string;
  titre: string;
};

export type ParametresEnvoiBunny = {
  fichier: File;
  autorisation: AutorisationNavigateur;
  onProgression: (octetsEnvoyes: number, octetsTotal: number) => void;
  onReprise: () => void;
};

export async function demarrerEnvoiBunny(p: ParametresEnvoiBunny): Promise<EnvoiTus> {
  const { Upload } = await import("tus-js-client");
  let envoi: InstanceType<typeof Upload> | null = null;
  let rejeter: (erreur: unknown) => void = () => {};
  const terminer = new Promise<void>((resolve, reject) => {
    rejeter = reject;
    envoi = new Upload(p.fichier, {
      endpoint: p.autorisation.adresse,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: TAILLE_MORCEAU_TUS,
      removeFingerprintOnSuccess: true,
      headers: {
        AuthorizationSignature: p.autorisation.signature,
        AuthorizationExpire: String(p.autorisation.expiration),
        VideoId: p.autorisation.videoId,
        LibraryId: p.autorisation.bibliothequeId,
      },
      metadata: { filetype: p.fichier.type, title: p.autorisation.titre },
      onShouldRetry: (erreur, nombreDeTentatives, options) => {
        // Un refus du serveur (signature invalide ou expirée) ne se réessaie pas ; une coupure réseau ou une erreur serveur, si.
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
        // La vidéo créée chez Bunny est effacée côté serveur (annulerEnvoiVideo).
      }
      rejeter(new Error(MESSAGE_ANNULE));
    },
  };
}
