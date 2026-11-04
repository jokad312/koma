# Bunny Stream : bibliothèque privée (vidéos complètes des Kits)

Configuration vérifiée en réel le 2026-11-04 avec une vidéo de test (supprimée ensuite). Aucune valeur de clé n'est écrite ici (règle 4).

## Réglages de la bibliothèque et de sa Pull Zone
- **CDN token authentication** : activée (Pull Zone de la bibliothèque : Stream > bibliothèque > API > Pull zone > Security > Token authentication). Token IP validation : désactivée.
- **Block direct url file access** : désactivé. Il n'est pas nécessaire : le jeton signé suffit (règle 1). Aucun « Allowed domain » n'est requis pour la lecture.
- **Embed view token authentication** : désactivée (le lecteur intégré de Bunny n'est pas utilisé ; le lecteur du site est celui de la story 3.7).
- Les trois règles de périphérie (Edge rules) de la zone sont celles de Stream (`m3u8_cache_time_override`, `allow_captions` sur `.vtt`) : ne pas y toucher.

## Quelle clé va sur quelle ligne
| Variable | Valeur |
|---|---|
| `BUNNY_PRIVE_LIBRARY_ID` | identifiant numérique de la bibliothèque |
| `BUNNY_PRIVE_API_KEY` | « API Key » complète de la bibliothèque (Stream > bibliothèque > API), jamais la clé en lecture seule |
| `BUNNY_PRIVE_TOKEN_KEY` | « Url token authentication Key » de la **Pull Zone** de la bibliothèque |
| `BUNNY_PRIVE_CDN_HOSTNAME` | nom d'hôte `….b-cdn.net` de cette Pull Zone |

La clé « Token authentication » de l'onglet Security de la bibliothèque est une autre clé : elle ne signe que les adresses du lecteur intégré, que le site n'utilise pas. L'avoir mise dans `BUNNY_PRIVE_TOKEN_KEY` donnait un 403 sur toutes les adresses.

## Format du jeton (`src/lib/bunny/jeton.ts`)
- SHA-256 **simple** (pas de HMAC, pas de préfixe `HS256-`) de : clé de la Pull Zone + répertoire + expiration + `token_path=<répertoire>` (répertoire brut dans la signature), encodé en Base64URL sans remplissage.
- Répertoire = `/<identifiant de la vidéo en minuscules>/` ; un seul jeton couvre playlist, segments, vignette et sous-titres.
- Adresse : `https://<hôte>/bcdn_token=<jeton>&expires=<secondes Unix>&token_path=<répertoire encodé><répertoire><fichier>`. Le jeton est le premier segment du chemin, donc les adresses relatives lues dans la playlist le gardent.
- Durée : 4 heures (décision de la story 3.7).
- La variante HMAC-SHA256 `HS256-` décrite dans la documentation Bunny « Advanced » est refusée par cette zone (403 partout) ; le SHA-256 simple est accepté. En cas de nouveau 403 après un changement chez Bunny, refaire l'essai ci-dessous avant de toucher au code.

## Essai de contrôle réalisé (13 contrôles, tous conformes)
Vidéo de 3 secondes, encodée (statut 4), puis :
- 200 : playlist principale signée, sous-playlist, premier segment HLS lu depuis la playlist, vignette ;
- 403 : sans jeton, jeton altéré, jeton expiré, pour la playlist, un segment et la vignette.
La vidéo est supprimée à la fin ; la bibliothèque est revenue à 0 vidéo.

## Lecteur intégré de Bunny (plan B, non retenu)
Jeton d'intégration : `SHA256_HEX(clé Security de la bibliothèque + identifiant de la vidéo + expiration)`, en paramètres `token` et `expires` sur `https://player.mediadelivery.net/embed/<bibliothèque>/<vidéo>` (documentation Bunny « Embed token authentication »). Il perdrait des fonctions de la story 3.7 (choix des sous-titres, qualité adaptative réglée, accessibilité des commandes) et n'est utile que si le jeton CDN cesse de fonctionner.
