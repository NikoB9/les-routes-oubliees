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
* authentification des administrateurs avec Cloudflare Access ;
* affichage responsive sur ordinateur, tablette et mobile ;
* installation PWA des pages de contenu ;
* consultation hors ligne du dernier contenu public synchronise ;
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
* validation JWT Cloudflare Access pour les routes humaines protegees.

### Données

* PostgreSQL 18 ;
* migrations Flyway ;
* stockage persistant des médias.

## Prérequis de développement

Les lots de socle devront fournir les projets exécutables, mais les versions cibles sont déjà fixées :

* Node.js 22.22.3 ou 24.15.0 au minimum, exigence de la CLI Angular 22, et npm ;
* Java 25 LTS ;
* Docker Compose ou équivalent pour PostgreSQL local, et un démon Docker pour les tests Testcontainers ;
* Maven Wrapper côté backend une fois le socle créé.

Ces mêmes validations sont rejouées automatiquement par `.github/workflows/ci.yml` à chaque `push` et chaque `pull request`.

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

Cet easter egg constitue uniquement un élément d’interface. L’accès réel à l’administration sera protégé par une authentification Cloudflare Access et par une liste d’adresses électroniques autorisées vérifiée côté serveur.

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
3. la mise en place de l’authentification Cloudflare Access ;
4. le développement de l’interface publique ;
5. le développement de l’administration.

## Licence

Le code source de ce projet est distribué sous licence MIT.

Les cartes, illustrations, logos, textes narratifs et autres ressources créatives ne sont pas couverts par la licence MIT, sauf indication contraire. Leur reproduction, leur modification et leur redistribution nécessitent l’autorisation de leur auteur.

Consulter les fichiers `LICENSE` et `ASSETS-LICENSE.md` pour plus de détails.
## Radar d'Aurelune

Le site complet est protégé par Cloudflare Access sur l'hôte de production. Le module `Radar` ajoute la route `/radar` dans cette application authentifiée.

Configuration minimale :

```text
CF_ACCESS_ISSUER=https://example.cloudflareaccess.com
CF_ACCESS_AUDIENCE=example-audience-tag
CF_ACCESS_CERTS_URL=https://example.cloudflareaccess.com/cdn-cgi/access/certs
RADAR_HOME_ASSISTANT_TOKEN=
```

`RADAR_HOME_ASSISTANT_TOKEN` n'a aucune valeur de secours : il doit contenir 32 octets aléatoires encodés en base64url et devient obligatoire en production, où le démarrage échoue si la variable est absente, vide, factice ou trop courte.

Le reverse proxy doit transmettre `Cf-Access-Jwt-Assertion` au backend et autoriser la géolocalisation via `Permissions-Policy`.

La localisation n'est active que pendant l'affichage de la page Radar : le suivi démarre à l'ouverture, la dernière position connue est republiée toutes les sept secondes, et tout s'arrête à la sortie. Une sortie normale tente un retrait immédiat du repère ; en cas d'interruption non signalée, l'expiration serveur d'environ 45 secondes reste le filet de sécurité.

Radar utilise Leaflet 1.9.4 et les tuiles OpenStreetMap standard dans la configuration versionnée. Les positions des participants ne sont pas persistées ; seul le dernier relevé de la balise trésor est stocké, et il reste masqué côté API lorsque l'administration désactive son affichage.
