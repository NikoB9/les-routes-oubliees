# Lot 11 - Carte administrable

## Objectif

Permettre la gestion complete de la carte active et des reperes associes.

## Perimetre

- Backend admin :
  - lister, creer, modifier, supprimer et activer les visions de carte ;
  - empecher l'activation d'une vision non publiee ;
  - limiter les fonds aux assets versionnes sous `/assets/maps/` ;
  - lister, creer, modifier et supprimer les reperes ;
  - exposer une previsualisation admin sans effet de publication.
- Frontend admin :
  - ajouter la section `/admin/map` dans la coquille admin existante ;
  - gerer les formulaires des fonds et reperes ;
  - permettre le placement clavier via coordonnees X/Y en pourcentage ;
  - afficher une previsualisation explicite et accessible.
- Qualite :
  - tests d'integration backend sur securite, activation, previsualisation et reperes ;
  - tests frontend et build du module.

## Hors perimetre

- Bloc-notes.
- Parametres du site.
- Refonte visuelle globale.
- Glisser-deposer obligatoire pour placer les reperes.

## Criteres de validation

- Une carte active peut etre choisie.
- Les reperes peuvent etre places et ordonnes.
- La previsualisation ne publie rien automatiquement.
- Les tests pertinents passent.

## Etapes

- [x] Analyser l'existant carte publique, shell admin et schema PostgreSQL.
- [x] Ajouter les endpoints admin carte et les DTO.
- [x] Integrer la section carte dans l'administration Angular.
- [x] Executer les validations backend. Reussi le 2026-07-13 via Docker avec `TESTCONTAINERS_RYUK_DISABLED=true` et `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal`.
- [x] Executer les validations frontend. Reussi le 2026-07-13 via Docker.
- [x] Relire le diff final.

## Risques et controles

- Les contraintes d'unicite `display_order` et `quest_id` sur les reperes restent protegees par PostgreSQL ; l'interface doit donc modifier les reperes existants plutot que creer des doublons pour une meme quete.
- La previsualisation admin affiche les reperes actifs independamment de la publication publique des quetes ; l'API publique conserve son filtrage sur quetes publiees et visibles.
- Le chemin du fond n'est pas libre : il doit rester dans `/assets/maps/` avec une extension image autorisee.
