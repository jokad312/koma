-- Story 6.1 : dates de la frise des statuts, numero de suivi saisi a la main (regle 12) et date de reception des mesures (AD-32).
-- Colonnes seulement : elles sont posees par avancer_statut et confirmer_mesures_recues (stories 6.3 et 6.5). Aucune mesure n'est stockee.
alter table public.commande
  add column fabrication_le timestamptz,
  add column expediee_le timestamptz,
  add column livree_le timestamptz,
  add column numero_suivi text check (numero_suivi is null or char_length(numero_suivi) between 1 and 100);

alter table public.ligne_commande
  add column mesures_recues_le timestamptz;
