import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { statutAffiche } from "./pass-groupes";
import type { AnnulationPass, PassLu, StatutPass } from "./pass-types";

const STATUTS: readonly StatutPass[] = ["valide", "scanne", "annule", "rembourse"];

function un<T>(valeur: T | T[] | null): T | null {
  return Array.isArray(valeur) ? (valeur[0] ?? null) : valeur;
}

const dansLaLangue = (locale: "fr" | "en", fr: string | null, en: string | null): string | null => {
  const texte = (locale === "en" ? en?.trim() : "") || fr?.trim() || "";
  return texte === "" ? null : texte;
};

// Les Pass du Compte connecté (story 7.5), lus côté serveur par son identifiant : la jointure sur la Commande filtre par Compte acheteur,
// et chaque ligne est revérifiée ici. Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function listerMesPass(compteId: string, locale: "fr" | "en"): Promise<PassLu[]> {
  const { data, error } = await creerClientService()
    .from("pass")
    .select(
      "id, nom_titulaire, nom_a_saisir, statut, jeton, code_court, rang, cree_le, evenement:evenement_id(id, slug, titre_fr, titre_en, lieu_fr, lieu_en, debut_le, fin_le), ligne:ligne_commande_id(pass_nom_fr, pass_nom_en), commande:commande_id!inner(compte_id, offerte, statut)",
    )
    .eq("commande.compte_id", compteId)
    .order("cree_le", { ascending: true })
    .order("rang", { ascending: true });
  if (error) throw new Error("Lecture des Pass impossible.");

  const resultat: PassLu[] = [];
  for (const ligne of data ?? []) {
    const evenement = un(ligne.evenement);
    const commande = un(ligne.commande);
    const lignePass = un(ligne.ligne);
    const statut = STATUTS.find((s) => s === ligne.statut);
    if (!evenement || !commande || commande.compte_id !== compteId || !statut) continue;
    resultat.push({
      id: ligne.id,
      nomTitulaire: ligne.nom_titulaire,
      statut: statutAffiche(statut, commande.statut),
      typeNom: dansLaLangue(locale, lignePass?.pass_nom_fr ?? null, lignePass?.pass_nom_en ?? null) ?? "",
      jeton: ligne.jeton,
      codeCourt: ligne.code_court,
      offert: commande.offerte === true,
      nomASaisir: ligne.nom_a_saisir === true,
      aideNommable: ligne.nom_a_saisir === true && statut === "valide" && (evenement.debut_le === null || Date.parse(evenement.debut_le) > Date.now()),
      evenement: {
        id: evenement.id,
        slug: evenement.slug,
        titre: dansLaLangue(locale, evenement.titre_fr, evenement.titre_en) ?? evenement.titre_fr,
        debutLe: evenement.debut_le,
        finLe: evenement.fin_le,
        lieu: dansLaLangue(locale, evenement.lieu_fr, evenement.lieu_en),
      },
    });
  }
  return resultat;
}

const FRAIS = /^[0-9]{1,3}$/;
const pourcentage = (valeur: string | number | null | undefined): number | null => {
  const v = valeur === null || valeur === undefined ? "" : String(valeur);
  return FRAIS.test(v) && Number(v) <= 100 ? Number(v) : null;
};

// État d'annulation des Pass du Compte (story 7.9). « Annulable » vient de la base (pass_annulables : délai de 48 h calculé avec now(), AD-23) ;
// une lecture impossible est relancée en erreur : jamais un bouton affiché ni caché par défaut.
export async function lireAnnulationsMesPass(compteId: string): Promise<Map<string, AnnulationPass>> {
  const client = creerClientService();
  const [annulables, demandes, reglage] = await Promise.all([
    client.rpc("pass_annulables", { p_compte: compteId }),
    client
      .from("demande_client")
      .select("pass_id, statut, cree_le, commande:commande_id!inner(compte_id)")
      .eq("type", "annulation_pass")
      .eq("commande.compte_id", compteId)
      .order("cree_le", { ascending: true }),
    client.from("reglage").select("valeur").eq("cle", "frais_annulation_pass").maybeSingle(),
  ]);
  if (annulables.error || demandes.error || reglage.error) throw new Error("Lecture des annulations de Pass impossible.");
  const ids = (annulables.data ?? []).filter((x): x is string => typeof x === "string");
  const details = new Map<string, { stand: boolean; frais: number | null }>();
  if (ids.length > 0) {
    const { data, error } = await client.from("pass").select("id, ligne:ligne_commande_id(est_stand), commande:commande_id(frais_annulation_pass)").in("id", ids);
    if (error) throw new Error("Lecture des annulations de Pass impossible.");
    for (const p of data ?? []) {
      const ligne = un(p.ligne);
      const commande = un(p.commande);
      details.set(p.id, { stand: ligne?.est_stand === true, frais: pourcentage(commande?.frais_annulation_pass) ?? pourcentage(reglage.data?.valeur) });
    }
  }
  const derniere = new Map<string, "ouverte" | "refusee" | null>();
  for (const d of demandes.data ?? []) {
    if (d.pass_id) derniere.set(d.pass_id, d.statut === "ouverte" ? "ouverte" : d.statut === "refusee" ? "refusee" : null);
  }
  const resultat = new Map<string, AnnulationPass>();
  for (const id of new Set([...ids, ...derniere.keys()])) {
    const d = details.get(id);
    resultat.set(id, { possible: d !== undefined && d.frais !== null, fraisPct: d?.frais ?? null, stand: d?.stand ?? false, demande: derniere.get(id) ?? null });
  }
  return resultat;
}
