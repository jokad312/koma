// FAQ : groupes et questions dans l'ordre d'affichage. Les textes (titres de groupes, questions, réponses) viennent de messages/*.json (Faq.groupes.<groupe>,
// Faq.questions.<question>), jamais du code. La FAQ courte de l'accueil (paiement, livraison, délais) lit les mêmes entrées : voir modules/accueil/blocs.ts.
export const GROUPES_FAQ = [
  { cle: "commande", questions: ["paiement", "devise", "attente", "debite", "codePromo", "compte"] },
  { cle: "expedition", questions: ["livraison", "delais", "mesures", "horsZone", "defaut"] },
  { cle: "kits", questions: ["contenuKit", "accesKit", "videoKit", "partageKit", "kitGratuit"] },
  { cle: "festival", questions: ["acheterPass", "passNominatif", "stand", "produitsStand", "prevenir"] },
  { cle: "compte", questions: ["desinscription", "photo", "contact"] },
] as const;
