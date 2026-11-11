-- Story 7.10, correctif (la migration 20270111110000 est déjà appliquée : elle n'est pas modifiée).
-- Le quantificateur {1,500} dépasse la limite des expressions régulières de PostgreSQL (255) : « + » à la place ; la longueur totale (600 caractères
-- au plus) reste bornée par la contrainte de la colonne evenement.galerie_url.
create or replace function public.galerie_url_valide(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url ~ '^https://(drive\.google\.com|photos\.google\.com|photos\.app\.goo\.gl)/[^[:space:]]+$' and char_length(p_url) <= 600
$$;
revoke all on function public.galerie_url_valide(text) from public, anon, authenticated, service_role;
