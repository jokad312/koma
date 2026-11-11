-- Story 7.3, correctif : la migration 20270104100000 a redéfini consentement_source_check depuis une version ancienne et a retiré
-- les sources 'photo' et 'whatsapp' ajoutées par les stories 8.x. Liste complète : toutes les sources connues plus 'alerte_evenement'.
alter table public.consentement drop constraint if exists consentement_source_check;
alter table public.consentement add constraint consentement_source_check
  check (source in ('creation_compte', 'commande', 'preferences', 'photo', 'whatsapp', 'alerte_evenement'));
