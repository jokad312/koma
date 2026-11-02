-- Story 5.1 (correctif de revue). Un même couple ne s'écrit qu'une fois par Agrégateur, sans distinction de majuscules : « MTN » et « mtn »
-- sont le même opérateur, et l'aiguilleur compare en égalité stricte. (Ajouté après la migration 20261201100000, qui n'est pas modifiée.)
alter table public.couverture drop constraint couverture_couple_unique;
create unique index couverture_couple_unique on public.couverture (prestataire, pays, lower(operateur));
