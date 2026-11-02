import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTranslations } from "next-intl/server";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { lireNomSite } from "@/lib/reglages";
import { BUCKET_KITS } from "@/lib/supabase/stockage";
import { creerClientService } from "@/lib/supabase/service";
import { appliquerFiligrane } from "./filigrane";
import type { DependancesTelechargement, FichierAServir } from "./telechargement";

// Police du filigrane (Barlow Regular, OFL 1.1 : docs/licences/polices.md). Lue une fois par processus.
const CHEMIN_POLICE = path.join(process.cwd(), "src", "fonts", "filigrane", "Barlow-Regular.ttf");
let policeEnMemoire: Promise<Uint8Array> | null = null;

export async function dependancesTelechargement(): Promise<DependancesTelechargement> {
  // Le filigrane est écrit une seule fois par Compte et par version : sa langue est le français, quelle que soit la page de départ.
  const t = await getTranslations({ locale: "fr", namespace: "Bibliotheque.filigrane" });
  return {
    compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
    fichierAServir: async (compteId, fichierId) => {
      const { data, error } = await creerClientService().rpc("bibliotheque_fichier_a_servir", { p_compte: compteId, p_fichier: fichierId });
      if (error) throw new Error("bibliotheque_fichier_a_servir");
      return (data as FichierAServir | null) ?? null;
    },
    nomSite: () => lireNomSite(),
    libelleFiligrane: (v) => t("texte", v),
    lireObjet: async (chemin) => {
      const { data, error } = await creerClientService().storage.from(BUCKET_KITS).download(chemin);
      if (error || !data) throw new Error("lecture du fichier");
      return new Uint8Array(await data.arrayBuffer());
    },
    deposerObjet: async (chemin, octets) => {
      const { error } = await creerClientService().storage.from(BUCKET_KITS).upload(chemin, octets, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error("dépôt de la copie");
    },
    enregistrerFiligrane: async (compteId, fichierId, version, chemin) => {
      const { data, error } = await creerClientService().rpc("bibliotheque_enregistrer_filigrane", {
        p_compte: compteId,
        p_fichier: fichierId,
        p_version: version,
        p_chemin: chemin,
      });
      if (error) throw new Error("bibliotheque_enregistrer_filigrane");
      return typeof data === "string" ? data : null;
    },
    police: () => (policeEnMemoire ??= readFile(CHEMIN_POLICE).then((b) => new Uint8Array(b))),
    filigraner: appliquerFiligrane,
    signer: async (chemin, secondes, nom) => {
      const { data, error } = await creerClientService().storage.from(BUCKET_KITS).createSignedUrl(chemin, secondes, { download: nom });
      if (error || !data?.signedUrl) throw new Error("lien signé");
      return data.signedUrl;
    },
  };
}
