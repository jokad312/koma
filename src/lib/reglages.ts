import { cacheTag } from "next/cache";
import { FORFAIT_MAX_CENTS } from "@/lib/argent";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientPublic } from "@/lib/supabase/public";

type ClientReglage = {
  from: (table: "reglage") => {
    select: (colonnes: "valeur") => {
      eq: (colonne: "cle", valeur: string) => {
        maybeSingle: () => PromiseLike<{ data: { valeur: string | null } | null; error: { message: string } | null }>;
      };
    };
  };
};

export class ReglageManquantError extends Error {
  readonly code = "KS_REGLAGE_MANQUANT";
  constructor(cle: string) {
    super(`KS_REGLAGE_MANQUANT : le réglage « ${cle} » est absent ou vide.`);
  }
}

// Lecture d'un réglage public ; aucune valeur de repli (règle 15).
export async function lireReglagePublic(client: ClientReglage, cle: string): Promise<string> {
  const { data, error } = await client.from("reglage").select("valeur").eq("cle", cle).maybeSingle();
  if (error) throw new Error(`Lecture du réglage « ${cle} » impossible : ${error.message}`);
  const valeur = data?.valeur?.trim();
  if (!valeur) throw new ReglageManquantError(cle);
  return valeur;
}

// Numéro WhatsApp (public depuis la 1.8) : null si le réglage est absent ou vide, sans valeur de repli. Une erreur de lecture est relancée.
export async function lireNumeroWhatsapp(): Promise<string | null> {
  "use cache";
  cacheTag(ETIQUETTES.reglages);
  try {
    return await lireReglagePublic(creerClientPublic() as unknown as ClientReglage, "numero_whatsapp");
  } catch (e) {
    if (e instanceof ReglageManquantError) return null;
    throw e;
  }
}

// Numéro facultatif : une erreur de lecture ne doit pas faire tomber les pages publiques. Lien masqué, cause journalisée, jamais de numéro de repli.
export async function lireNumeroWhatsappOuNull(): Promise<string | null> {
  try {
    return await lireNumeroWhatsapp();
  } catch {
    console.error("[reglages] lecture du numéro WhatsApp impossible : lien masqué");
    return null;
  }
}

// Nom du site : seule source (réglage nom_site), mis en cache avec l'étiquette `reglages`.
export async function lireNomSite(): Promise<string> {
  "use cache";
  cacheTag(ETIQUETTES.reglages);
  return lireReglagePublic(creerClientPublic() as unknown as ClientReglage, "nom_site");
}

// Forfait de livraison d'une ville, en centimes USD : null si jamais fixé (aucune valeur de repli, aucun forfait inventé).
export async function lireForfaitLivraison(ville: "goma" | "bukavu"): Promise<number | null> {
  "use cache";
  cacheTag(ETIQUETTES.reglages);
  try {
    const brut = await lireReglagePublic(creerClientPublic() as unknown as ClientReglage, `forfait_livraison_${ville}_cents`);
    const cents = /^[0-9]{1,6}$/.test(brut) ? Number(brut) : Number.NaN;
    return Number.isInteger(cents) && cents <= FORFAIT_MAX_CENTS ? cents : null;
  } catch (e) {
    if (e instanceof ReglageManquantError) return null;
    throw e;
  }
}

// Lieu de retrait gratuit à Goma, dans la langue demandée : null si jamais saisi, sans texte de repli.
export async function lireRetraitGoma(langue: "fr" | "en"): Promise<string | null> {
  "use cache";
  cacheTag(ETIQUETTES.reglages);
  try {
    return await lireReglagePublic(creerClientPublic() as unknown as ClientReglage, `retrait_goma_${langue}`);
  } catch (e) {
    if (e instanceof ReglageManquantError) return null;
    throw e;
  }
}
