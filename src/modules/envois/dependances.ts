import "server-only";
import { Resend } from "resend";
import { lireEnvPublique } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import { rendreCommandePayee } from "./modeles/commande-payee";
import { TEXTES } from "./modeles/commun";
import { rendreKitOuvert } from "./modeles/kit-ouvert";
import { rendrePassEmis } from "./modeles/pass-emis";
import { rendrePassAnnule, rendrePassRembourse } from "./modeles/pass-statut";
import { rendreGalerieEvenement } from "./modeles/galerie-evenement";
import { rendreCommandeAnnulee, rendreCommandeEnFabrication, rendreCommandeExpediee, rendreCommandeLivree, rendreCommandeRemboursee } from "./modeles/statut-commande";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";
import { cheminPublic } from "@/i18n/adresses";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { lienDesinscription, lienDesinscriptionUnClic } from "@/modules/preferences/lien-desinscription";
import { rendreNouveauProduit, rendrePanierAbandonne, rendreRappelKit } from "./modeles/commerciaux";
import { rendreAlerte } from "@/modules/alertes/rendu";
import { MODELES_COMMERCIAUX } from "./types";
import type { DependancesEnvois, EnvoiLie, EnvoiReserve, LangueEmail, ResultatRendu } from "./types";

type ClientService = ReturnType<typeof creerClientService>;

const STATUTS_PAYES = ["payee", "en_fabrication", "expediee", "livree"];
const STATUTS_KIT = ["offerte", "livree", "payee"];

const titreSelonLangue = (p: { titre_fr: string; titre_en: string | null }, langue: LangueEmail) => (langue === "en" && p.titre_en ? p.titre_en : p.titre_fr);

// Emails commerciaux ciblés (story 9.6) : jamais envoyés si leur sujet n'est plus vrai (Panier vidé ou payé, Kit terminé, Produit dépublié).
const MODELES_CIBLES = ["panier_abandonne", "rappel_kit", "nouveau_produit"] as const;

async function rendreCommercial(client: ClientService, envoi: EnvoiLie, destinataire: string, nomSite: string, site: string): Promise<ResultatRendu> {
  const langue = envoi.langue;
  // Lien signé de désinscription, obligatoire dans tout Email commercial : sans clé configurée, l'email n'est jamais envoyé sans lui.
  let lien: string;
  let entetes: Record<string, string>;
  try {
    lien = lienDesinscription(envoi.compteId, langue);
    // Désinscription en un clic des messageries (RFC 8058) : POST signé vers /api/desinscription, jamais un GET.
    entetes = { "List-Unsubscribe": `<${lienDesinscriptionUnClic(envoi.compteId)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  } catch {
    return { statut: "reessayer", raison: "lien de désinscription indisponible" };
  }
  const commun = { nomSite, lienDesinscription: lien };

  if (envoi.modele === "panier_abandonne") {
    const panierId = envoi.donnees.panier_id;
    if (!panierId) return { statut: "ignorer", raison: "panier non indiqué" };
    const { data: panier, error } = await client.from("panier").select("compte_id, ligne_panier(id)").eq("id", panierId).maybeSingle();
    if (error) return { statut: "reessayer", raison: "lecture du panier impossible" };
    if (!panier || panier.compte_id !== envoi.compteId) return { statut: "ignorer", raison: "panier introuvable pour ce Compte" };
    if ((panier.ligne_panier ?? []).length === 0) return { statut: "ignorer", raison: "panier vide ou payé" };
    return { statut: "pret", destinataire, message: { ...rendrePanierAbandonne(langue, { ...commun, url: `${site}/${langue}${cheminPublic(langue, "/panier")}` }), entetes } };
  }

  const produitId = envoi.donnees.produit_id;
  if (!produitId) return { statut: "ignorer", raison: "produit non indiqué" };
  const { data: produit, error: erreurProduit } = await client
    .from("produit")
    .select("id, slug, famille, titre_fr, titre_en, publie_le, univers:univers_id(nom_fr, nom_en)")
    .eq("id", produitId)
    .maybeSingle();
  if (erreurProduit) return { statut: "reessayer", raison: "lecture du produit impossible" };
  if (!produit) return { statut: "ignorer", raison: "produit introuvable" };
  const titre = titreSelonLangue(produit, langue);

  if (envoi.modele === "rappel_kit") {
    if (produit.famille !== "kit") return { statut: "ignorer", raison: "produit qui n'est pas un kit" };
    const { data: acces, error: erreurAcces } = await client.from("acces_kit").select("id").eq("compte_id", envoi.compteId).eq("produit_id", produitId).maybeSingle();
    if (erreurAcces) return { statut: "reessayer", raison: "lecture de l'accès impossible" };
    if (!acces) return { statut: "ignorer", raison: "kit sans accès" };
    const { data: progression, error } = await client
      .from("progression_video")
      .select("position_secondes, max_position_secondes, terminee_le")
      .eq("compte_id", envoi.compteId)
      .eq("produit_id", produitId)
      .maybeSingle();
    if (error) return { statut: "reessayer", raison: "lecture de la progression impossible" };
    if (progression?.terminee_le) return { statut: "ignorer", raison: "kit terminé" };
    let chapitre: number | null = null;
    if (progression && progression.max_position_secondes > 0) {
      // Chapitre en cours : nombre de chapitres commencés avant la dernière position connue (au moins le premier).
      const { count, error: erreurChapitres } = await client
        .from("chapitre_kit")
        .select("id", { count: "exact", head: true })
        .eq("produit_id", produitId)
        .lte("debut_secondes", progression.position_secondes);
      if (erreurChapitres) return { statut: "reessayer", raison: "lecture des chapitres impossible" };
      chapitre = Math.max(1, count ?? 1);
    }
    const url = `${site}/${langue}/compte/bibliotheque/${encodeURIComponent(produit.slug)}`;
    return { statut: "pret", destinataire, message: { ...rendreRappelKit(langue, { ...commun, url, kit: titre, chapitre }), entetes } };
  }

  if (envoi.modele === "nouveau_produit") {
    if (!produit.publie_le || Date.parse(produit.publie_le) > Date.now()) return { statut: "ignorer", raison: "produit non publié" };
    const univers = Array.isArray(produit.univers) ? produit.univers[0] : produit.univers;
    if (!univers) return { statut: "ignorer", raison: "produit sans univers" };
    const dossier = produit.famille === "kit" ? "/kits" : produit.famille === "accessoire" ? "/accessoires" : "/cosplays";
    const url = `${site}/${langue}${cheminPublic(langue, dossier)}/${encodeURIComponent(produit.slug)}`;
    const nomUnivers = langue === "en" ? univers.nom_en : univers.nom_fr;
    return { statut: "pret", destinataire, message: { ...rendreNouveauProduit(langue, { ...commun, url, produit: titre, univers: nomUnivers }), entetes } };
  }

  return { statut: "ignorer", raison: "modèle sans gabarit" };
}

// Relit la base au moment du rendu : l'envoi ne porte que des identifiants. Un contenu qui ne correspond plus au Compte
// ou à l'état de la Commande n'est jamais envoyé (« ignorer »).
async function rendre(client: ClientService, brut: EnvoiReserve): Promise<ResultatRendu> {
  // Alerte « Me prévenir » (story 7.3) : l'inscrit par email n'a pas de Compte ; son rendu lit sa propre inscription.
  if (brut.modele === "alerte_evenement") return rendreAlerte(client, brut);
  if (brut.compteId === null) return { statut: "ignorer", raison: "envoi sans Compte" };
  const envoi: EnvoiLie = { ...brut, compteId: brut.compteId };
  const { data: utilisateur, error: erreurCompte } = await client.auth.admin.getUserById(envoi.compteId);
  if (erreurCompte && erreurCompte.status !== 404) return { statut: "reessayer", raison: "lecture du Compte impossible" };
  const destinataire = utilisateur?.user?.email;
  if (!destinataire) return { statut: "ignorer", raison: "Compte sans adresse email" };

  // Nom du site lu sans cache, au moment du rendu (réglage nom_site, jamais de valeur de repli : règle 15).
  const { data: reglage, error: erreurNom } = await client.from("reglage").select("valeur").eq("cle", "nom_site").maybeSingle();
  const nomSite = reglage?.valeur?.trim();
  if (erreurNom || !nomSite) return { statut: "reessayer", raison: "nom du site illisible" };
  const site = lireEnvPublique().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");

  // Emails commerciaux ciblés (story 9.6) : pas de Commande ; le rendu relit le Panier, le Kit ou le Produit au moment de l'envoi.
  if ((MODELES_CIBLES as readonly string[]).includes(envoi.modele)) return rendreCommercial(client, envoi, destinataire, nomSite, site);
  // Autre Email commercial (relance 9.5) : pas encore de gabarit, jamais rendu par erreur comme une Commande.
  if ((MODELES_COMMERCIAUX as readonly string[]).includes(envoi.modele)) return { statut: "ignorer", raison: "modèle sans gabarit" };

  // Galerie d'événement (story 7.10) : pas de Commande ; le rendu relit l'Événement, son lien et le Pass du Compte. Jamais envoyé si l'Événement n'est
  // pas publié ni terminé, si le lien a été effacé ou si le Compte ne garde plus de Pass valide ou scanné.
  if (envoi.modele === "galerie_evenement") {
    const evenementId = envoi.donnees.evenement_id;
    if (!evenementId) return { statut: "ignorer", raison: "Événement non indiqué" };
    const { data, error } = await client.rpc("galerie_evenement_pour_envoi", { p_evenement: evenementId, p_compte: envoi.compteId });
    if (error) return { statut: "reessayer", raison: "lecture de l'Événement impossible" };
    const e = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
    if (!e) return { statut: "ignorer", raison: "Événement introuvable" };
    if (e.publie !== true || e.termine !== true) return { statut: "ignorer", raison: "Événement non publié ou pas terminé" };
    if (e.acheteur !== true) return { statut: "ignorer", raison: "aucun Pass valide pour ce Compte" };
    if (typeof e.galerie_url !== "string" || e.galerie_url === "") return { statut: "ignorer", raison: "lien de la Galerie absent" };
    const titreFr = typeof e.titre_fr === "string" ? e.titre_fr : "";
    const titreEn = typeof e.titre_en === "string" ? e.titre_en : null;
    const message = rendreGalerieEvenement(envoi.langue, { nomSite, evenement: titreSelonLangue({ titre_fr: titreFr, titre_en: titreEn }, envoi.langue), lienGalerie: e.galerie_url });
    return { statut: "pret", destinataire, message };
  }

  const commandeId = envoi.donnees.commande_id;
  if (!commandeId) return { statut: "ignorer", raison: "commande non indiquée" };
  const { data: commande, error: erreurCommande } = await client
    .from("commande")
    .select("id, numero, compte_id, statut, total_cents, forfait_cents, mode_remise, numero_suivi")
    .eq("id", commandeId)
    .maybeSingle();
  if (erreurCommande) return { statut: "reessayer", raison: "lecture de la Commande impossible" };
  if (!commande || commande.compte_id !== envoi.compteId) return { statut: "ignorer", raison: "commande introuvable pour ce Compte" };

  if (envoi.modele === "commande_payee") {
    // Jamais « paiement reçu » pour une Commande qui n'est pas payée (règle 2).
    if (!STATUTS_PAYES.includes(commande.statut)) return { statut: "ignorer", raison: "commande non payée" };
    const { data: lignes, error } = await client
      .from("ligne_commande")
      .select("nombre, prix_cents, reduction_cents, produit:produit_id(titre_fr, titre_en), variante:variante_id(taille)")
      .eq("commande_id", commande.id)
      .order("cree_le", { ascending: true });
    if (error) return { statut: "reessayer", raison: "lecture des lignes impossible" };
    if (!lignes || lignes.length === 0) return { statut: "ignorer", raison: "commande sans ligne" };
    // Ligne Sur-mesure : l'email porte le lien WhatsApp du numéro réglé (jamais en dur), ou invite à contacter si le numéro est absent (règle 15).
    let mesures: { lien: string | null } | undefined;
    if (lignes.some((l) => (Array.isArray(l.variante) ? l.variante[0] : l.variante)?.taille === "sur_mesure")) {
      const { data: reglageWhatsapp, error: erreurWhatsapp } = await client.from("reglage").select("valeur").eq("cle", "numero_whatsapp").maybeSingle();
      if (erreurWhatsapp) return { statut: "reessayer", raison: "numéro WhatsApp illisible" };
      mesures = { lien: lienWhatsapp(reglageWhatsapp?.valeur, TEXTES[envoi.langue].commande_payee.messageMesures.replace("{numero}", commande.numero)) };
    }
    const message = rendreCommandePayee(envoi.langue, {
      nomSite,
      numero: commande.numero,
      lignes: lignes.map((l) => ({ titre: l.produit ? titreSelonLangue(l.produit, envoi.langue) : "—", nombre: l.nombre, prixCents: l.prix_cents })),
      reductionCents: lignes.reduce((s, l) => s + (l.reduction_cents ?? 0), 0),
      livraisonCents: commande.forfait_cents,
      totalCents: commande.total_cents,
      url: `${site}/${envoi.langue}/commande/${encodeURIComponent(commande.numero)}`,
      mesures,
    });
    return { statut: "pret", destinataire, message };
  }

  // Emails d'avancement (story 6.3) : jamais envoyés si la Commande n'a pas atteint (ou a dépassé normalement) ce statut.
  if (envoi.modele === "commande_en_fabrication" || envoi.modele === "commande_expediee" || envoi.modele === "commande_livree") {
    const atteints: Record<string, string[]> = {
      commande_en_fabrication: ["en_fabrication", "expediee", "livree"],
      commande_expediee: ["expediee", "livree"],
      commande_livree: ["livree"],
    };
    if (!atteints[envoi.modele].includes(commande.statut)) return { statut: "ignorer", raison: "statut de la commande non atteint" };
    const donnees = { nomSite, numero: commande.numero, url: `${site}/${envoi.langue}/commande/${encodeURIComponent(commande.numero)}`, numeroSuivi: commande.numero_suivi, retrait: commande.mode_remise === "retrait" };
    if (envoi.modele === "commande_en_fabrication") return { statut: "pret", destinataire, message: rendreCommandeEnFabrication(envoi.langue, donnees) };
    if (envoi.modele === "commande_expediee") return { statut: "pret", destinataire, message: rendreCommandeExpediee(envoi.langue, donnees) };
    // Numéro WhatsApp lu dans les réglages au moment du rendu ; absent ou mal formé : aucune invitation, aucun numéro de repli.
    const { data: numero, error: erreurNumero } = await client.from("reglage").select("valeur").eq("cle", "numero_whatsapp").maybeSingle();
    if (erreurNumero) return { statut: "reessayer", raison: "numéro WhatsApp illisible" };
    // Lien « Envoyer une photo » (story 8.1) : jamais pour un Compte mineur, dont la photo ne serait pas publiée.
    const { data: mineur, error: erreurMineur } = await client.rpc("est_mineur", { p_compte: envoi.compteId });
    if (erreurMineur) return { statut: "reessayer", raison: "âge du Compte illisible" };
    const lienPhotos = mineur === true ? null : `${site}/${envoi.langue}/compte/photos`;
    return { statut: "pret", destinataire, message: rendreCommandeLivree(envoi.langue, { ...donnees, lienWhatsapp: lienWhatsapp(numero?.valeur), lienPhotos }) };
  }

  // Annulation et remboursement (story 6.6) : jamais envoyés si la Commande n'est pas dans l'état annoncé ; le montant vient du remboursement figé.
  if (envoi.modele === "commande_annulee" || envoi.modele === "commande_remboursee") {
    const atteints: Record<string, string[]> = { commande_annulee: ["annulee", "remboursee"], commande_remboursee: ["remboursee"] };
    if (!atteints[envoi.modele].includes(commande.statut)) return { statut: "ignorer", raison: "statut de la commande non atteint" };
    const { data: remboursement, error: erreurRemboursement } = await client.from("remboursement").select("montant_cents, devise").eq("cible_type", "commande").eq("cible_id", commande.id).maybeSingle();
    if (erreurRemboursement) return { statut: "reessayer", raison: "lecture du remboursement impossible" };
    if (!remboursement || remboursement.devise !== "USD") return { statut: "ignorer", raison: "remboursement introuvable ou hors USD" };
    const donneesRemboursement = { nomSite, numero: commande.numero, url: `${site}/${envoi.langue}/commande/${encodeURIComponent(commande.numero)}`, montantCents: remboursement.montant_cents };
    const message = envoi.modele === "commande_annulee" ? rendreCommandeAnnulee(envoi.langue, donneesRemboursement) : rendreCommandeRemboursee(envoi.langue, donneesRemboursement);
    return { statut: "pret", destinataire, message };
  }

  // Pass émis (story 7.5) : jamais envoyé pour une Commande non payée (ni offerte) ni sans Pass valide. Le contenu (noms, Types, Événement, jetons)
  // est relu en base au moment du rendu ; l'envoi ne portait que l'identifiant de la Commande.
  if (envoi.modele === "pass_emis") {
    if (!STATUTS_PAYES.includes(commande.statut) && commande.statut !== "offerte") return { statut: "ignorer", raison: "commande de Pass non payée" };
    const { data: lignesPass, error: erreurPass } = await client
      .from("pass")
      .select(
        "id, nom_titulaire, statut, jeton, code_court, rang, cree_le, evenement:evenement_id(titre_fr, titre_en, lieu_fr, lieu_en, debut_le), ligne:ligne_commande_id(pass_nom_fr, pass_nom_en)",
      )
      .eq("commande_id", commande.id)
      .order("cree_le", { ascending: true })
      .order("rang", { ascending: true });
    if (erreurPass) return { statut: "reessayer", raison: "lecture des Pass impossible" };
    const valides = (lignesPass ?? []).filter((p) => p.statut === "valide");
    if (valides.length === 0) return { statut: "ignorer", raison: "aucun Pass valide" };
    const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
    const message = rendrePassEmis(envoi.langue, {
      nomSite,
      numero: commande.numero,
      url: `${site}/${envoi.langue}/compte/pass`,
      pass: valides.map((p) => {
        const evenement = un(p.evenement);
        const ligne = un(p.ligne);
        const lieu = (envoi.langue === "en" ? evenement?.lieu_en?.trim() : "") || evenement?.lieu_fr?.trim() || null;
        return {
          id: p.id,
          typeNom: ((envoi.langue === "en" ? ligne?.pass_nom_en : null) ?? ligne?.pass_nom_fr ?? "").trim(),
          nomTitulaire: p.nom_titulaire,
          evenement: evenement ? titreSelonLangue({ titre_fr: evenement.titre_fr, titre_en: evenement.titre_en }, envoi.langue) : "",
          date: formaterDateHeureBoutique(evenement?.debut_le, envoi.langue),
          lieu,
          codeCourt: p.code_court,
          jeton: p.jeton,
        };
      }),
    });
    return { statut: "pret", destinataire, message };
  }

  // Pass annulé ou remboursé (story 7.9) : jamais envoyé si le Pass n'est pas dans l'état annoncé ou n'appartient pas à la Commande du Compte ;
  // le montant vient du remboursement figé (USD seulement), le nom et l'Événement sont relus en base.
  if (envoi.modele === "pass_annule" || envoi.modele === "pass_rembourse") {
    const passId = envoi.donnees.pass_id;
    if (!passId) return { statut: "ignorer", raison: "Pass non indiqué" };
    const atteints = envoi.modele === "pass_annule" ? ["annule", "rembourse"] : ["rembourse"];
    const [pass, remboursement] = await Promise.all([
      client.from("pass").select("nom_titulaire, statut, commande_id, evenement:evenement_id(titre_fr, titre_en)").eq("id", passId).maybeSingle(),
      client.from("remboursement").select("montant_cents, devise").eq("cible_type", "pass").eq("cible_id", passId).maybeSingle(),
    ]);
    if (pass.error || remboursement.error) return { statut: "reessayer", raison: "lecture du Pass impossible" };
    if (!pass.data || pass.data.commande_id !== commande.id || commande.compte_id !== envoi.compteId) return { statut: "ignorer", raison: "Pass introuvable pour ce Compte" };
    if (!atteints.includes(pass.data.statut)) return { statut: "ignorer", raison: "statut du Pass non atteint" };
    if (!remboursement.data || remboursement.data.devise !== "USD") return { statut: "ignorer", raison: "remboursement introuvable ou hors USD" };
    const evenement = Array.isArray(pass.data.evenement) ? (pass.data.evenement[0] ?? null) : pass.data.evenement;
    if (!evenement) return { statut: "ignorer", raison: "Événement introuvable" };
    const donnees = {
      nomSite,
      numero: commande.numero,
      url: `${site}/${envoi.langue}/compte/pass`,
      nomTitulaire: pass.data.nom_titulaire,
      evenement: titreSelonLangue({ titre_fr: evenement.titre_fr, titre_en: evenement.titre_en }, envoi.langue),
      montantCents: remboursement.data.montant_cents,
    };
    const message = envoi.modele === "pass_annule" ? rendrePassAnnule(envoi.langue, donnees) : rendrePassRembourse(envoi.langue, donnees);
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
    autorisationCommerciale: async (envoiId) => {
      const { data, error } = await client.rpc("email_commercial_autorise", { p_envoi: envoiId });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "email_commercial_autorise" };
      const d = data as Record<string, unknown>;
      if (d.autorise === true) return { autorise: true };
      return { autorise: false, motif: typeof d.motif === "string" ? d.motif : "refus" };
    },
    envoyer: async ({ envoiId, destinataire, message }) => {
      const { data, error } = await resend.emails.send(
        {
          from: config.expediteur,
          to: destinataire,
          subject: message.sujet,
          html: message.html,
          text: message.texte,
          ...(message.entetes ? { headers: message.entetes } : {}),
          // Pièces jointes affichées dans le message par leur contentId (Codes QR des Pass).
          ...(message.pieces && message.pieces.length > 0
            ? { attachments: message.pieces.map((x) => ({ filename: x.nom, content: x.contenu, contentType: x.type, contentId: x.contentId })) }
            : {}),
        },
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
