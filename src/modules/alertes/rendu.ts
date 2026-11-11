import "server-only";
import { urlLocalisee } from "@/lib/seo/url";
import type { creerClientService } from "@/lib/supabase/service";
import { rendreAlerteEvenement } from "@/modules/envois/modeles/alerte-evenement";
import type { EnvoiReserve, ResultatRendu } from "@/modules/envois/types";
import {
  lienDesinscription,
  lienDesinscriptionAlerte,
  lienDesinscriptionAlerteUnClic,
  lienDesinscriptionUnClic,
} from "@/modules/preferences/lien-desinscription";

type ClientService = ReturnType<typeof creerClientService>;

// Rendu de l'email « alerte_evenement » au moment de l'envoi : l'envoi ne porte que des identifiants, tout est relu en base.
// Un événement dont la vente n'est plus ouverte (dépublié, vente fermée, événement commencé) n'est jamais annoncé.
export async function rendreAlerte(client: ClientService, envoi: EnvoiReserve): Promise<ResultatRendu> {
  const alerteId = envoi.donnees.alerte_id;
  const evenementId = envoi.donnees.evenement_id;
  if (!alerteId || !evenementId) return { statut: "ignorer", raison: "inscription non indiquée" };

  const { data: lue, error: erreurAlerte } = await client.rpc("alerte_evenement_pour_envoi", { p_alerte: alerteId });
  if (erreurAlerte) return { statut: "reessayer", raison: "lecture de l'inscription impossible" };
  if (!lue || typeof lue !== "object" || Array.isArray(lue)) return { statut: "ignorer", raison: "inscription introuvable" };
  const alerte = lue as Record<string, unknown>;
  if (alerte.evenement_id !== evenementId) return { statut: "ignorer", raison: "inscription d'un autre événement" };
  if (alerte.desinscrit === true) return { statut: "ignorer", raison: "inscrit désinscrit" };

  // Destinataire : l'adresse du Compte, ou celle de l'inscription par email. Jamais un numéro WhatsApp.
  let destinataire: string | undefined;
  if (envoi.compteId) {
    if (alerte.canal !== "compte" || alerte.compte_id !== envoi.compteId) return { statut: "ignorer", raison: "inscription d'un autre Compte" };
    const { data: utilisateur, error } = await client.auth.admin.getUserById(envoi.compteId);
    if (error && error.status !== 404) return { statut: "reessayer", raison: "lecture du Compte impossible" };
    destinataire = utilisateur?.user?.email;
  } else {
    if (alerte.canal !== "email" || typeof alerte.email !== "string") return { statut: "ignorer", raison: "inscription sans adresse email" };
    destinataire = alerte.email;
  }
  if (!destinataire) return { statut: "ignorer", raison: "Compte sans adresse email" };

  // Nom du site lu sans cache, au moment du rendu (réglage nom_site, jamais de valeur de repli : règle 15).
  const { data: reglage, error: erreurNom } = await client.from("reglage").select("valeur").eq("cle", "nom_site").maybeSingle();
  const nomSite = reglage?.valeur?.trim();
  if (erreurNom || !nomSite) return { statut: "reessayer", raison: "nom du site illisible" };

  const { data: evenement, error: erreurEvenement } = await client
    .from("evenement")
    .select("slug, titre_fr, titre_en, publie_le, vente_ouvre_le, vente_ferme_le, debut_le")
    .eq("id", evenementId)
    .maybeSingle();
  if (erreurEvenement) return { statut: "reessayer", raison: "lecture de l'événement impossible" };
  if (!evenement || !evenement.publie_le) return { statut: "ignorer", raison: "événement introuvable ou non publié" };
  const maintenant = Date.now();
  if (Date.parse(evenement.publie_le) > maintenant) return { statut: "ignorer", raison: "événement non publié" };
  if (Date.parse(evenement.vente_ouvre_le ?? evenement.publie_le) > maintenant) return { statut: "ignorer", raison: "vente pas encore ouverte" };
  if (evenement.vente_ferme_le && Date.parse(evenement.vente_ferme_le) <= maintenant) return { statut: "ignorer", raison: "vente fermée" };
  if (evenement.debut_le && Date.parse(evenement.debut_le) <= maintenant) return { statut: "ignorer", raison: "événement commencé" };

  const langue = envoi.langue;
  let lien: string;
  let entetes: Record<string, string>;
  try {
    lien = envoi.compteId ? lienDesinscription(envoi.compteId, langue) : lienDesinscriptionAlerte(alerteId, langue);
    // Désinscription en un clic des messageries (RFC 8058) : POST signé vers /api/desinscription, jamais un GET.
    const unClic = envoi.compteId ? lienDesinscriptionUnClic(envoi.compteId) : lienDesinscriptionAlerteUnClic(alerteId);
    entetes = { "List-Unsubscribe": `<${unClic}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  } catch {
    return { statut: "reessayer", raison: "lien de désinscription indisponible" };
  }

  const titre = langue === "en" && evenement.titre_en ? evenement.titre_en : evenement.titre_fr;
  const message = rendreAlerteEvenement(langue, {
    nomSite,
    evenement: titre,
    url: urlLocalisee(langue, `/festival/${encodeURIComponent(evenement.slug)}`),
    lienDesinscription: lien,
  });
  return { statut: "pret", destinataire, message: { ...message, entetes } };
}
