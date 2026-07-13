# Lot 13 - Parametres du site

## Objectif

Administrer les parametres transverses du site.

## Perimetre

- Backend :
  - table `site_settings` geree par Flyway ;
  - lecture publique des parametres non sensibles ;
  - lecture et mise a jour admin du nom du site, sous-titre, logo, fuseau horaire, message de maintenance, etat du site et informations d'accessibilite ;
  - validation serveur des longueurs, URLs internes et fuseaux horaires ;
  - audit de la modification.
- Frontend :
  - service API admin pour les parametres ;
  - formulaire admin accessible dans la section Parametres ;
  - etats de chargement, succes et erreur ;
  - exposition des parametres publics dans le layout lorsque c'est pertinent.
- Qualite :
  - tests d'integration backend ;
  - tests frontend, lint et build.

## Hors perimetre

- Carte.
- Bloc-notes.
- Refonte visuelle globale.

## Criteres de validation

- Les parametres sont modifiables depuis l'administration.
- Les valeurs sont validees cote serveur.
- Les parametres publics ne contiennent pas d'information d'administration.
- Le mode maintenance est visible publiquement sans exposer les routes admin.
- Les tests pertinents passent.

## Etapes

- [x] Lire les sources de verite, l'etat Git et l'existant settings/admin.
- [x] Ajouter le modele, la migration et les endpoints settings backend.
- [x] Ajouter les tests backend de lecture, mise a jour et validation.
- [x] Ajouter l'integration frontend admin des parametres.
- [x] Ajouter ou ajuster les tests frontend pertinents.
- [x] Executer les validations backend et frontend.
- [x] Relire le diff final.

## Risques et controles

- Ne pas stocker de secret dans les parametres du site.
- Ne pas utiliser le frontend comme barriere de securite pour le mode maintenance.
- Valider le fuseau horaire avec `ZoneId`.
- Limiter le logo a un chemin public controle ou a une URL media interne.
