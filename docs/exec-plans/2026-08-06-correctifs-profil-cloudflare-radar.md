# Correctifs Profil, Cloudflare Access, Radar et Home Assistant

## Objectif

Corriger les points restants du lot Radar : ergonomie du menu profil, verrouillage Cloudflare Access et Home Assistant, publication Radar sans concurrence inutile, mise a jour atomique du tresor, documentation de deploiement coherente et exposition locale du backend.

## Perimetre

Inclus :

* header public et tests associes ;
* securite Spring pour `/api/integrations/**`, Cloudflare Access et roles ;
* filtre Bearer Home Assistant ;
* service Radar et tests d'integration ;
* composant Radar Angular et tests ;
* documentation de deploiement, plan Radar et Compose local.

Hors perimetre :

* modification de configuration Cloudflare en production ;
* deploiement serveur ;
* refonte visuelle Radar ;
* changement de fournisseur de tuiles.

## Etapes

1. Inspecter l'etat courant et les sources de verite. Statut : fait.
2. Corriger le menu profil public et ses tests. Statut : fait.
3. Durcir les autorisations backend et le Bearer Home Assistant. Statut : fait.
4. Rendre la mise a jour tresor atomique et completer les tests. Statut : fait.
5. Ajouter le verrou de publication Radar cote frontend et couvrir les cas de destruction/erreur. Statut : fait.
6. Corriger Compose et la documentation Cloudflare/PWA. Statut : fait.
7. Executer les validations pertinentes et relire le diff. Statut : fait.

## Risques

* Les tests backend avec Testcontainers peuvent dependre de Docker local.
* Les controles frontend peuvent etre sensibles a l'environnement Node installe.
* Les changements Cloudflare restent manuels hors depot et devront etre verifies apres deploiement.

## Validations prevues

* `git diff --check`
* verification JSON de `frontend/package-lock.json`
* `npm run lint`
* `npm test -- --watch=false`
* `npm run build`
* `mvnw test`
* `mvnw verify` si Docker/Testcontainers est disponible

## Criteres de validation

* Le menu profil se ferme au clic exterieur et avec `Escape`.
* Le lien de deconnexion pointe vers `/cdn-cgi/access/logout`.
* Seul le `POST` exact Home Assistant peut utiliser le Bearer applicatif.
* Les chemins voisins `/api/integrations/**` restent fermes.
* Les releves tresor anciens ou concurrents ne provoquent pas de broadcast.
* La publication de position Radar cote navigateur ne lance pas plusieurs `PUT` simultanes.
* Les docs Cloudflare ne mentionnent plus de second tunnel, service token, audience separee ou protection partielle contradictoire.
