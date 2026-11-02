import "server-only";
import { Resend } from "resend";
import { lireEnvPublique } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import { rendreCommandePayee } from "./modeles/commande-payee";
import { rendreKitOuvert } from "./modeles/kit-ouvert";
import type { DependancesEnvois, EnvoiReserve, LangueEmail, ResultatRendu } from "./types";

type ClientService = ReturnType<typeof creerClientService>;

const STATUTS_PAYES = ["payee", "en_fabrication", "expediee", "livree"];
const STATUTS_KIT = ["offerte", "livree", "payee"];

const titreSelonLangue = (p: { titre_fr: string; titre_en: string | null }, langue: LangueEmail) => (langue === "en" && p.titre_en ? p.titre_en : p.titre_fr);

// Relit la base au moment du rendu : l'envoi ne porte que des identifiants. Un contenu qui ne correspond plus au Compte
// ou à l'état de la Commande n'est jamais envoyé (« ignorer »).
async function rendre(client: ClientService, envoi: EnvoiReserve): Promise<ResultatRendu> {
  const { data: utilisateur, error: erreurCompte } = await client.auth.admin.getUserById(envoi.compteId);
  if (erreurCompte && erreurCompte.status !== 404) return { statut: "reessayer", raison: "lecture du Compte impossible" };
  const destinataire = utilisateur?.user?.email;
  if (!destinataire) return { statut: "ignorer", raison: "Compte sans adresse email" };

  // Nom du site lu sans cache, au moment du rendu (réglage nom_site, jamais de valeur de repli : règle 15).
  const { data: reglage, error: erreurNom } = await client.from("reglage").select("valeur").eq("cle", "nom_site").maybeSingle();
  const nomSite = reglage?.valeur?.trim();
  if (erreurNom || !nomSite) return { statut: "reessayer", raison: "nom du site illisible" };
  const site = lireEnvPublique().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");

  const commandeId = envoi.donnees.commande_id;
  if (!commandeId) return { statut: "ignorer", raison: "commande non indiquée" };
  const { data: commande, error: erreurCommande } = await client
    .from("commande")
    .select("id, numero, compte_id, statut, total_cents, forfait_cents")
    .eq("id", commandeId)
    .maybeSingle();
  if (erreurCommande) return { statut: "reessayer", raison: "lecture de la Commande impossible" };
  if (!commande || commande.compte_id !== envoi.compteId) return { statut: "ignorer", raison: "commande introuvable pour ce Compte" };

  if (envoi.modele === "commande_payee") {
    // Jamais « paiement reçu » pour une Commande qui n'est pas payée (règle 2).
    if (!STATUTS_PAYES.includes(commande.statut)) return { statut: "ignorer", raison: "commande non payée" };
    const { data: lignes, error } = await client
      .from("ligne_commande")
      .select("nombre, prix_cents, produit:produit_id(titre_fr, titre_en)")
      .eq("commande_id", commande.id)
      .order("cree_le", { ascending: true });
    if (error) return { statut: "reessayer", raison: "lecture des lignes impossible" };
    if (!lignes || lignes.length === 0) return { statut: "ignorer", raison: "commande sans ligne" };
    const message = rendreCommandePayee(envoi.langue, {
      nomSite,
      numero: commande.numero,
      lignes: lignes.map((l) => ({ titre: l.produit ? titreSelonLangue(l.produit, envoi.langue) : "—", nombre: l.nombre, prixCents: l.prix_cents })),
      livraisonCents: commande.forfait_cents,
      totalCents: commande.total_cents,
      url: `${site}/${envoi.langue}/commande/${encodeURIComponent(commande.numero)}`,
    });
    return { statut: "pret", destinataire, message };
  }

  if (envoi.modele === "kit_ouvert") {
    const produitId = envoi.donnees.produit_id;
    if (!produitId || !STATUTS_KIT.includes(commande.statut)) return { statut: "ignorer", raison: "Kit non indiqué ou commande non ouverte" };
    const [acces, produit] = await Promise.all([
      client.from("acces_kit").select("id").eq("compte_id", envoi.compteId).eq("produit_id", produitId).maybeSingle(),
      client.from("produit").select("slug, titre_fr, titre_en").eq("id", produitId).maybeSingle(),
    ]);
    if (acces.error || produit.error) return { statut: "reessayer", raison: "lecture du Kit impossible" };
    if (!acces.data || !produit.data) return { statut: "ignorer", raison: "accès au Kit introuvable" };
    const message = rendreKitOuvert(envoi.langue, {
      nomSite,
      numero: commande.numero,
      titreKit: titreSelonLangue(produit.data, envoi.langue),
      url: `${site}/${envoi.langue}/kits/${encodeURIComponent(produit.data.slug)}`,
    });
    return { statut: "pret", destinataire, message };
  }

  return { statut: "ignorer", raison: "modèle inconnu" };
}

// Dépendances réelles du worker. Resend : la clé et l'expéditeur viennent de l'environnement ; la clé d'idempotence
// de Resend est l'identifiant de l'envoi (un renvoi après une panne ne crée pas un second email).
export function creerDependancesEnvois(config: { cleResend: string; expediteur: string }): DependancesEnvois {
  const client = creerClientService();
  const resend = new Resend(config.cleResend);
  return {
    reserverLot: async (limite) => {
      const { data, error } = await client.rpc("envois_reserver_lot", { p_limite: limite });
      if (error) return { erreur: error.message, envois: [] };
      return {
        erreur: null,
        envois: (data ?? []).map((e) => ({
          id: e.id,
          modele: e.modele,
          compteId: e.compte_id,
          langue: e.langue === "en" ? "en" : "fr",
          donnees: (e.donnees ?? {}) as Record<string, string>,
          tentatives: e.tentatives,
        })),
      };
    },
    rendre: (envoi) => rendre(client, envoi),
    envoyer: async ({ envoiId, destinataire, message }) => {
      const { data, error } = await resend.emails.send(
        { from: config.expediteur, to: destinataire, subject: message.sujet, html: message.html, text: message.texte },
        { idempotencyKey: `koma-envoi-${envoiId}` },
      );
      // Jamais l'adresse ni le contenu dans l'erreur gardée.
      if (error) return { erreur: `Resend ${error.name}`.slice(0, 120), idPrestataire: null };
      return { erreur: null, idPrestataire: data?.id ?? null };
    },
    marquerEnvoye: async (envoiId, idPrestataire) => {
      const { error } = await client.rpc("envois_marquer_envoye", { p_id: envoiId, p_id_prestataire: idPrestataire });
      return { erreur: error ? error.message : null };
    },
    marquerEchec: async (envoiId, erreur) => {
      const { error } = await client.rpc("envois_marquer_echec", { p_id: envoiId, p_erreur: erreur });
      return { erreur: error ? error.message : null };
    },
    ignorer: async (envoiId, raison) => {
      const { error } = await client.rpc("envois_ignorer", { p_id: envoiId, p_raison: raison });
      return { erreur: error ? error.message : null };
    },
  };
}
