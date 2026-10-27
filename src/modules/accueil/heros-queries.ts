import "server-only";
import { lireHoteCdnPublic } from "@/lib/bunny/config";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientService } from "@/lib/supabase/service";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import { lireFicheProduit } from "@/modules/catalogue/queries";
import type { Disponibilite } from "@/modules/catalogue/types";
import { adresseVideoHeros, resumerDisponibilite } from "./heros-affichage";
import type { EtatHeros } from "./heros-types";

const COLONNES = "produit_id, video_id, video_fichier, repli_fichier, repli_alt_fr, repli_alt_en";

function versEtat(l: { produit_id: string | null; video_id: string | null; video_fichier: string | null; repli_fichier: string | null; repli_alt_fr: string | null; repli_alt_en: string | null }): EtatHeros {
  return {
    produitId: l.produit_id,
    videoId: l.video_id,
    videoFichier: l.video_fichier,
    repliFichier: l.repli_fichier,
    repliAltFr: l.repli_alt_fr,
    repliAltEn: l.repli_alt_en,
  };
}

// Lecture serveur (client service) : état du héros pour les actions. Une erreur de lecture est relancée.
export async function lireHerosService(): Promise<EtatHeros> {
  const { data, error } = await creerClientService().from("heros_accueil").select(COLONNES).eq("id", true).maybeSingle();
  if (error || !data) throw new Error("Lecture du héros impossible.");
  return versEtat(data);
}

export type HerosAdmin = {
  etat: EtatHeros;
  // Adresse publique de la photo de repli actuelle.
  repliUrl: string | null;
  // Titre du Cosplay vedette (null si aucun ou s'il n'est plus publié).
  vedetteTitre: string | null;
  // Cosplays publiés, au choix.
  cosplays: Array<{ id: string; titre: string }>;
  // Variables Bunny présentes (jamais leurs valeurs).
  bunnyConfigure: boolean;
};

export async function lireHerosAdmin(): Promise<HerosAdmin> {
  const client = creerClientService();
  const [etat, cosplays] = await Promise.all([
    lireHerosService(),
    client.from("produit").select("id, titre_fr").eq("famille", "cosplay").not("publie_le", "is", null).lte("publie_le", new Date().toISOString()).order("titre_fr", { ascending: true }),
  ]);
  if (cosplays.error || !cosplays.data) throw new Error("Lecture des cosplays impossible.");
  const liste = cosplays.data.map((c) => ({ id: c.id, titre: c.titre_fr }));
  return {
    etat,
    repliUrl: etat.repliFichier ? urlPhotoPublique(etat.repliFichier) : null,
    vedetteTitre: liste.find((c) => c.id === etat.produitId)?.titre ?? null,
    cosplays: liste,
    bunnyConfigure: Boolean(process.env.BUNNY_PUBLIC_LIBRARY_ID?.trim() && process.env.BUNNY_PUBLIC_API_KEY?.trim() && lireHoteCdnPublic()),
  };
}

// ---- Lecture publique du héros ----

export type VedetteHeros = {
  titre: string;
  href: string;
  photoUrl: string;
  photoAlt: string;
  prixCents: number;
  disponibilite: Disponibilite;
  // Délai de fabrication (jours) le plus court parmi les tailles sur commande ; null s'il n'y en a pas.
  delaiJours: number | null;
};

export type HerosPublic = {
  videoUrl: string | null;
  repli: { url: string; alt: string } | null;
  vedette: VedetteHeros | null;
};

// Héros de l'accueil par le client public : la RLS ne montre que les produits publiés. Aucun média inventé : sans réglage, rien. Erreur de lecture relancée.
export async function lireHerosPublic(locale: "fr" | "en", hoteCdn: string | null = lireHoteCdnPublic()): Promise<HerosPublic> {
  const client = creerClientPublic();
  const { data, error } = await client.from("heros_accueil").select(COLONNES).eq("id", true).maybeSingle();
  if (error) throw new Error("Lecture du héros impossible.");
  if (!data) return { videoUrl: null, repli: null, vedette: null };
  const etat = versEtat(data);
  const en = locale === "en";
  const repli = etat.repliFichier && etat.repliAltFr && etat.repliAltEn ? { url: urlPhotoPublique(etat.repliFichier), alt: en ? etat.repliAltEn : etat.repliAltFr } : null;

  let vedette: VedetteHeros | null = null;
  if (etat.produitId) {
    const produit = await client.from("produit").select("slug").eq("id", etat.produitId).eq("famille", "cosplay").maybeSingle();
    if (produit.error) throw new Error("Lecture du héros impossible.");
    const fiche = produit.data ? await lireFicheProduit("cosplay", produit.data.slug, locale) : null;
    if (fiche && fiche.photos[0]) {
      const { etat: disponibilite, delaiJours } = resumerDisponibilite(fiche);
      vedette = {
        titre: fiche.titre,
        href: `/cosplays/${fiche.slug}`,
        photoUrl: fiche.photos[0].url,
        photoAlt: fiche.photos[0].alt,
        prixCents: fiche.prixCents,
        disponibilite,
        delaiJours,
      };
    }
  }
  return { videoUrl: adresseVideoHeros(hoteCdn, etat.videoId, etat.videoFichier), repli, vedette };
}
