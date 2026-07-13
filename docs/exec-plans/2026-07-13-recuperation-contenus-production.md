# Récupération contenus production et garde-fou migrations

## Objectif

Récupérer en production les contenus éditoriaux écrasés par la migration `V9__correct_french_demo_labels.sql`, puis empêcher qu'une migration Flyway réécrive à nouveau des contenus administrables.

## Cause identifiée

La migration `V9__correct_french_demo_labels.sql` exécute des `UPDATE` directs sur des tables de contenu administrables. Lors du premier démarrage après déploiement, Flyway a donc pu remplacer des modifications faites en production par les valeurs de démonstration corrigées.

Tables concernées par le risque :

- `home_messages` : parchemins d'accueil ;
- `company_profiles` : présentation de la Compagnie ;
- `adventurers` : membres affichés sur l'accueil ;
- `quests` : contenus des quêtes et brouillons admin ;
- `map_visions`, `map_markers`, `site_settings` : autres contenus touchés par V9.

## Plan de récupération production

- Créer un nouveau dump de sécurité de l'état actuel de production avant toute correction.
- Identifier le dump pré-déploiement créé par `infra/deploy/lro-deploy` dans `/var/backups/les-routes-oubliees/database`.
- Restaurer ce dump pré-déploiement dans une base temporaire dédiée.
- Comparer base temporaire et base actuelle pour :
  - `home_messages` ;
  - `company_profiles` ;
  - `adventurers` ;
  - `quests`.
- Réinjecter dans la base actuelle uniquement les lignes de ces tables dont le contenu éditorial a été écrasé.
- Ne pas restaurer globalement la base et ne pas modifier `flyway_schema_history`.
- Vérifier ensuite :
  - parchemin actif sur l'accueil public ;
  - présentation de la Compagnie ;
  - liste et contenu des aventuriers ;
  - carnet public et brouillons de quêtes dans l'administration.

## Plan de prévention côté code

- Ne pas modifier une migration Flyway déjà appliquée en production.
- Ajouter un test de sécurité sur les migrations qui échoue si une nouvelle migration à partir de `V10` contient un `UPDATE`, `DELETE` ou `TRUNCATE` non explicitement autorisé sur une table éditoriale administrable.
- Documenter la règle : les migrations ne doivent pas réécrire des contenus édités en production ; une correction de données doit être conditionnelle, idempotente et limitée aux anciennes valeurs attendues.
- Ajouter cette règle dans `AGENTS.md` et/ou la documentation de déploiement.

## Validations

- Confirmer en production que `flyway_schema_history` contient `V9`.
- Confirmer que le dump pré-déploiement contient les contenus attendus avant réinjection.
- Exécuter la réinjection dans une transaction et contrôler le nombre de lignes modifiées.
- Lancer d'abord une comparaison en dry-run, puis appliquer uniquement si les lignes affichées correspondent au contenu attendu.
- Lancer les contrôles backend après ajout du garde-fou migration.
- Vérifier que le prochain déploiement ne modifie plus les tables éditoriales restaurées.

## Risques

- Une restauration complète pourrait perdre des modifications faites après le déploiement ; elle est exclue sauf demande explicite.
- Les contenus à récupérer doivent être extraits depuis le dump pré-déploiement, pas depuis les migrations de démonstration.
- Les tables d'authentification, d'audit, médias et paramètres techniques ne doivent pas être restaurées dans cette opération ciblée.
