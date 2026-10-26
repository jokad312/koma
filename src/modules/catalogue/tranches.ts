import { analyserMontantUsd, PRIX_MAX_CENTS } from "@/lib/argent";
import { TRANCHES_MAX } from "./types";
import type { EntreeTranche, ErreurCatalogue, TrancheEcrite } from "./types";

// Validation d'une liste de tranches (la base revalide : AD-13). Liste vide permise : plus de tranche, donc plus de filtre de prix.
// La première erreur est rendue avec le rang de la tranche (1 à 8) et le champ fautif ; rien n'est corrigé en silence.
export function lireTranches(entree: readonly EntreeTranche[]): { ok: true; tranches: TrancheEcrite[] } | ErreurCatalogue {
  if (!Array.isArray(entree)) return { ok: false, erreur: "generique" };
  if (entree.length > TRANCHES_MAX) return { ok: false, erreur: "tranches_trop_nombreuses" };
  const tranches: TrancheEcrite[] = [];
  for (const [i, t] of entree.entries()) {
    const ligne = i + 1;
    if (!t || typeof t !== "object") return { ok: false, erreur: "generique" };
    const libelleFr = String(t.libelleFr ?? "").trim();
    const libelleEn = String(t.libelleEn ?? "").trim();
    if (libelleFr.length < 1 || libelleFr.length > 40) return { ok: false, erreur: "tranche_libelle_invalide", ligne, champTranche: "libelle_fr" };
    if (libelleEn.length < 1 || libelleEn.length > 40) return { ok: false, erreur: "tranche_libelle_invalide", ligne, champTranche: "libelle_en" };
    const bas = analyserMontantUsd(String(t.bas ?? ""), PRIX_MAX_CENTS);
    if (!bas.ok) return { ok: false, erreur: "tranche_bornes_invalides", ligne, champTranche: "bas" };
    const hautTexte = String(t.haut ?? "");
    let haut: number | null = null;
    if (hautTexte.trim() !== "") {
      const analyse = analyserMontantUsd(hautTexte, PRIX_MAX_CENTS);
      if (!analyse.ok || analyse.cents <= bas.cents) return { ok: false, erreur: "tranche_bornes_invalides", ligne, champTranche: "haut" };
      haut = analyse.cents;
    }
    tranches.push({ libelle_fr: libelleFr, libelle_en: libelleEn, bas_cents: bas.cents, haut_cents: haut });
  }
  return { ok: true, tranches };
}
