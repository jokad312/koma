import { normaliserHote } from "@/lib/bunny/config";
import type { Disponibilite, FicheProduit } from "@/modules/catalogue/types";

// Calculs purs du héros (sans accès au serveur, testés seuls).
const RANG: Record<Disponibilite, number> = { disponible: 0, dernieres_pieces: 1, sur_commande: 2, complet: 3, epuise: 4 };

export function resumerDisponibilite(fiche: Pick<FicheProduit, "tailles">): { etat: Disponibilite; delaiJours: number | null } {
  let etat: Disponibilite = "epuise";
  let delai: number | null = null;
  for (const t of fiche.tailles) {
    if (RANG[t.etat] < RANG[etat]) etat = t.etat;
    if (t.etat === "sur_commande" && t.delaiJours !== null) delai = delai === null ? t.delaiJours : Math.min(delai, t.delaiJours);
  }
  return { etat, delaiJours: etat === "sur_commande" ? delai : null };
}

// Adresse du MP4 : nom d'hôte du CDN public + vidéo + fichier validé par le serveur. Rien n'est affiché tant que le fichier n'est pas validé.
export function adresseVideoHeros(hote: string | null, videoId: string | null, fichier: string | null): string | null {
  if (!hote || !videoId || !fichier) return null;
  const h = normaliserHote(hote);
  if (!h || !/^[0-9a-f-]{36}$/i.test(videoId) || !/^play_[0-9]{3,4}p[.]mp4$/.test(fichier)) return null;
  return `https://${h}/${videoId}/${fichier}`;
}

