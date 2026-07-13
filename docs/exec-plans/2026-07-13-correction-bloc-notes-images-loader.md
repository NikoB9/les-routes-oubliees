# Correction bloc-notes images et chargements

## Objectif

Ameliorer l'insertion d'images dans le bloc-notes admin, rendre les images Markdown responsives et ajouter un loader visuel aux etats de chargement.

## Etapes

- [x] Verifier le rendu Markdown actuel, les tests existants et les contraintes d'accessibilite.
- [x] Etendre le renderer Markdown avec une syntaxe controlee pour titre visible et taille d'image.
- [x] Remplacer le selecteur d'images global du bloc-notes admin par une modale avec recherche, titre et taille.
- [x] Centrer et dimensionner les images rendues dans le carnet public.
- [x] Ajouter un loader reutilisable aux etats de chargement publics et admin.
- [x] Executer les validations frontend et backend pertinentes.

## Risques

- Ne pas affaiblir la sanitation Markdown : les URLs, tailles et classes doivent rester allowlistees.
- Conserver la compatibilite avec les images Markdown deja saisies.
- Garder la modale utilisable au clavier avec retour du focus.

## Validation cible

- Tests unitaires Markdown backend.
- Tests frontend admin/public impactes.
- Lint, tests et build frontend.
- Verification backend si le temps d'execution le permet.
