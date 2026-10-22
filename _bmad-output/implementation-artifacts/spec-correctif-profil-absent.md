---
status: done
---

# Correctif hors story : profil absent après suppression d'un Compte (2026-10-22)

## Problème
Compte de test supprimé dans le tableau de bord Supabase, puis reconnexion Google : le nouveau Compte n'avait pas de ligne `profil` (cause exacte du déclencheur non prouvée). `declarer_age` répondait `KS_PROFIL_INTROUVABLE`, traduit en « session expirée » : le Compte était bloqué indéfiniment, sans trace dans le journal.

## Correction
- Migration `20261022160000_assurer_profil.sql` (aucune migration existante modifiée) : déclencheur idempotent (`on conflict (id) do nothing`), rattrapage des Comptes sans profil, fonction `assurer_profil(p_auteur, p_compte, p_langue)` réservée à `service_role` (AD-25, journal `profil_cree` seulement si la ligne est créée).
- `terminerGoogle` et `verifierCode` garantissent le profil avant de lire l'état du Compte ; `declarerAge` le garantit puis réessaie une fois sur `KS_PROFIL_INTROUVABLE`.
- « Session expirée » (`non_connecte`) seulement si `getClaims` ne renvoie aucune session ; tout autre refus : erreur générique et cause (code KS_ ou SQL, sans donnée personnelle) dans le journal.
- Message `non_connecte` : invitation à se reconnecter (fr et en).

## Tests
pgTAP `supabase/tests/assurer_profil.test.sql` ; Vitest `tests/unit/comptes-service.test.ts` et `comptes-google.test.ts` (faux nommés TEST_). Pas d'e2e réel de suppression d'un Compte Google.
