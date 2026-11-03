-- Stories 5.2 et 5.3 (correctifs de revue, après 20261204100000 qui n'est pas modifiée).
-- 1. Le numéro de téléphone n'est jamais conservé en clair : la base refuse tout numéro qui ne porte pas le masque « • ».
-- 2. enregistrer_initiation signale une Tentative qui n'est plus en cours (au lieu de réussir en silence sans rien enregistrer).
alter table public.tentative_paiement
  add constraint tentative_telephone_masque_forme check (telephone_masque is null or position('•' in telephone_masque) > 0);

create or replace function public.enregistrer_initiation(p_tentative uuid, p_reference_transaction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.tentative_paiement set reference_transaction = p_reference_transaction, modifie_le = now()
    where id = p_tentative and statut = 'en_cours';
  exception when unique_violation then
    raise exception 'KS_REFERENCE_DEJA_UTILISEE' using errcode = 'P0001';
  end;
  if not found then
    raise exception 'KS_TENTATIVE_NON_EN_COURS' using errcode = 'P0001';
  end if;
end;
$$;
