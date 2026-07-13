# Correction orthographe et dates locales

## Objectif

Corriger les libellés français visibles sans accents et remplacer la saisie UTC du compte à rebours par une saisie locale dans la timezone du site.

## Étapes

- [x] Noter la règle d'accents dans les consignes agents.
- [x] Remplacer le champ ISO UTC du compte à rebours admin par une saisie locale.
- [x] Convertir les dates entre valeur locale d'édition et `OffsetDateTime` API.
- [x] Corriger les accents des textes frontend, messages backend et données de démonstration visibles.
- [x] Adapter les tests impactés.
- [x] Exécuter les validations frontend et backend.

## Risques

- Ne pas renommer les identifiants techniques, routes, enums, champs JSON ou classes CSS.
- Conserver le stockage backend en `timestamptz` / `OffsetDateTime`.
- Éviter une conversion DST approximative pour Europe/Paris.

## Validation

- Tests frontend complets, lint et build frontend exécutés avec succès.
- Tests backend complets exécutés avec succès.
- Recherche finale des marqueurs d'encodage cassé effectuée sur les fichiers modifiés principaux.
