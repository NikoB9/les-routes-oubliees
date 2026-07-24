# Position des drapeaux de repères de carte

## Objectif

Permettre à l'administration de choisir la position du drapeau d'un repère de carte autour du point (`TOP`, `BOTTOM`, `LEFT`, `RIGHT`) et sa distance en pixels CSS.

## Étapes

1. Ajouter les champs persistés avec valeurs par défaut et validation SQL.
2. Étendre le modèle, les DTO et les projections backend.
3. Adapter le rendu public et la prévisualisation admin.
4. Ajouter les contrôles admin.
5. Mettre à jour les tests ciblés et lancer les validations pertinentes.

## Risques

* Régression d'ancrage du point sur la carte si le ruban déplace le conteneur.
* Incohérence entre prévisualisation admin et rendu public.
* Valeurs invalides exposées si la validation frontend et backend divergent.

## Critères de validation

* Les repères existants restent en `TOP` avec l'écart par défaut.
* Les quatre positions s'affichent sans superposer nécessairement les drapeaux lorsque l'administrateur les répartit.
* Les endpoints admin et public exposent les nouveaux champs.
* Les tests backend et frontend ciblés passent.
