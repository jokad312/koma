-- Story 4.5 (correctif de revue). Un montant reçu n'a de sens qu'avec sa devise, et inversement : les deux ou aucun.
-- (Ajouté après la migration 20261128100000, qui n'est pas modifiée.)
alter table public.tentative_paiement
  add constraint tentative_montant_devise check ((montant_recu is null) = (devise_recue is null));
