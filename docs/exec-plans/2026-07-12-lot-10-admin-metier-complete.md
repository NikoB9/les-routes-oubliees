# Lot 10 - Accueil administrable

## Objectif

Completer l'administration de la page d'accueil et de ses contenus associes apres le lot 9.

## Perimetre

- Frontend admin : ecrans de gestion des parchemins, de la Compagnie et des aventuriers, avec navigation fiable et etats accessibles.
- Backend admin : endpoints manquants pour la configuration de l'accueil, validations et tests associes.
- Qualite : tests d'integration, tests frontend et parcours critiques.

## Hors perimetre

- Carte, bloc-notes, parametres du site.
- Versioning complet des contenus.
- Rollback editorial.
- Roles fins et workflow d'approbation.
- Chat, Telegram, notifications et temps reel.

## Risques

- Exposer des contenus de brouillon dans l'API publique.
- Ajouter des ecrans administratifs sans etats vide, erreur ou accessibilite correcte.
- Coupler la publication d'un contenu avec sa simple edition.

## Plan

1. [x] Cartographier les modules d'accueil a administrer et leurs points d'entree actuels.
2. [x] Definir les endpoints backend pour les parchemins, la Compagnie et les aventuriers.
3. [x] Ajouter ou corriger les ecrans admin et les formulaires associes.
4. [x] Stabiliser les donnees de demo et les regles de publication.
5. [x] Ajouter et executer les tests backend et frontend pertinents.
6. [x] Relire le diff final et documenter les limites restantes si besoin.

## Criteres de validation

- L'accueil est administrable de bout en bout.
- La Compagnie est administrable de bout en bout.
- Les aventuriers sont administrables de bout en bout.
- Les contenus de demo restent conformes au rendu public.
- Les tests pertinents passent et le lot est pret a etre publie.

## Avancement du 2026-07-12

### Livre

- API admin des parchemins d'accueil : liste, creation, modification, activation et suppression protegee.
- API admin de la Compagnie : lecture et mise a jour du profil actif.
- API admin des aventuriers : liste, creation, modification, suppression et reordonnancement.
- Interface admin integree dans le shell existant pour les trois domaines.
- Navigation admin corrigee vers les sections internes au lieu de retours accueil.
- Regles metier preservees : un seul parchemin actif, activation reservee aux contenus publies, ordre des aventuriers gere par reordonnancement.

### Validations executees

- `npm run lint && npm run build` dans le conteneur frontend : succes.
- `npm test -- --watch=false` dans le conteneur frontend : 14 tests passes.
- `./mvnw -B -Dtest=fr.lesroutesoubliees.routesoubliees.home.AdminHomeAdministrationIntegrationTests test` avec PostgreSQL Testcontainers : 3 tests passes.
- `./mvnw -B -DskipTests package` dans le conteneur backend : succes.

### Limites restantes

- La carte administrable est reportee au lot suivant.
- L'editeur riche des quetes est reporte au lot dedie au carnet/quetes.
- Les parametres globaux du site restent hors perimetre de ce lot.

### Notes d'execution pour les prochains lots

- Sous Windows/PowerShell, privilegier les commandes Docker deja validees depuis la racine du depot avec `${PWD}` :
  - frontend : `docker run --rm -v "${PWD}\frontend:/workspace" -v lro_frontend_node_modules:/workspace/node_modules -w /workspace node:24.15.0-bookworm sh -lc "npm run lint && npm run build"`;
  - tests frontend : `docker run --rm -v "${PWD}\frontend:/workspace" -v lro_frontend_node_modules:/workspace/node_modules -w /workspace node:24.15.0-bookworm sh -lc "npm test -- --watch=false"`;
  - backend package : `docker run --rm -v "${PWD}\backend:/workspace" -v lro_m2:/root/.m2 -w /workspace eclipse-temurin:25-jdk sh -lc "sh ./mvnw -B -DskipTests package"`.
- Toujours monter les caches `lro_frontend_node_modules` et `lro_m2` pour eviter les telechargements complets et les timeouts.
- Les tests backend avec Testcontainers lances depuis un conteneur Maven sous Docker Desktop Windows doivent utiliser :
  `-e TESTCONTAINERS_RYUK_DISABLED=true -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal -v /var/run/docker.sock:/var/run/docker.sock`.
- Quand Ryuk est desactive, verifier `docker ps` apres les tests et arreter les conteneurs `org.testcontainers=true` restes actifs.
- Les validations backend peuvent depasser 10 minutes sur Docker Desktop. Preferer un timeout outil d'au moins 600000 ms, puis lire `docker logs` et les rapports `backend/target/surefire-reports` avant de relancer.
- Si `rg` n'est pas disponible sur la machine, utiliser `Get-ChildItem ... | Select-String ...` en excluant `target/`, `dist/` et `node_modules` pour eviter des recherches lentes ou des sorties binaires.
