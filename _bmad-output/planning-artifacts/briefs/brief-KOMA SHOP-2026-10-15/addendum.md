---
title: "Addendum au brief — KOMA SHOP"
created: 2026-10-15
updated: 2026-10-16
---

# Addendum au brief : KOMA SHOP

Détails utiles au PRD et à l'architecture, qui n'ont pas leur place dans le brief.

## Décisions qui changent des documents existants

| Décision du brief | Document à mettre à jour | Ce qui y est écrit aujourd'hui |
| --- | --- | --- |
| Livraison physique limitée à Goma et Bukavu au lancement | `CLAUDE.md` (section Prix et livraison), `docs/guide-koma-shop.md` (Livraison depuis Goma, table shipping_zones) | Quatre zones : Goma, RDC, Afrique, monde |
| Langues : français et anglais | `CLAUDE.md` (section Langues) | Choix encore ouvert entre français seul et français + anglais |
| Domaine komashop.com | Guide (questions ouvertes) | Nom et domaine encore ouverts |

`CLAUDE.md` et le guide ont été alignés le 16 octobre 2026, avec l'accord de Jonathan.

## Vidéos et fichiers des kits

- Le kit vendu comprend la vidéo complète et les fichiers ensemble ; aucune vente séparée.
- Fichiers : PDF imprimables (A4 et US Letter), fichiers pour imprimante 3D (STL), ou les deux, patrons créés par Jonathan.
- Dans l'admin, deux façons d'ajouter une vidéo : téléversement sur la plateforme, ou lien vers un stockage vidéo externe lu dans le lecteur du site.
- Contrainte pour l'architecture : quelle que soit l'option, la règle 1 de `CLAUDE.md` s'applique. La vidéo complète n'est jamais accessible par un lien public ; seul un lien signé créé côté serveur après vérification de l'accès payé l'ouvre. Un hébergeur externe doit donc offrir des liens protégés (le guide cite Bunny Stream, Cloudflare Stream, Mux). Un simple lien Google Drive ou YouTube non répertorié ne respecte pas cette règle.

## Repères de prix (déclarés par Jonathan)

| Référence | Prix | Délai |
| --- | --- | --- |
| Cosplay complet sur AliExpress / Alibaba | 45 à 80 USD | 45 à 50 jours |
| Cosplay complet vendu par Jonathan au festival | environ 30 USD | — |
| Accessoire vendu au festival | 1,5 à 2 USD | — |
| Kit KOMA SHOP | à fixer par Jonathan | immédiat |

Les prix sont saisis librement dans l'admin pour chaque produit.

## Délais de fabrication

Trop variables d'une pièce à l'autre pour un chiffre global. Le délai est saisi par produit ou par variante (champ `lead_time_days` du guide) et affiché avant le paiement.

## Communauté et acquisition

- Groupe WhatsApp créé et animé par Jonathan : plus de 170 membres actifs (partage d'idées, rendez-vous). Premier canal de lancement et terrain de validation des prix.
- Festival co-organisé par Jonathan, où des cosplays et accessoires ont déjà été vendus hors ligne.
- Pas encore de présence sur TikTok ni Instagram.

## Points à reprendre dans le PRD

- Dans le guide, la user story « Un visiteur peut parcourir le catalogue et le filtrer… » est cochée `[x]` alors que rien n'est construit : coquille à corriger.
- Livraison : un forfait par ville (Goma, Bukavu) saisi dans l'admin, à la place du tarif par zone et par famille du guide. Bukavu est de l'autre côté du lac Kivu : moins d'un jour de livraison, à ajouter au délai de fabrication affiché.
- Tarif par famille (cosplay plus lourd qu'un bijou) : à garder ou non en plus du forfait par ville ; à trancher dans le PRD.
- Catalogue de lancement (le guide propose 3 cosplays, 5 accessoires, 2 kits payants, 1 kit gratuit).
