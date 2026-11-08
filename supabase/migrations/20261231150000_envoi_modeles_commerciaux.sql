-- Story 9.4 : les cinq modèles d'Email commercial de l'énumération fermée d'AD-9 (relance, panier_abandonne, rappel_kit,
-- nouveau_produit, alerte_evenement). Aucun n'est planifié ni rendu ici : leurs gabarits et leurs déclencheurs arrivent avec les
-- stories 9.5, 9.6 et 7.3 (la boîte d'envoi ignore un modèle sans gabarit). Ils permettent dès maintenant à
-- email_commercial_autorise d'être appliquée et testée (consentement, désinscription, Compte mineur, écart de 2 jours).
alter type public.envoi_modele add value if not exists 'relance';
alter type public.envoi_modele add value if not exists 'panier_abandonne';
alter type public.envoi_modele add value if not exists 'rappel_kit';
alter type public.envoi_modele add value if not exists 'nouveau_produit';
alter type public.envoi_modele add value if not exists 'alerte_evenement';
