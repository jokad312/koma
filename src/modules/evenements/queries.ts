import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { lireImages } from "./images";
import type { Evenement, EvenementListe, LieuType, TypePass } from "./types";

// Liste admin : les plus récents d'abord. Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function lireEvenementsAdmin(): Promise<EvenementListe[]> {
  const { data, error } = await creerClientService()
    .from("evenement")
    .select("id, titre_fr, debut_le, publie_le, modifie_le")
    .order("modifie_le", { ascending: false });
  if (error) throw new Error("Lecture des événements impossible.");
  return (data ?? []).map((e) => ({ id: e.id, titreFr: e.titre_fr, debutLe: e.debut_le, publieLe: e.publie_le, modifieLe: e.modifie_le }));
}

// Un Événement avec ses Types de pass dans l'ordre saisi ; null s'il n'existe pas.
export async function lireEvenementAdmin(id: string): Promise<Evenement | null> {
  const client = creerClientService();
  const { data, error } = await client.from("evenement").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Lecture de l'événement impossible.");
  if (!data) return null;
  const { data: lignes, error: erreurTypes } = await client.from("type_pass").select("*").eq("evenement_id", id).order("ordre", { ascending: true });
  if (erreurTypes) throw new Error("Lecture des Types de pass impossible.");
  const types: TypePass[] = (lignes ?? []).map((t) => ({
    id: t.id,
    nomFr: t.nom_fr,
    nomEn: t.nom_en,
    prixCents: t.prix_cents,
    quota: t.quota,
    inclusFr: t.inclus_fr,
    inclusEn: t.inclus_en,
    estStand: t.est_stand,
  }));
  return {
    id: data.id,
    titreFr: data.titre_fr,
    titreEn: data.titre_en,
    slug: data.slug,
    descriptionFr: data.description_fr,
    descriptionEn: data.description_en,
    lieuType: data.lieu_type === "salle" || data.lieu_type === "plein_air" ? (data.lieu_type as LieuType) : null,
    lieuFr: data.lieu_fr,
    lieuEn: data.lieu_en,
    debutLe: data.debut_le,
    finLe: data.fin_le,
    capacite: data.capacite,
    venteOuvreLe: data.vente_ouvre_le,
    venteFermeLe: data.vente_ferme_le,
    images: lireImages(data.images),
    publieLe: data.publie_le,
    modifieLe: data.modifie_le,
    types,
  };
}

// Ce qui manque pour publier (codes de manques_publication_evenement) ; liste vide = publiable.
export async function lireManquesPublication(id: string): Promise<string[]> {
  const { data, error } = await creerClientService().rpc("manques_publication_evenement", { p_id: id });
  if (error) throw new Error("Lecture des manques impossible.");
  return Array.isArray(data) ? data.filter((m): m is string => typeof m === "string") : [];
}
