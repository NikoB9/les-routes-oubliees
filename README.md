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

* Angular 22.x ;
* TypeScript strict ;
* composants standalone ;
* interface responsive.

### Backend

* Java 25 LTS ;
* Spring Boot 4.1.x ;
* Spring Security ;
* API REST ;
* authentification Google OpenID Connect.

### Données

* PostgreSQL 18 ;
* migrations Flyway ;
* stockage persistant des médias.

## Prérequis de développement

Les lots de socle devront fournir les projets exécutables, mais les versions cibles sont déjà fixées :

* Node.js LTS compatible Angular 22 et npm ;
* Java 25 LTS ;
* Docker Compose ou équivalent pour PostgreSQL local ;
* Maven Wrapper côté backend une fois le socle créé.

## Lancement local

Le service déjà préparé est PostgreSQL :

```bash
docker compose -f infra/compose.yml up db
```

Lorsque les socles Angular et Spring Boot seront créés, les commandes cibles seront :

```bash
cd frontend
npm ci
npm run lint
npm test -- --watch=false
npm run build
```

```bash
cd backend
./mvnw verify
```

Le profil Compose applicatif sera activable après ajout des Dockerfiles :

```bash
docker compose -f infra/compose.yml --profile app up --build
```

Sur un poste sans Node/npm ou Java 25 installés localement, les validations peuvent être lancées via Docker :

```powershell
.\scripts\frontend-check.ps1 -Task lint
.\scripts\frontend-check.ps1 -Task build
.\scripts\backend-check.ps1 -SkipTests
```

## Packaging de release

Depuis PowerShell :

```powershell
.\scripts\package-release.ps1 -SkipTests
```

Le script cree `dist/les-routes-oubliees-release.tar.gz` avec :

```text
backend/app.jar
frontend/index.html
release-info.txt
```

La procedure de copie et de deploiement serveur est decrite dans `docs/DEPLOIEMENT.md`.

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

Les commandes de lancement local sont décrites plus haut et seront complétées à mesure que les lots applicatifs ajoutent des fonctionnalités.

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
