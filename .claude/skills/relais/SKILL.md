---
name: relais
description: Passer le relais entre Claude Code, claude-free et OpenCode sur KOMA SHOP. Utiliser quand Jonathan dit « relais », « reprends », « continue où Claude s'est arrêté », quand une session commence par la suite d'un travail en cours, ou avant de changer d'outil (jetons Claude bientôt épuisés).
---

# Relais entre agents (KOMA SHOP)

Le même travail passe d'un outil à l'autre : Claude Code (abonnement), `claude-free` (Claude Code sur les modèles gratuits de FreeLLMAPI) et OpenCode (modèles gratuits). Le contexte voyage par des fichiers ; le code reste la source de vérité.

## Reprendre un travail (début de session)

1. Lis, dans cet ordre, ce qui existe :
   - `.relais/NOTES.md` : note rédigée par l'agent qui a passé la main (la plus fiable) ;
   - `.relais/derniere-session-claude.md` : export automatique de la dernière session Claude Code (demande, tâches, fichiers touchés, derniers échanges, raisonnement) ;
   - `_bmad-output/implementation-artifacts/sprint-status.yaml`, la fin de `journal-enchainement.md`, puis la spec de la story en cours.
2. Vérifie l'état réel : `git status`, `git diff --stat`, `git log --oneline -5`. Si une note contredit le code, le code a raison.
3. Résume en cinq lignes au plus : story en cours, ce qui est fait, ce qui reste, la prochaine étape proposée. Attends la validation de Jonathan avant de coder.
4. Applique CLAUDE.md (règles 1 à 15) et le parcours BMad exactement comme Claude Code : mêmes skills `bmad-*`, une story à la fois, lint, types, tests et build avant de dire qu'une story est finie.

## Passer la main (avant de changer d'outil, ou en fin de session)

Écris ou remplace `.relais/NOTES.md`, court (moins de 60 lignes), factuel, avec les chemins exacts :

```
# Note de relais : <date et heure> : <outil et modèle>
## Story en cours
## Fait
## Reste à faire (dans l'ordre)
## Décisions prises et pourquoi
## Pièges et points d'attention
## Commandes de vérification
## Prochaine action exacte
```

Jamais de secret dans `.relais/` (clés, contenu de `.env.local`, données client) : le dossier n'est pas versionné, mais il reste sur le disque et il est lu par d'autres outils.

## Prudence avec les modèles gratuits

- Petits changements, vérifiés un par un ; relire le diff avant de valider.
- Paiements, accès aux fichiers payants, RLS et migrations (règles 1, 2, 9 à 11) : ne rien changer sans validation explicite de Jonathan.
- Pour une revue de code (`bmad-code-review`), utiliser un autre modèle que celui qui a écrit le code.
