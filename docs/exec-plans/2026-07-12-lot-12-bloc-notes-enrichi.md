# Lot 12 - Bloc-notes enrichi

## Objectif

Remplacer l'edition narrative basique par un editeur Markdown plus ergonomique avec previsualisation.

## Perimetre

- Frontend admin :
  - barre d'outils Markdown sur les champs narratifs ;
  - insertion de titres, gras, italique, listes, citations et liens ;
  - insertion d'images depuis la mediatheque admin ;
  - previsualisation explicite sans sauvegarde ;
  - etats accessibles.
- Backend :
  - rendu controle des images Markdown ;
  - previsualisation admin sans persistance ;
  - sanitation des URLs et refus du HTML brut ;
  - tests de securite XSS et URL dangereuses.
- Qualite :
  - tests d'integration backend ;
  - lint, tests et build frontend ;
  - validation du rendu public existant.

## Hors perimetre

- Carte.
- Parametres du site.
- Versioning editorial complet.

## Criteres de validation

- Le Markdown source reste conserve.
- Le rendu public est nettoye.
- Les liens et medias sont traites sans HTML brut non controle.
- Les tests pertinents passent.

## Etapes

- [x] Analyser l'existant Markdown, bloc-notes admin et mediatheque.
- [x] Etendre le rendu Markdown securise.
- [x] Ajouter la previsualisation admin backend sans sauvegarde.
- [x] Ajouter l'editeur enrichi et l'insertion de medias cote admin.
- [x] Executer les validations backend.
- [x] Executer les validations frontend.
- [x] Relire le diff final.

## Risques et controles

- Ne pas introduire de bibliotheque lourde pour un besoin de MVP couvert par le rendu controle existant.
- Ne pas autoriser le HTML brut ni les protocoles dangereux.
- Ne pas rendre les images SVG via Markdown.
- Conserver le Markdown source comme donnee canonique.
