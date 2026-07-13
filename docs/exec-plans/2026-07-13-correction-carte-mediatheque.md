# Correction - Fonds de carte depuis la mediatheque

## Objectif

Permettre a l'administration de choisir un fond de carte depuis la mediatheque, sans casser les fonds existants versionnes dans `frontend/public/assets/maps/`.

## Perimetre

- Backend carte : accepter `/media/{uuid}` en plus de `/assets/maps/*.png|jpg|jpeg|webp`.
- Frontend admin : charger la mediatheque dans la section Carte et proposer un bouton pour utiliser une image comme fond.
- Documentation : acter la coexistence assets versionnes et medias uploades.
- Qualite : tests backend carte, validations frontend et backend.

## Etapes

- [x] Identifier les contraintes actuelles `/assets/maps/`.
- [x] Etendre la validation backend aux medias internes.
- [x] Ajouter la selection de media dans le formulaire carte.
- [x] Mettre a jour la documentation.
- [x] Executer les validations.
- [x] Relire le diff final.

## Controles

- Les URLs externes restent refusees.
- Les SVG restent refuses pour les assets de carte.
- Les donnees existantes `/assets/maps/` restent valides.
