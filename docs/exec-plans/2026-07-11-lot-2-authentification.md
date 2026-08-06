# Lot 2 - Authentification

> Note 2026-08-06 : ce plan historique a ete remplace par l'architecture Cloudflare Access du lot Radar. Les flux Spring OAuth2 internes et la deconnexion admin applicative ne font plus partie de la cible.

## Objectif

Brancher l'administration sur Google OpenID Connect avec une allowlist backend persistée en PostgreSQL.

Le lot couvre :

* login Google OIDC ;
* validation de l'email vérifié ;
* allowlist active en base ;
* amorçage initial depuis `ADMIN_BOOTSTRAP_EMAILS` ;
* session serveur ;
* protection backend des routes admin ;
* endpoint de session admin ;
* route Angular admin exploitable.

## Decisions

* Google reste le seul fournisseur OIDC du MVP.
* L'allowlist est stockée dans `admin_allowed_emails`.
* Les emails sont normalisés en minuscules après trim.
* L'amorçage ne s'exécute que si aucun admin actif n'existe.
* Le CRUD complet des administrateurs reste prévu dans un lot admin ultérieur.
* Angular ajoute un guard pour l'ergonomie, mais la sécurité reste exclusivement portée par le backend.

## Implementation

Backend :

* migration Flyway `V1__create_admin_allowed_emails.sql` ;
* entité, repository, service d'allowlist et bootstrap ;
* validation OIDC refusant email absent, non vérifié ou non autorisé ;
* `/api/admin/me` ;
* configuration Spring Security branchée sur le service OIDC admin.

Frontend :

* `AdminAuthService` ;
* guard admin ;
* page login avec message d'accès refusé ;
* shell admin affichant la session ;
* configuration Angular XSRF alignée sur le cookie `XSRF-TOKEN`.

## Validations

Executées :

* `docker run ... sh ./mvnw -B -DskipTests package` : OK ;
* `docker run ... sh ./mvnw -B -Dtest='fr.lesroutesoubliees.routesoubliees.auth.*Tests' test` : OK, 11 tests ;
* `docker run ... npm ci && npm run build` : OK ;
* `docker run ... npm ci && npm run lint` : OK après relance, le premier essai ayant expiré sur le réseau npm.

Limites :

* `./mvnw verify` complet n'a pas été lancé localement car le poste n'a pas Java 25 ;
* les tests Spring complets avec Testcontainers restent sensibles à l'environnement Docker imbriqué ;
* `npm ci` signale toujours 3 vulnérabilités faibles issues du socle Angular généré.
