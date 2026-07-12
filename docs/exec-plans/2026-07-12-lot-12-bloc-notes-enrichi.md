# Lot 12 - Bloc-notes enrichi

## Objectif

Remplacer l'edition narrative basique par un editeur Markdown plus ergonomique avec previsualisation.

## Perimetre

- Frontend admin : editeur Markdown enrichi, preview, insertion de liens et de medias, etats accessibles.
- Backend : sanitation du Markdown, rendu controle, tests de securite XSS.
- Qualite : tests d'integration, frontend et rendu public.

## Hors perimetre

- Carte.
- Parametres du site.
- Versioning editorial complet.

## Criteres de validation

- Le Markdown source reste conserve.
- Le rendu public est nettoye.
- Les liens et medias sont traites sans HTML brut non controle.
- Les tests pertinents passent.
