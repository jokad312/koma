-- Décision du 2026-11-03 : K-Pay est abandonné (comme GeniusPay). Le mobile money passe par PawaPay et MaishaPay ; la carte d'un Panier avec
-- Produit physique ou d'un Pass passe par MaishaPay (sa documentation l'accepte : CyberSource, USD et EURO). Polar reste pour les Paniers 100 % Kits.
-- Les migrations déjà appliquées ne sont pas modifiées : celle-ci retire K-Pay et corrige les moyens et l'ordre.
-- Échoue d'elle-même (clé étrangère) s'il existe une Tentative ou une notification de K-Pay : rien n'est supprimé en silence.
select set_config('ks.auteur', '{"type":"migration","nom":"retrait_kpay"}', true);

delete from public.couverture where prestataire = 'kpay';
delete from public.prestataire where code = 'kpay';

alter table public.prestataire drop constraint prestataire_code_check;
alter table public.prestataire add constraint prestataire_code_check check (code in ('pawapay', 'maishapay', 'polar'));

-- MaishaPay encaisse aussi la carte (règle 10) ; il passe en deuxième position (PawaPay 1, MaishaPay 2).
update public.prestataire set carte = true, ordre = 2, modifie_le = now() where code = 'maishapay';
