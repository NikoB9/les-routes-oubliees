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
* les medias uploades `/media/**` sont caches par le service worker : la condition posee a l'origine est remplie, `MediaService.publicMedia` refusant tout media qui n'est pas reference par un contenu actif et publie. Sans ce cache, l'instantane hors ligne arrivait complet mais toutes les images etaient cassees, y compris l'image de carte revelee ;
* une URL de media designant toujours le meme octet, le backend renvoie `private, max-age=31536000, immutable`, et le reverse proxy ne doit poser aucun `Cache-Control` sur ce chemin ;
* les medias references par l'instantane sont rapatries des son ecriture, sans attendre la visite de la page qui les porte : un aventurier parti sur le terrain sans avoir ouvert la Carte doit malgre tout la voir ;
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

`content-version` est interroge a chaque ouverture de l'application, uniquement pour savoir si l'instantane deja stocke est encore valable. Il ne reconstruit donc pas l'instantane : `PublicContentVersionCalculator` derive l'empreinte d'un `count(*)` et d'un `max(updated_at)` par table publique, en une seule requete. Le couple couvre l'insertion, la modification et la suppression, qu'un `max(updated_at)` seul manquerait.

Deux consequences assumees :

* l'agregation ne filtre pas la visibilite, donc une modification de brouillon invalide inutilement le cache d'un client. La charge utile etant petite, cette sur-invalidation est preferable a une sous-invalidation qui figerait un contenu perime hors ligne ;
* l'empreinte ne portant plus sur le rendu, une evolution du rendu Markdown ou de la forme des DTO ne suffirait plus a l'invalider. Une signature de build — `build-info.properties`, produit par le plugin Maven Spring Boot — est donc melangee a l'empreinte, ce qui force la mise a jour a chaque deploiement.

`/api/public/offline-snapshot` renvoie obligatoirement la version issue de cette meme source, et la calcule avant sa charge utile : deux sources distinctes ne coincideraient jamais et le client retelechargerait a chaque ouverture.

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

### 6.6 Contrat d'erreur

Toutes les erreurs d'API sont rendues en `application/problem+json` (RFC 9457) : `spring.mvc.problemdetails.enabled` couvre les refus métier et les erreurs de validation, le point d'entrée `401` produit le même format avec son marqueur `X-LRO-Auth-Error: application`, et un gestionnaire de dernier recours traduit toute exception imprévue en `500` au corps générique.

Deux règles à ne pas relâcher :

* le message d'une exception inattendue reste dans les journaux du serveur, jamais dans la réponse : il peut contenir une requête, un chemin ou une valeur de configuration ;
* ce gestionnaire porte volontairement la priorité la plus basse. Spring retient le premier `@ControllerAdvice` possédant une méthode compatible, sans comparer la précision entre plusieurs advices : un `@ExceptionHandler(Exception.class)` déclaré plus tôt capturerait aussi les erreurs de validation et détruirait leur détail.

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

Organisation :

```text
media/
├── group/
├── adventurers/
├── quests/     <- documents d'organisation (PDF), réservés à l'organisateur
└── misc/       <- images de la médiathèque
```

Le nom stocké est généré par le serveur.

Le nom original est uniquement une métadonnée.

#### Validation à l'entrée

Trois plafonds encadrent un téléversement. Deux réglages applicatifs les gouvernent — `MEDIA_MAX_UPLOAD_BYTES` pour les images, `QUEST_DOCUMENT_MAX_UPLOAD_BYTES` pour les documents d'organisation — et `UploadCeilingConfiguration` **dérive** de leur **maximum** celui du conteneur servlet, avec une marge pour le champ texte et les délimiteurs multipart. Le conteneur n'ayant qu'un réglage pour toutes les requêtes, retenir le minimum ferait rejeter par lui des fichiers que l'application accepte, et son refus arrive sans corps applicatif ; chaque endpoint applique ensuite le sien. Laissée à son défaut, cette limite du conteneur valait 1 Mio et rejetait toute photo de téléphone bien avant le plafond annoncé : ne jamais la reposer en parallèle, ce serait rouvrir l'écart. `client_max_body_size` côté Nginx doit rester au moins aussi permissif que le plus élevé des deux, faute de quoi le proxy refuse en premier sans passer par l'application.

Les dimensions sont lues **dans l'en-tête**, jamais par un décodage. `ImageIO.read` allouait `largeur × hauteur × 4` octets pour n'en retirer que deux entiers : PNG et JPEG atteignant des taux de compression extrêmes sur une image uniforme, un fichier de quelques mébioctets suffisait à réclamer plusieurs gibioctets et à emporter la JVM — donc le Radar en pleine partie. WebP était déjà lu ainsi ; les trois formats le sont désormais, et la surface annoncée est plafonnée à cinquante millions de pixels. Ce plafond ne protège plus le serveur, qui ne décode rien, mais les navigateurs qui afficheront le fichier.

Conséquence assumée : un fichier à l'en-tête valide mais au corps corrompu n'est plus détecté à l'entrée. Il ne s'affichera pas dans le navigateur, sans autre effet. La signature de format reste vérifiée octet par octet, ce qui continue de refuser un SVG déguisé en PNG.

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

#### Documents d'organisation des quêtes

Ces PDF ne passent **pas** par `/media/{id}` : cette route n'exige que `ROLE_USER`, donc tout aventurier authentifié par Cloudflare Access pourrait les lire en devinant un identifiant. Ils vivent sous `/api/admin/quest-tabs/{code}/documents`, couvert par `hasRole("ADMIN")`, l'interception de liste blanche et le jeton CSRF pour les écritures.

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/admin/quest-tabs/{code}/documents` | liste des documents de la quête |
| POST | `/api/admin/quest-tabs/{code}/documents` | dépôt, `multipart/form-data` : `file` et `label` |
| GET | `/api/admin/quest-tabs/{code}/documents/{id}/content` | diffusion du PDF |
| DELETE | `/api/admin/quest-tabs/{code}/documents/{id}` | suppression de la ligne et du fichier |

Le couple `(id, quest_id)` est toujours exigé : un document lu à travers le code d'une autre quête répond `404`, pour que l'URL ne mente jamais sur son contenu. La diffusion impose `application/pdf`, `nosniff` et `Cache-Control: no-store` — ce document décrit l'organisation d'une partie et n'a rien à laisser sur le poste consulté.

Le lien qui ouvre un document est une **navigation**, et le service worker arbitre les navigations avant le réseau : `navigationUrls` doit donc exclure `/api/**` (`frontend/ngsw-config.json`). Sans cette exclusion, la coquille applicative est servie depuis le cache à la place du PDF et l'organisateur voit « Page introuvable » — le motif `!/**/*.*` ne rattrape pas le cas, le dernier segment `content` ne portant aucun point. Toute route servie par le serveur et atteinte autrement que par `fetch` relève de la même règle.

Risque résiduel assumé : un PDF peut porter du JavaScript. Il est atténué par l'accès administrateur seul, le type imposé par le serveur, `nosniff` et la visionneuse native du navigateur. Ne pas ajouter d'en-tête `Content-Security-Policy: sandbox` sur cette réponse, il casserait l'affichage.

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

Ces diffusions n'écrivent rien elles-mêmes : **chaque flux possède sa file et son unique écrivain**, un thread virtuel, et diffuser se limite à un dépôt non bloquant dans chaque file. Une écriture SSE est bloquante : un client qui cesse de lire sans fermer sa connexion remplit le tampon réseau et immobilise le thread qui écrit. Tant que la diffusion partait du planificateur, un seul client dans cet état suspendait le balayage des présences, donc la diffusion des disparitions — exactement ce que le filet de sécurité doit garantir ; avec un exécuteur partagé à un seul thread, il retardait encore les instantanés de tous les autres. Un client bloqué ne retarde désormais que lui-même. Le thread virtuel est un choix : une écriture bloquée s'y gare au lieu d'occuper une place de pool, donc l'isolation ne dépend d'aucune taille de pool, et le nombre de threads reste borné par le nombre de flux ouverts.

Un seul écrivain par flux garantit l'ordre, y compris entre l'instantané initial d'un nouvel abonné et les diffusions qui le suivent. La file est bornée à 16 événements, soit environ 80 secondes de heartbeats : au-delà, le client est lâché plutôt que suivi indéfiniment. Un abandon silencieux le laisserait périmé sans qu'il le sache, alors qu'une fermeture le fait se reconnecter et recevoir un état frais. L'émetteur n'est jamais terminé depuis le diffuseur — `complete()` peut lui-même attendre le verrou d'écriture — mais par son propre écrivain, à son réveil.

Lâcher un client libère sa file et sa place au registre, **pas son thread** : l'écrivain reste bloqué dans l'écriture en cours jusqu'à ce qu'elle échoue. La durée de vie d'un écrivain bloqué est donc bornée par le premier intermédiaire qui cesse de lire, et non par l'application : le `send_timeout` de Nginx (60 secondes par défaut, non redéfini ici) borne le saut Nginx vers son client, lequel est Cloudflare en production, avec ses propres délais. Ce `send_timeout` reste à ce titre un garde-fou utile, alors même qu'il ne sert plus à protéger les autres participants.

Le flux direct suit l'entrée effective dans le Radar — la première position obtenue — et non la construction de la carte. Adossé au chemin de succès de `ensureMap()`, il disparaissait avec Leaflet : un fragment périmé après un redéploiement interrompait `handlePosition()` avant la republication, et l'aventurier ne recevait plus rien, ne publiait plus rien, sans qu'aucun message ne le lui dise. L'échec de chargement de la carte est désormais absorbé et signalé par une bannière ; la liste des positions relevées ne dépendant pas de Leaflet, le Radar reste utilisable. L'ouverture du flux est gardée par un drapeau levé **avant** la souscription et non par la souscription elle-même : un observable qui échoue de façon synchrone exécute son rappel d'erreur avant que `subscribe()` n'ait retourné, et un garde fondé sur la souscription serait réarmé par cette affectation tardive, bloquant définitivement la reprise programmée.

Côté client, le flux se rétablit seul. `EventSource` reconnecte de lui-même, sauf si le code appelle `close()`, ce qui annule définitivement ses tentatives : la fermeture n'a donc lieu qu'au désabonnement, à la destruction du composant. Une erreur dont l'état est `CONNECTING` est une coupure transitoire — bannière d'information et sondage de secours toutes les dix secondes, un tirage en échec ne tuant pas les suivants — et le direct reprend dès le premier événement reçu, ce qui arrête le sondage. Seul l'état `CLOSED`, réponse non conforme ou redirection Access, est définitif — et même celui-là ne condamne plus la session : le flux direct est réarmé une minute plus tard, le sondage couvrant l'intervalle. Conséquence : le recyclage de l'émetteur au bout d'une heure devient invisible, là où il faisait auparavant tomber tout client durablement présent en mode dégradé pour le reste de sa session.

Un premier instantané en échec rejoint le même état de réception dégradée, sondage compris, au lieu de laisser la page figée sur un bandeau sans relance. Ce bandeau ne parle que de **réception**. Ne plus recevoir l'état des autres et ne plus leur transmettre le sien sont deux pannes distinctes : une publication de position en échec lève son propre message, que le prochain instantané reçu n'efface pas et que seule une publication réussie referme.

Etant le seul chemin exempte de Cloudflare Access, donc la seule surface joignable depuis Internet sans identite, la publication Home Assistant est aussi la seule plafonnee en debit par le reverse proxy. Sans plafond, son jeton Bearer peut etre force indefiniment, et seule une ligne de journal par tentative en garderait trace. La cle de la zone `limit_req` est volontairement constante : derriere cloudflared toutes les requetes arrivent de `127.0.0.1`, une cle par adresse ne discriminerait rien, et un plafond global ne peut pas etre contourne par rotation d'adresse.

Le releve tresor Home Assistant reste applique par une mise a jour atomique strictement temporelle : `204 No Content` lorsque la mesure est appliquee, `200 OK` avec `{"status":"ignored"}` lorsqu'elle n'est pas strictement plus recente. `202 Accepted` n'est pas utilise, la mise a jour n'etant jamais differee.

### Navigations et service worker

Le service worker sert le shell Angular pour les navigations, **sauf** `/radar`, `/admin`, `/admin/**` et `/reconnexion`, et sauf les URL de fichiers. Cet arbitrage remplace une exclusion totale des navigations, qui rendait le mode hors ligne annoncé dans `PLAN_FINAL` entièrement inopérant : sans navigation servie, la coquille applicative ne se chargeait jamais et le snapshot de contenu public mis en cache restait inatteignable.

Ce que l'arbitrage préserve et ce qu'il concède :

* **Préservé** : `/radar` et `/admin` passent toujours par le réseau. Cloudflare Access peut donc intercepter une session absente ou expirée avant qu'une page sensible ne soit rendue, et aucune vue d'administration ni aucune position ne sort d'un cache local.
* **Rendu possible** : `/reconnexion` passe par le réseau pour la même raison, et n'existe que pour cela. Une reprise de session est une navigation qui doit atteindre Cloudflare ; servie depuis le cache, elle ne quitte pas le navigateur et ne déclenche aucune authentification. C'est ce qui rendait le lien « Se reconnecter » inerte sur toutes les pages publiques, alors qu'il fonctionnait depuis `/radar` — seule différence entre les deux : ce motif. La page ne fait que rebondir vers l'adresse consultée, portée par le paramètre `retour`.
* **Concédé** : les pages publiques — accueil, carte, carnet — se rechargent hors ligne, y compris après une déconnexion Cloudflare Access, avec le dernier contenu public synchronisé. Ce contenu est celui que tout aventurier authentifié voit déjà ; il reste néanmoins lisible sur l'appareil jusqu'à l'expiration du cache, fixée à 24 heures.

Les motifs sont figés par un test : voir `frontend/src/app/core/offline/ngsw-config.spec.ts`. Une erreur de motif ne casse aucun autre test et ne se voit qu'en navigateur, réseau coupé.
