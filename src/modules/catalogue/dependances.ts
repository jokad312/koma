import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE, BUCKET_KITS, BUCKET_PUBLIC } from "@/lib/supabase/stockage";
import { lireConfigBunnyPrive, lireConfigBunnyPublic } from "@/lib/bunny/config";
import { lireFamilleProduit, lireFichierKit, lireProduitPourPublication, lireVideoKitService, premierSlugLibre } from "./queries";
import type { DependancesCatalogue, DependancesMediasKit } from "./types";

// Lit l'existence, la taille réelle et les premiers octets d'un objet de kits-private (fichiers et sous-titres des Kits).
async function lireObjetKit(admin: ReturnType<typeof creerClientService>, { objet, octets }: { objet: string; octets: number }) {
  const vide = new Uint8Array(0);
  const stockage = admin.storage.from(BUCKET_KITS);
  // Existence et taille réelle : métadonnées de l'objet, sans le télécharger.
  const info = await stockage.info(objet);
  if (info.error) {
    const statut = (info.error as { status?: number; statusCode?: string | number }).status ?? Number((info.error as { statusCode?: string | number }).statusCode);
    if (statut === 404 || /not.?found/i.test(info.error.message)) return { erreur: null, trouve: false, taille: 0, debut: vide };
    return { erreur: info.error.message, trouve: false, taille: 0, debut: vide };
  }
  const taille = info.data?.size;
  if (typeof taille !== "number") return { erreur: "taille de l'objet inconnue", trouve: false, taille: 0, debut: vide };
  const aLire = Math.min(octets, taille);
  if (aLire < 1) return { erreur: null, trouve: true, taille, debut: vide };
  // Seul le début est lu (requête d'intervalle sur un lien signé de 60 secondes) : jamais un fichier de 50 Mo en mémoire.
  const signe = await stockage.createSignedUrl(objet, 60);
  if (signe.error || !signe.data) return { erreur: signe.error ? signe.error.message : "lien signé absent", trouve: true, taille, debut: vide };
  // Délai maximal de 15 s : une lecture bloquée ne retient jamais la requête.
  let reponse: Response;
  try {
    reponse = await fetch(signe.data.signedUrl, { headers: { Range: `bytes=0-${aLire - 1}` }, signal: AbortSignal.timeout(15_000) });
  } catch {
    return { erreur: "lecture de l'objet : délai dépassé ou réseau coupé", trouve: true, taille, debut: vide };
  }
  if (!reponse.ok || !reponse.body) return { erreur: `lecture de l'objet : statut ${reponse.status}`, trouve: true, taille, debut: vide };
  const lecteur = reponse.body.getReader();
  const morceaux: Uint8Array[] = [];
  let recu = 0;
  while (recu < aLire) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
    recu += value.byteLength;
  }
  await lecteur.cancel().catch(() => {});
  const debut = new Uint8Array(Math.min(recu, aLire));
  let position = 0;
  for (const m of morceaux) {
    const part = m.subarray(0, Math.max(0, debut.length - position));
    debut.set(part, position);
    position += part.length;
  }
  return { erreur: null, trouve: true, taille, debut };
}

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
// L'étiquette « catalogue » est vidée par updateTag à la publication et à la dépublication (le catalogue public arrive en 2.4 et 2.5).
export function dependances(): DependancesCatalogue {
  const admin = creerClientService();
  return {
    exigerDroit,
    ecrireUnivers: async ({ auteur, nomFr, nomEn }) => {
      const { data, error } = await admin.rpc("creer_univers", { p_auteur: auteur as never, p_nom_fr: nomFr, p_nom_en: nomEn });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    ecrireProduit: async ({ auteur, id, produit, variantes }) => {
      const { data, error } = await admin.rpc("enregistrer_produit", {
        p_auteur: auteur as never,
        p_id: (id ?? null) as never,
        p_produit: produit as never,
        p_variantes: variantes as never,
      });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    premierSlugLibre,
    signerEnvoiPhoto: async ({ objet }) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).createSignedUploadUrl(objet);
      return { erreur: error ? error.message : null, jeton: data?.token ?? null };
    },
    lireObjetAttente: async (objet) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).download(objet);
      if (error || !data) return { erreur: error ? error.message : "objet absent", octets: null };
      return { erreur: null, octets: new Uint8Array(await data.arrayBuffer()) };
    },
    ecrireObjetPublic: async ({ objet, octets, contentType }) => {
      const { error } = await admin.storage.from(BUCKET_PUBLIC).upload(objet, octets, { contentType, upsert: false, cacheControl: "31536000" });
      return { erreur: error ? error.message : null };
    },
    supprimerObjets: async ({ bucket, objets }) => {
      const { error } = await admin.storage.from(bucket).remove(objets);
      return { erreur: error ? error.message : null };
    },
    ecrirePhoto: async ({ auteur, produitId, fichier, altFr, altEn }) => {
      const { data, error } = await admin.rpc("ajouter_photo_produit", {
        p_auteur: auteur as never,
        p_produit_id: produitId,
        p_fichier: fichier,
        p_alt_fr: altFr,
        p_alt_en: altEn,
      });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    deplacerPhoto: async ({ auteur, photoId, sens }) => {
      const { error } = await admin.rpc("deplacer_photo_produit", { p_auteur: auteur as never, p_photo_id: photoId, p_sens: sens });
      return { erreur: error ? error.message : null };
    },
    supprimerPhoto: async ({ auteur, photoId }) => {
      const { data, error } = await admin.rpc("supprimer_photo_produit", { p_auteur: auteur as never, p_photo_id: photoId });
      return { erreur: error ? error.message : null, fichier: typeof data === "string" ? data : null };
    },
    modifierAltPhoto: async ({ auteur, photoId, altFr, altEn }) => {
      const { error } = await admin.rpc("modifier_alt_photo", { p_auteur: auteur as never, p_photo_id: photoId, p_alt_fr: altFr, p_alt_en: altEn });
      return { erreur: error ? error.message : null };
    },
    changerPublication: async ({ auteur, id, publier }) => {
      const { error } = publier
        ? await admin.rpc("publier_produit", { p_auteur: auteur as never, p_id: id })
        : await admin.rpc("depublier_produit", { p_auteur: auteur as never, p_id: id });
      return { erreur: error ? error.message : null };
    },
    ecrireTranches: async ({ auteur, tranches }) => {
      const { error } = await admin.rpc("enregistrer_tranches_prix", { p_auteur: auteur as never, p_tranches: tranches as never });
      return { erreur: error ? error.message : null };
    },
    invaliderReglages: async () => {
      updateTag(ETIQUETTES.reglages);
    },
    invaliderCatalogue: async () => {
      updateTag(ETIQUETTES.catalogue);
    },
    lireProduitComplet: lireProduitPourPublication,
    ecrireKit: async ({ auteur, id, kit }) => {
      const { data, error } = await admin.rpc("enregistrer_kit", { p_auteur: auteur as never, p_id: (id ?? null) as never, p_kit: kit as never });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    lireFamilleProduit,
    lireFichierKit,
    cheminKitEnregistre: async (chemin) => {
      const { data, error } = await admin.from("fichier_kit_prive").select("fichier_id").eq("chemin_stockage", chemin).maybeSingle();
      if (error) throw new Error("Lecture des chemins impossible.");
      return data !== null;
    },
    deplacerObjetKit: async ({ de, vers }) => {
      const { error } = await admin.storage.from(BUCKET_KITS).move(de, vers);
      return { erreur: error ? error.message : null };
    },
    signerEnvoiFichierKit: async ({ objet }) => {
      const { data, error } = await admin.storage.from(BUCKET_KITS).createSignedUploadUrl(objet);
      return { erreur: error ? error.message : null, jeton: data?.token ?? null };
    },
    lireObjetKit: (args) => lireObjetKit(admin, args),
    ecrireFichierKit: async ({ auteur, produitId, nomFr, nomEn, format, taille, chemin }) => {
      const { data, error } = await admin.rpc("ajouter_fichier_kit", {
        p_auteur: auteur as never,
        p_produit_id: produitId,
        p_nom_fr: nomFr,
        p_nom_en: nomEn,
        p_format: format,
        p_taille: taille,
        p_chemin: chemin,
      });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    remplacerFichierKit: async ({ auteur, fichierId, taille, chemin }) => {
      const { data, error } = await admin.rpc("remplacer_fichier_kit", { p_auteur: auteur as never, p_fichier_id: fichierId, p_taille: taille, p_chemin: chemin });
      return { erreur: error ? error.message : null, ancienChemin: typeof data === "string" ? data : null };
    },
    supprimerFichierKit: async ({ auteur, fichierId }) => {
      const { data, error } = await admin.rpc("supprimer_fichier_kit", { p_auteur: auteur as never, p_fichier_id: fichierId });
      return { erreur: error ? error.message : null, chemin: typeof data === "string" ? data : null };
    },
  };
}

// Vidéo, chapitres et sous-titres d'un Kit (story 3.2) : vrais clients (base, stockage kits-private, API Bunny côté serveur).
export function dependancesMediasKit(): DependancesMediasKit {
  const admin = creerClientService();
  return {
    exigerDroit,
    configBunnyPrive: () => lireConfigBunnyPrive(),
    configBunnyPublic: () => lireConfigBunnyPublic(),
    reseau: fetch,
    maintenant: () => Date.now(),
    lireFamilleProduit,
    lireVideoKit: lireVideoKitService,
    ecrireVideoKit: async ({ auteur, produitId, bunnyId, duree }) => {
      const { data, error } = await admin.rpc("enregistrer_video_kit", { p_auteur: auteur as never, p_produit_id: produitId, p_bunny_id: bunnyId, p_duree: duree });
      return { erreur: error ? error.message : null, ancien: typeof data === "string" ? data : null };
    },
    supprimerVideoKit: async ({ auteur, produitId }) => {
      const { data, error } = await admin.rpc("supprimer_video_kit", { p_auteur: auteur as never, p_produit_id: produitId });
      const o = (data ?? null) as { prive?: unknown; extrait?: unknown } | null;
      return {
        erreur: error ? error.message : null,
        prive: typeof o?.prive === "string" ? o.prive : null,
        extrait: typeof o?.extrait === "string" ? o.extrait : null,
      };
    },
    ecrireExtraitKit: async ({ auteur, produitId, extraitId }) => {
      const { data, error } = await admin.rpc("enregistrer_extrait_kit", { p_auteur: auteur as never, p_produit_id: produitId, p_extrait: (extraitId ?? null) as never });
      return { erreur: error ? error.message : null, ancien: typeof data === "string" ? data : null };
    },
    ajouterChapitre: async ({ auteur, produitId, titreFr, titreEn, debut }) => {
      const { data, error } = await admin.rpc("ajouter_chapitre_kit", { p_auteur: auteur as never, p_produit_id: produitId, p_titre_fr: titreFr, p_titre_en: titreEn, p_debut: debut });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    modifierChapitre: async ({ auteur, chapitreId, titreFr, titreEn, debut }) => {
      const { error } = await admin.rpc("modifier_chapitre_kit", { p_auteur: auteur as never, p_chapitre_id: chapitreId, p_titre_fr: titreFr, p_titre_en: titreEn, p_debut: debut });
      return { erreur: error ? error.message : null };
    },
    deplacerChapitre: async ({ auteur, chapitreId, sens }) => {
      const { error } = await admin.rpc("deplacer_chapitre_kit", { p_auteur: auteur as never, p_chapitre_id: chapitreId, p_sens: sens });
      return { erreur: error ? error.message : null };
    },
    supprimerChapitre: async ({ auteur, chapitreId }) => {
      const { error } = await admin.rpc("supprimer_chapitre_kit", { p_auteur: auteur as never, p_chapitre_id: chapitreId });
      return { erreur: error ? error.message : null };
    },
    signerEnvoiSousTitres: async ({ objet }) => {
      const { data, error } = await admin.storage.from(BUCKET_KITS).createSignedUploadUrl(objet);
      return { erreur: error ? error.message : null, jeton: data?.token ?? null };
    },
    cheminSousTitresEnregistre: async (chemin) => {
      const { data, error } = await admin.from("sous_titre_kit_prive").select("sous_titre_id").eq("chemin_stockage", chemin).maybeSingle();
      if (error) throw new Error("Lecture des chemins impossible.");
      return data !== null;
    },
    lireObjetKit: (args) => lireObjetKit(admin, args),
    deplacerObjetKit: async ({ de, vers }) => {
      const { error } = await admin.storage.from(BUCKET_KITS).move(de, vers);
      return { erreur: error ? error.message : null };
    },
    ecrireSousTitres: async ({ auteur, produitId, langue, taille, chemin }) => {
      const { data, error } = await admin.rpc("enregistrer_sous_titre_kit", {
        p_auteur: auteur as never,
        p_produit_id: produitId,
        p_langue: langue,
        p_taille: taille,
        p_chemin: chemin,
      });
      return { erreur: error ? error.message : null, ancienChemin: typeof data === "string" ? data : null };
    },
    supprimerSousTitres: async ({ auteur, produitId, langue }) => {
      const { data, error } = await admin.rpc("supprimer_sous_titre_kit", { p_auteur: auteur as never, p_produit_id: produitId, p_langue: langue });
      return { erreur: error ? error.message : null, chemin: typeof data === "string" ? data : null };
    },
    supprimerObjetsKit: async (objets) => {
      const { error } = await admin.storage.from(BUCKET_KITS).remove(objets);
      return { erreur: error ? error.message : null };
    },
    ecrireSousTitresExtrait: async ({ auteur, produitId, langue }) => {
      const { error } = await admin.rpc("enregistrer_sous_titres_extrait_kit", { p_auteur: auteur as never, p_produit_id: produitId, p_langue: langue });
      return { erreur: error ? error.message : null };
    },
    supprimerSousTitresExtrait: async ({ auteur, produitId, langue }) => {
      const { error } = await admin.rpc("supprimer_sous_titres_extrait_kit", { p_auteur: auteur as never, p_produit_id: produitId, p_langue: langue });
      return { erreur: error ? error.message : null };
    },
    definirExtraitSansParole: async ({ auteur, produitId, valeur }) => {
      const { error } = await admin.rpc("definir_extrait_sans_parole", { p_auteur: auteur as never, p_produit_id: produitId, p_valeur: valeur });
      return { erreur: error ? error.message : null };
    },
    invaliderCatalogue: async () => {
      updateTag(ETIQUETTES.catalogue);
    },
  };
}
