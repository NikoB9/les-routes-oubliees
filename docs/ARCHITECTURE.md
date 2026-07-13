# Fichier : docs/ARCHITECTURE.md

# Architecture technique

## 1. Principes

L’architecture doit rester adaptée à un petit projet administrable, hébergé sur une seule machine virtuelle légère ou un conteneur LXC.

Principes :

* monolithe modulaire ;
* frontend Angular séparé du backend Spring Boot ;
* API REST ;
* base PostgreSQL unique ;
* session serveur ;
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
    ├── /oauth2/*                   │
    ├── /login/*                    ▼
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

### 4.4 Routage

Routes publiques :

```text
/
/map
/notebook
/notebook/:questCode
```

Routes admin :

```text
/admin/login
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

* Google OpenID Connect ;
* Spring Security OAuth2 Login ;
* session serveur ;
* cookie sécurisé ;
* allowlist PostgreSQL.

### 6.2 Flux

```text
Navigateur
    │
    ├── GET /oauth2/authorization/google
    ▼
Google
    │
    ├── callback OIDC
    ▼
Spring Security
    │
    ├── vérifie l’identité
    ├── vérifie email_verified
    ├── normalise l’email
    ├── consulte l’allowlist
    └── crée ou refuse la session
```

### 6.3 Session

Le cookie de session doit être :

* `HttpOnly`;
* `Secure` en production ;
* `SameSite=Lax` sauf besoin OIDC contraire documenté ;
* limité au domaine nécessaire ;
* renouvelé après authentification.

Ne pas transmettre de JWT au frontend pour ce MVP.

Les scopes Google doivent rester minimaux :

```text
openid email profile
```

Ne pas persister durablement les access tokens ou refresh tokens Google sauf besoin explicitement documenté. Les logs et l’audit ne doivent pas conserver les claims complets.

### 6.4 CSRF

Maintenir la protection CSRF sur les opérations d’écriture.

Stratégie cible pour la SPA :

* session serveur dans un cookie `HttpOnly`;
* token CSRF transmis dans un cookie `XSRF-TOKEN` lisible par Angular ;
* envoi du token par le frontend dans l’en-tête `X-XSRF-TOKEN` pour les méthodes d’écriture ;
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
