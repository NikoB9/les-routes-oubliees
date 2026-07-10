# Les Routes Oubliées

Application web immersive destinée à accompagner les aventures de **la Compagnie des Routes Oubliées**.

Le site permettra aux aventuriers de suivre la progression de leurs quêtes, de découvrir progressivement une carte mystérieuse et de consulter les récits, indices et épreuves consignés au cours de l’aventure.

> Projet en cours de développement.

## Fonctionnalités prévues

* affichage du message important de l’étape actuelle sous la forme d’un parchemin ;
* compte à rebours facultatif avant une quête ou une échéance ;
* présentation de la Compagnie et de ses aventuriers ;
* cartes de personnages avec forces et faiblesses ;
* carte de l’aventure révélée progressivement ;
* carnet regroupant les quatre quêtes et le Val d’Aurelune ;
* interface d’administration permettant de gérer les contenus ;
* authentification des administrateurs avec Google ;
* affichage responsive sur ordinateur, tablette et mobile ;
* prise en compte des exigences d’accessibilité.

## Structure du site

L’application publique comportera trois espaces principaux :

* **Accueil** : message actuel, présentation de la Compagnie et cartes des aventuriers ;
* **Carte** : progression géographique de l’aventure ;
* **Carnet** : récits, indices et épreuves des quêtes déjà révélées.

Les contenus en cours de préparation resteront invisibles jusqu’à leur publication depuis l’administration.

## Stack technique

### Frontend

* Angular ;
* TypeScript ;
* composants standalone ;
* interface responsive.

### Backend

* Java ;
* Spring Boot ;
* Spring Security ;
* API REST ;
* authentification Google OpenID Connect.

### Données

* PostgreSQL ;
* migrations Flyway ;
* stockage persistant des médias.

## Administration

L’accès à la connexion administrateur sera révélé par un easter egg.

Cet easter egg constitue uniquement un élément d’interface. L’accès réel à l’administration sera protégé par une authentification Google et par une liste d’adresses électroniques autorisées vérifiée côté serveur.

L’administration permettra notamment de gérer :

* les messages affichés sur le parchemin ;
* la présentation de la Compagnie ;
* les aventuriers ;
* les différentes étapes de la carte ;
* les chapitres du carnet ;
* les images et autres médias.

## Documentation

Le cahier des charges fonctionnel et technique se trouve dans :

```text
docs/PLAN_FINAL.md
```

Les instructions destinées aux agents de développement se trouvent dans :

```text
AGENTS.md
```

Les instructions d’installation et de lancement local seront ajoutées après la création du socle technique du projet.

## État du projet

Le projet est actuellement en phase de conception et d’initialisation.

Les premières étapes concernent :

1. la création du socle Angular et Spring Boot ;
2. la configuration de PostgreSQL ;
3. la mise en place de l’authentification Google ;
4. le développement de l’interface publique ;
5. le développement de l’administration.

## Licence

Le code source de ce projet est distribué sous licence MIT.

Les cartes, illustrations, logos, textes narratifs et autres ressources créatives ne sont pas couverts par la licence MIT, sauf indication contraire. Leur reproduction, leur modification et leur redistribution nécessitent l’autorisation de leur auteur.

Consulter les fichiers `LICENSE` et `ASSETS-LICENSE.md` pour plus de détails.
