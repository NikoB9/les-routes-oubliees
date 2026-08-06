# Finalisation sécurité, Radar et accessibilité

## Objectif

Corriger les huit domaines restants de l'audit du commit `fc19978` : secret Home Assistant, limite de corps réelle, JSON strict, statut de mesure tresor, JWT Cloudflare imposé à toutes les API humaines, cycle de vie Radar, distinction des `401`, accessibilité du menu de profil et des dialogues, isolation réseau et cohérence documentaire.

## Périmètre

Inclus :

* configuration et validation du secret Home Assistant ;
* filtre Bearer Home Assistant et limites Nginx du chemin exact ;
* `SecurityConfig`, point d'entrée `401` applicatif, identité de développement ;
* composant Radar Angular, service API Radar, registre de présence et heartbeat serveur ;
* intercepteur Cloudflare Access et service de session ;
* en-tête public et dialogues d'identité ;
* adresse d'écoute Spring, Compose, systemd, Nginx ;
* documentation `README.md`, `docs/` et `AGENTS.md`.

Hors périmètre :

* configuration Cloudflare distante (applications Access maintenues manuellement) ;
* déploiement et `push` ;
* refonte visuelle ;
* ajout de dépendance.

## Décisions structurantes

1. Toutes les routes `/api/**` humaines et `/media/**` exigent une identité Cloudflare valide. Spring ne laisse ouverts que `/`, `/error` et `/actuator/health`.
2. Une identité locale fictive est injectée uniquement sous le profil `dev`, afin de conserver un développement local utilisable. La validation de démarrage du profil `prod` échoue si le profil `dev` est actif simultanément.
3. Les `401` produits par l'application portent l'en-tête `X-LRO-Auth-Error: application` ; le frontend ne recharge la page que pour un `401` sans ce marqueur.
4. La publication Radar ne dépend plus de `document.visibilityState` : le heartbeat de sept secondes republie tant que le composant Radar est monté.
5. L'expiration des présences est balayée périodiquement côté serveur avec une horloge injectée, puis diffusée en SSE.
6. Les dialogues d'identité utilisent l'élément HTML `<dialog>` natif ; aucune bibliothèque ajoutée.

## Étapes

1. Rétablir le mode exécutable versionné de `backend/mvnw` et créer ce plan. Statut : fait.
2. Sécuriser le secret Home Assistant, la limite de corps, le JSON strict et le statut de mesure. Statut : fait.
3. Imposer le JWT Cloudflare à toutes les API humaines et ajouter le point d'entrée `401` marqué. Statut : fait.
4. Corriger le cycle de vie Radar, ajouter `DELETE /api/radar/me/location` et l'expiration serveur périodique. Statut : fait.
5. Distinguer `401` applicatif et expiration Access sans boucle de reconnexion. Statut : fait.
6. Terminer l'accessibilité du menu de profil et des dialogues. Statut : fait.
7. Rendre l'adresse d'écoute configurable et documenter les deux topologies. Statut : fait.
8. Nettoyer les contradictions documentaires. Statut : fait.
9. Exécuter les validations et relire le diff. Statut : fait.

## Limites d'environnement rencontrées

* Le miroir Maven configuré dans `~/.m2/settings.xml` (`kleeIntegration`) est injoignable hors réseau d'entreprise et mirroir `central`. Les tests backend ont donc été exécutés avec un fichier `settings.xml` temporaire sans miroir, hors dépôt. Aucun fichier du projet n'a été modifié pour cela.
* `JAVA_HOME` pointe sur un JDK 17 alors que le projet exige Java 25 ; les commandes Maven ont été lancées avec `JAVA_HOME` positionné sur un JDK 25 déjà présent sur le poste.
* Node.js installé (v22.12.0) est inférieur au minimum exigé par la CLI Angular 22 (v22.22.3). Pour exécuter `ng test`, `ng build` et `ng serve`, le contrôle de version de `node_modules/@angular/cli` a été temporairement assoupli, puis restauré à l'identique. `node_modules` n'est pas versionné. La mise à niveau de Node reste une action à réaliser sur le poste.
* `HTMLDialogElement.showModal()` et `close()` ne sont pas implémentés par jsdom : le composant conserve une solution de repli sur l'attribut `open`, et les tests vérifient l'état observable. Le confinement réel du focus et l'inertie de l'arrière-plan ne sont donc validés qu'en navigateur.

## Risques

* Le passage de `/api/public/**` en accès authentifié impacte les tests d'intégration publics et la navigation locale.
* L'identité de développement doit rester strictement limitée au profil `dev`.
* Les tests backend exigent Java 25 et Docker pour Testcontainers.
* Le support de `HTMLDialogElement.showModal()` par jsdom conditionne certaines assertions de tests.
* Le `DELETE` de départ envoyé par `fetch` doit porter manuellement le jeton CSRF, contrairement à `HttpClient`.

## Validations prévues

* `git diff --check` ;
* `npm ci`, `npm run lint`, `npm test -- --watch=false`, `npm run build` ;
* `./mvnw test` avec un JDK 25 ;
* `docker compose config` ;
* `npm run test:a11y` si Playwright est installable ;
* `npm audit --omit=dev` à titre informatif.

## Critères de validation

* Aucun secret Home Assistant connu ou facultatif en production.
* Corps Home Assistant réellement limité à 4096 octets sans dépendre de `Content-Length`.
* Propriété JSON inconnue refusée par un test HTTP réel.
* Mesure appliquée et mesure ignorée distinguables sans exposer la position.
* Toutes les API humaines refusent une requête sans JWT Cloudflare valide.
* Aucune géolocalisation hors Radar, aucune publication après destruction.
* Sortie normale retirant immédiatement le repère, TTL serveur diffusé sans nouvelle position.
* `401` applicatif distingué d'une expiration Access, sans boucle de rechargement.
* Menu de profil et dialogues conformes au clavier et au focus.
* Spring non exposé directement, documentation sans contradiction.
