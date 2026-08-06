# Fichier : docs/ARCHITECTURE.md

# Architecture technique

## 1. Principes

L’architecture doit rester adaptée à un petit projet administrable, hébergé sur une seule machine virtuelle légère ou un conteneur LXC.

Principes :

* monolithe modulaire ;
* frontend Angular séparé du backend Spring Boot ;
* API REST ;
* base PostgreSQL unique ;
* backend sans état : session gérée par Cloudflare Access en amont, JWT validé à chaque requête ;
* fichiers médias sur volume persistant ;
* pas de microservices ;
* pas de complexité distribuée ;
* sécurité contrôlée côté backend ;
* déploiement reproductible.

## 2. Vue générale

```text
Navigateur
    │
    │ HTTPS
    ▼
Cloudflare Tunnel
    │
    ▼
Reverse proxy
    ├── fichiers Angular
    ├── /api/*       ───────────────┐
    ├── /api/*                      │
    ├── /media/*                    ▼
    └── /media/*             Spring Boot
                                  │
                                  │ JDBC
                                  ▼
                              PostgreSQL
```

Le reverse proxy constitue le point d’entrée HTTP local.

Spring Boot n’est pas directement exposé à Internet.

PostgreSQL n’est jamais exposé publiquement.

## 3. Structure du dépôt

```text
les-routes-oubliees/
├── AGENTS.md
├── README.md
├── LICENSE
├── ASSETS-LICENSE.md
├── docs/
│   ├── PLAN_FINAL.md
│   ├── ARCHITECTURE.md
│   ├── ACCESSIBILITE.md
│   ├── DEPLOIEMENT.md
│   └── exec-plans/
├── frontend/
├── backend/
├── infra/
└── scripts/
```

## 3.1 Versions de référence

Les versions cibles du socle sont :

| Composant | Version cible |
| --- | --- |
| Angular | 22.x |
| TypeScript | version supportée par Angular 22 |
| Node.js | version LTS compatible Angular 22 |
| Java | 25 LTS |
| Spring Boot | 4.1.x |
| PostgreSQL | 18 |
| Flyway | version fournie ou compatible avec le socle Spring Boot |

Ces versions sont rappelées dans `AGENTS.md`, qui reste la règle stricte pour les agents de développement.

## 4. Frontend

### 4.1 Responsabilités

Angular prend en charge :

* affichage public ;
* navigation ;
* administration ;
* formulaires ;
* prévisualisation ;
* compte à rebours ;
* intégration de l’API ;
* états de chargement et d’erreur ;
* responsive ;
* interactions accessibles.

Angular ne décide jamais seul :

* si un utilisateur est administrateur ;
* si un contenu peut être publié ;
* si une donnée est visible publiquement ;
* si un fichier uploadé est valide.

### 4.2 Organisation

```text
frontend/src/app/
├── core/
│   ├── api/
│   ├── auth/
│   ├── errors/
│   ├── guards/
│   └── config/
├── shared/
│   ├── components/
│   ├── directives/
│   ├── models/
│   └── utilities/
├── layout/
│   ├── header/
│   ├── desktop-navigation/
│   └── mobile-navigation/
├── features/
│   ├── home/
│   ├── map/
│   ├── notebook/
│   └── admin/
└── app.routes.ts
```

### 4.3 État

Utiliser :

* signaux pour les états locaux simples ;
* services pour l’accès API ;
* paramètres de route pour la navigation ;
* formulaires réactifs pour l’administration.

Ne pas introduire une bibliothèque globale de gestion d’état tant qu’un besoin réel n’est pas démontré.

### 4.4 PWA et cache public

Angular peut etre installe comme PWA en production.

Principes :

* le service worker cache le shell public et les assets versionnes ;
* les medias uploades `/media/**` ne sont pas caches par le service worker tant que l'acces public n'est pas filtre par contenu publie ;
* les API publiques GET peuvent etre mises en cache avec une strategie freshness courte pour permettre le mode avion ;
* les API admin, Radar, portail, intégration et opérations d'écriture ne sont pas mises en cache ;
* le dernier snapshot public est stocke dans IndexedDB ;
* la mise a jour du snapshot passe par une empreinte publique fournie par le backend ;
* le snapshot ne contient que les donnees deja visibles via les API publiques ;
* le frontend n'utilise jamais le cache comme source d'autorisation ou de publication.

### 4.5 Routage

Routes publiques :

```text
/
/map
/notebook
/notebook/:questCode
```

Routes admin :

```text
/admin
/admin
/admin/home
/admin/group
/admin/adventurers
/admin/map
/admin/notebook
/admin/media
/admin/administrators
/admin/audit
/admin/settings
```

Les routes admin doivent être chargées paresseusement.

Le guard Angular améliore l’expérience, mais ne remplace jamais la sécurité backend.

## 5. Backend

### 5.1 Organisation par fonctionnalité

```text
backend/src/main/java/fr/.../routesoubliees/
├── shared/
├── auth/
├── settings/
├── home/
├── group/
├── adventurer/
├── map/
├── quest/
├── media/
└── audit/
```

Chaque module peut contenir :

```text
api/
application/
domain/
infrastructure/
```

Cette séparation reste légère. Ne pas créer de couches vides.

### 5.2 Responsabilités

Le backend garantit :

* authentification ;
* autorisation ;
* allowlist ;
* règles de publication ;
* validation ;
* sanitation ;
* stockage ;
* audit ;
* filtrage public ;
* cohérence transactionnelle.

### 5.3 API

Préfixes :

```text
/api/public
/api/admin
```

Format JSON.

Endpoints publics PWA :

```text
GET /api/public/content-version
GET /api/public/offline-snapshot
```

Ces endpoints exposent uniquement les contenus publics publies et visibles. Ils ne doivent jamais inclure de brouillons, donnees admin, audit, emails administrateurs, secrets ou champs narratifs source non publics.

Le prefixe `/api/public` designe le **filtrage editorial** des contenus, pas une absence d'authentification : comme toutes les API humaines, ces endpoints exigent un JWT Cloudflare Access valide. Cote Spring, seules `/`, `/error` et `/actuator/health` restent accessibles sans identite ; `/media/**` exige egalement une identite valide. La seule exception est le `POST` exact de publication de position Home Assistant, authentifie par un Bearer applicatif.

Les refus d'authentification emis par l'application portent l'en-tete `X-LRO-Auth-Error: application` afin d'etre distingues d'une expiration de session Cloudflare Access, qui est renvoyee par Cloudflare avant l'origine et ne porte donc pas ce marqueur.

Les erreurs utilisent `application/problem+json`.

Une erreur doit contenir au minimum :

* type ou code stable ;
* titre ;
* statut HTTP ;
* détail compréhensible ;
* chemin ou identifiant de requête lorsque pertinent.

Ne jamais exposer :

* stack trace ;
* requête SQL ;
* secret ;
* token ;
* chemin système complet ;
* détail interne inutile.

### 5.4 DTO

Utiliser des DTO distincts pour :

* création ;
* mise à jour ;
* réponse publique ;
* réponse admin.

Les réponses publiques doivent être conçues explicitement pour éviter toute fuite de champ.

### 5.5 Transactions

Placer les transactions au niveau des services applicatifs.

Opérations obligatoirement atomiques :

* activation d’un message et désactivation du précédent ;
* activation d’une carte et désactivation de la précédente ;
* publication et mise à jour des états associés ;
* suppression contrôlée d’un média ;
* modification de la liste des administrateurs ;
* écriture d’une action critique et de son audit lorsque possible.

## 6. Authentification

### 6.1 Choix

* Cloudflare Access ;
* validation JWT Cloudflare Access ;
* session et cookie gérés par Cloudflare Access ;
* allowlist PostgreSQL.

### 6.2 Flux

```text
Navigateur
    │
    ├── accès protégé par Cloudflare Access
    ▼
Cloudflare Access
    │
    ├── JWT transmis à l'origine
    ▼
Spring Security
    │
    ├── vérifie signature, issuer, audience, exp et nbf
    ├── extrait l'email depuis le JWT validé
    ├── normalise l’email
    ├── consulte l’allowlist
    └── crée les autorités applicatives de la requête
```

### 6.3 Session Access

La session humaine est gérée par Cloudflare Access avant l'origine. Le backend ne fournit plus de flux `/login`, `/oauth2/**`, ni de client OAuth Google interne.

Cloudflare doit transmettre `Cf-Access-Jwt-Assertion` à l'origine. Le backend valide ce JWT pour chaque requête humaine protégée et ne doit jamais accepter un simple en-tête d'email falsifiable.

Ne pas transmettre de JWT au frontend pour ce MVP. Les logs et l’audit ne doivent pas conserver les claims complets.

### 6.4 CSRF

Maintenir la protection CSRF sur les opérations d’écriture.

Stratégie cible pour la SPA :

* aucune session applicative : l’identité provient du JWT Cloudflare validé à chaque requête, la politique de session Spring est `STATELESS` ;
* token CSRF transmis dans un cookie `XSRF-TOKEN` lisible par Angular ;
* envoi du token par le frontend dans l’en-tête `X-XSRF-TOKEN` pour les méthodes d’écriture ;
* les requêtes émises hors de `HttpClient` doivent poser ce jeton manuellement : c’est le cas du `DELETE` de départ Radar, envoyé par `fetch` pour survivre à la navigation ;
* renouvellement du token selon la configuration Spring Security ;
* erreur explicite et non verbeuse en cas de token absent ou invalide.

Ne pas désactiver globalement CSRF pour simplifier le développement.

### 6.5 CORS

En production, l’application doit fonctionner sous le même domaine public pour le frontend et l’API.

Le CORS doit donc être désactivé ou strictement limité aux origines explicitement configurées. Ne jamais utiliser une origine joker avec credentials.

## 7. PostgreSQL

### 7.1 Version

Utiliser PostgreSQL 18 et appliquer les mises à jour mineures maintenues.

### 7.2 Migrations

* Flyway ;
* une migration par changement cohérent ;
* migrations immuables après fusion ;
* nouvelle migration pour corriger une migration déjà partagée ;
* migrations testées sur une base vide ;
* migrations testées depuis la version précédente.

### 7.3 Identifiants

Utiliser des UUID pour les entités principales exposées dans les URLs ou l’API.

### 7.4 Dates

Utiliser des instants UTC en base.

Le fuseau `Europe/Paris` est une préférence d’affichage, pas un format de stockage.

### 7.5 Contraintes

Créer des contraintes pour :

* unicité des codes de quête ;
* unicité des emails normalisés ;
* cohérence des statuts ;
* références médias ;
* valeurs obligatoires.

Les règles « une seule carte active » et « un seul message actif » doivent être protégées par une transaction et, lorsque possible, par une contrainte ou un index adapté.

## 8. Médias

### 8.1 Cartes

Les cartes initiales peuvent être stockées dans :

```text
frontend/public/assets/maps/
```

La base référence un chemin d’asset connu ou une URL média interne `/media/{id}`.

Ne jamais accepter un chemin arbitraire depuis l’administration. Les chemins acceptés pour un fond de carte sont limités aux assets `/assets/maps/` en PNG, JPEG ou WebP et aux médias uploadés exposés via `/media/{id}`.

### 8.2 Médias uploadés

Répertoire logique de production :

```text
/var/lib/les-routes-oubliees/media/
```

Organisation possible :

```text
media/
├── group/
├── adventurers/
├── quests/
└── misc/
```

Le nom stocké est généré par le serveur.

Le nom original est uniquement une métadonnée.

### 8.3 Accès

Pour le MVP, servir les médias uploadés par une route backend contrôlée.

Règles :

* accès public uniquement par identifiant ou chemin logique validé ;
* filtrage selon la publication du contenu qui référence le média ;
* aucun accès statique direct au volume d’upload ;
* en-tête `X-Content-Type-Options: nosniff`;
* type MIME de réponse contrôlé par le serveur ;
* `Content-Disposition` défini explicitement lorsque nécessaire.

Interdire :

* exécution ;
* listing de répertoire ;
* remontée de chemin ;
* fichiers cachés ;
* types non autorisés.

## 9. Markdown

Stocker le Markdown en base.

Pipeline :

```text
Markdown source
    │
    ▼
Parseur avec HTML brut désactivé
    │
    ▼
Sanitation
    │
    ▼
HTML rendu
```

Pour le MVP, le backend est la source canonique du HTML nettoyé.

Règles :

* HTML brut désactivé dans le parseur Markdown ;
* sanitation côté backend avec allowlist stricte d’éléments, attributs et protocoles ;
* mêmes règles pour la prévisualisation admin et le rendu public ;
* les images Markdown peuvent recevoir un titre visible et une taille uniquement via une syntaxe contrôlée par le backend ;
* tests dédiés aux charges XSS, aux URL dangereuses et aux attributs d’événements ;
* aucun HTML non fiable ne doit être injecté par le frontend.

Ne pas utiliser une API de contournement de sécurité Angular.

## 10. Audit

L’audit est un journal d’actions, pas un historique complet.

Le service d’audit doit recevoir :

* acteur ;
* action ;
* type d’entité ;
* identifiant ;
* résumé non sensible ;
* instant.

Une panne d’audit ne doit pas être ignorée silencieusement pour une action critique.

## 11. Observabilité

Prévoir :

* logs structurés et lisibles ;
* identifiant de corrélation des requêtes ;
* endpoint de santé ;
* métriques minimales si nécessaires ;
* aucune donnée sensible dans les logs.

Spring Boot Actuator peut être utilisé pour la santé.

Les endpoints techniques doivent être limités au réseau local ou protégés.

## 12. Tests

### Backend

* services métier ;
* contrôleurs ;
* sécurité ;
* allowlist ;
* règles de publication ;
* migrations ;
* repositories PostgreSQL ;
* upload ;
* sanitation.

### Frontend

* composants ;
* formulaires ;
* navigation ;
* guards ;
* affichage conditionnel ;
* timer ;
* erreurs API ;
* responsive critique.

### End-to-end

Parcours prioritaires :

1. consultation publique ;
2. refus d’un admin non autorisé ;
3. accès admin autorisé ;
4. activation d’un message ;
5. activation d’une carte ;
6. révélation d’une quête ;
7. masquage d’une quête ;
8. création d’un aventurier ;
9. upload d’un média.

## 13. Documentation des décisions

Lorsqu’un choix majeur change, créer un ADR dans :

```text
docs/adr/
```

Format :

```text
NNNN-titre-court.md
```

Un ADR contient :

* contexte ;
* décision ;
* alternatives considérées ;
* conséquences ;
* statut.

Créer ce dossier uniquement lorsque la première décision structurante non couverte par ce document apparaît.
## Addendum 2026-08-05 - Authentification Cloudflare Access et Radar

L'administration et le module Radar sont protégés par Cloudflare Access en amont du reverse proxy.

Le backend valide le JWT reçu dans l'en-tête `Cf-Access-Jwt-Assertion` avant d'attribuer les rôles :

* `ROLE_USER` pour une identité humaine Access avec email validé par le JWT ;
* `ROLE_ADMIN` lorsque l'email normalisé est actif dans `admin_allowed_emails` ;
* `ROLE_HOME_ASSISTANT` pour le Bearer applicatif Home Assistant valide.

Les routes Spring OAuth2 internes `/oauth2/**` et `/login/**` ne font plus partie de l'architecture cible.

Nouveaux préfixes API :

```text
/api/portal
/api/radar
/api/integrations/home-assistant/radar
/api/admin/radar
/api/admin/portal-identities
```

Radar utilise SSE avec `SseEmitter`. Les positions des participants sont conservées uniquement en mémoire avec expiration courte. La position du trésor est stockée dans `radar_state`, mais n'est jamais exposée publiquement lorsque `treasure_visible=false`.

Radar est exclu du cache PWA, d'IndexedDB et du snapshot hors ligne.

### Cycle de vie des présences Radar

La géolocalisation est strictement limitée au composant `RadarPage` :

* le suivi `watchPosition()` démarre à l'ouverture de Radar, sur action de l'utilisateur, jamais au lancement de l'application ;
* aucune publication n'a lieu avant une première position valide ;
* la dernière position valide est republiée toutes les sept secondes, même sans nouveau relevé du navigateur, afin qu'un aventurier immobile reste visible ;
* un seul `PUT` est en vol à la fois, avec au plus une position en attente ;
* la destruction du composant marque immédiatement un état détruit, arrête le timer, appelle `clearWatch()`, ferme le SSE, annule le `PUT` en cours et vide la position en attente ; aucun callback tardif ni `finalize()` ne peut republier ;
* aucun suivi n'est déplacé dans un service global et aucune autre page ne demande de position.

Retrait de la présence :

* `DELETE /api/radar/me/location` retire la présence de l'utilisateur authentifié, sans accepter d'identifiant fourni par le client, de façon idempotente (`204 No Content`), et diffuse immédiatement un nouvel état SSE ;
* lors d'une navigation Angular normale hors de Radar, cette notification est envoyée après l'arrêt des publications, par une requête même origine détachée du composant (`keepalive`) ;
* cette notification n'est jamais garantie : fermeture brutale, perte réseau ou appareil éteint peuvent l'empêcher ;
* le TTL serveur d'environ 45 secondes est donc le filet de sécurité obligatoire. Un balayage périodique côté serveur retire les présences expirées et diffuse leur disparition, sans dépendre d'une nouvelle publication de position. La latence maximale de disparition est le TTL suivi de l'intervalle de balayage.

Deux invariants protègent ce cycle côté serveur :

* **La lecture n'expire rien.** `snapshot()` exclut les présences expirées de la vue renvoyée mais ne les supprime pas : la suppression et sa diffusion appartiennent au seul balayage périodique. Sans cela, une simple lecture pourrait consommer une expiration que personne n'aurait diffusée, et les clients déjà connectés conserveraient un repère disparu jusqu'à la publication suivante.
* **Le départ explicite prime pendant cinq secondes.** Le client annule sa publication en vol avant d'envoyer le `DELETE`, mais une annulation navigateur ne garantit pas que le serveur n'a pas déjà commencé à traiter la requête. Un départ mémorisé fait donc ignorer toute publication de la même identité pendant cinq secondes, et une position dont l'horodatage est antérieur à celle déjà connue n'est jamais appliquée. Conséquence assumée : un retour sur Radar dans cette fenêtre reste invisible aux autres participants jusqu'à la publication suivante.

Les diffusions SSE déclenchées par une écriture sont reportées après le commit de la transaction : un état construit à partir de données non validées ne doit jamais atteindre les abonnés.

Le releve tresor Home Assistant reste applique par une mise a jour atomique strictement temporelle : `204 No Content` lorsque la mesure est appliquee, `200 OK` avec `{"status":"ignored"}` lorsqu'elle n'est pas strictement plus recente. `202 Accepted` n'est pas utilise, la mise a jour n'etant jamais differee.

Depuis la protection Cloudflare Access globale, le service worker ne sert plus le shell Angular pour les navigations. Les navigations complètes doivent consulter le réseau afin que Cloudflare Access puisse intercepter une session absente ou expirée. Les assets restent pris en charge par la PWA, mais l'affichage hors ligne d'une nouvelle navigation est volontairement dégradé pour éviter qu'une page soit rendue depuis un cache local après déconnexion.
