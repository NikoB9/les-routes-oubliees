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

## Corrections issues de la revue externe

Revue du commit `5d0b320`. Sept écarts confirmés et corrigés, un écart non retenu.

1. **Expiration réellement diffusée.** `RadarPresenceRegistry.snapshot()` devient une lecture sans effet de bord : les présences expirées sont exclues de la vue mais ne sont plus supprimées. `pruneExpired()`, appelé par le seul balayage périodique, reste l'unique point de suppression et compte les retraits par `remove(cle, valeur)` atomique. Une lecture ne peut donc plus consommer une expiration que personne n'aurait diffusée.
2. **Course `PUT`/`DELETE` fermée côté serveur.** Un départ mémorisé fait ignorer toute publication de la même identité pendant cinq secondes, et une position dont l'horodatage est antérieur à celle déjà connue n'est jamais appliquée. L'égalité d'horodatage reste acceptée, sans quoi le heartbeat de sept secondes — qui republie volontairement la même position — ferait expirer un aventurier immobile. Conséquence assumée : un retour sur Radar dans les cinq secondes reste invisible aux autres jusqu'à la publication suivante.
3. **Profil et adresse réellement imposés.** `EnvironmentFile=` prime sur `Environment=` en systemd : les deux valeurs passent en arguments de programme dans `ExecStart`, source de propriétés la plus prioritaire de Spring Boot. Le fichier d'environnement ne porte plus que les secrets et la base.
4. **Diffusion SSE après commit.** `RadarService.broadcast()` reporte la diffusion après le commit lorsqu'une transaction est active : un rollback ne peut plus laisser d'état fantôme chez les abonnés. `RadarPresenceIntegrationTests` perd son `@Transactional` de classe, sans quoi aucune diffusion ne serait observable, et nettoie ses données explicitement.
5. **Anti-boucle sans `sessionStorage`.** Un verrou mémoire complète le verrou `sessionStorage` : si le stockage est indisponible, un seul rechargement reste tenté avant l'affichage de l'action de reconnexion.
6. **Identité de développement utilisable.** Le stub reprend la première adresse d'amorçage administrateur, donc l'administration est accessible en local. C'est toujours l'allowlist qui décide du rôle, ce que couvre un test dédié.
7. **Sources de vérité.** `docs/PLAN_FINAL.md` et `docs/ARCHITECTURE.md` ne mentionnent plus de session serveur ni un périmètre Access limité à Radar et à l'administration.

Écart non retenu : « tests backend critiques non confirmés ». Les 106 tests backend et les 68 tests frontend ont bien été exécutés et sont verts sur le poste de développement. Le manque réel était l'absence de preuve reproductible, comblé par l'ajout de `.github/workflows/ci.yml`.

Les quatre tests de régression ajoutés ont été vérifiés en échec sur les sources du commit `5d0b320` avant correction, les neuf tests de présence préexistants restant verts.

## Audit du commit `e2b7bc9`

Audit complet rejoué après publication de la branche. Un écart réel trouvé, corrigé, et mesuré avant/après.

**En-têtes de sécurité Nginx perdus sur tous les documents HTML.** `add_header` n'est hérité du niveau supérieur que si l'emplacement courant n'en déclare aucun. Les emplacements posant leur propre `Cache-Control` annulaient donc les quatre en-têtes du niveau `server`, et `try_files` redirigeant en interne toutes les routes de la SPA vers `location = /index.html`, aucune page ne recevait de CSP. Mesuré dans un conteneur `nginx:alpine` sur les deux exemples de configuration : `/`, `/radar` et `/index.html` sans `Content-Security-Policy`, `Permissions-Policy` ni `X-Content-Type-Options` avant correction ; les quatre en-têtes présents après, `Cache-Control: no-store` conservé, `nginx -t` valide.

Observations conservées sans correction, car sans conséquence exploitable :

* la vérification du départ et l'écriture de la présence ne sont pas atomiques entre les deux cartes de `RadarPresenceRegistry` : un `DELETE` intercalé entre les deux laisserait un repère jusqu'au TTL, sur une fenêtre de quelques nanosecondes et pour la seule identité concernée ;
* un refus de géolocalisation en cours de session arrête les publications sans annoncer de départ : la disparition attend le TTL ;
* `initials()` n'échappe pas son résultat, contrairement à `avatarPath` : au plus deux caractères, premières lettres de mots, valeurs issues de l'administration ;
* la topologie conteneur proxifie `/actuator` sans restriction d'adresse, là où l'exemple de production le limite au loopback : Spring n'expose que `health`, le reste tombe sur `anyRequest().denyAll()`.

## Correction des points de l'audit

Neuf points traités après l'audit de `471d307`. Aucune dépendance ajoutée.

1. **Mode hors ligne.** `"!/**"` annulait toute navigation et `/index.html` n'était dans aucun groupe d'actifs : la coquille applicative n'était jamais servie ni mise en cache. Les motifs excluent désormais les URL de fichiers, `/radar`, `/admin` et `/admin/**`, et le document est caché. **Point d'attention** : `ARCHITECTURE.md` documentait l'exclusion totale comme un choix de sécurité, pour éviter qu'une page soit rendue depuis un cache local après déconnexion. L'arbitrage retenu conserve cette garantie pour Radar et l'administration, et la concède pour les pages publiques. La section correspondante a été réécrite pour énoncer ce qui est préservé et ce qui est concédé.
2. **Contrat d'erreur unique.** `spring.mvc.problemdetails.enabled` rend les refus métier et les erreurs de validation en `application/problem+json`, format déjà utilisé par le point d'entrée `401`. Les motifs soignés côté serveur parvenaient jusque-là au client vidés de leur détail. `ApiExceptionHandler` complète le dispositif : `500` générique pour l'imprévu, message d'exception conservé dans les journaux seulement, déconnexion SSE traitée en `DEBUG`, refus d'accès relancé pour rester traduit par Spring Security. Sa priorité est volontairement la plus basse : Spring retient le premier advice compatible sans comparer la précision, donc un `@ExceptionHandler(Exception.class)` déclaré plus tôt aurait détruit le détail des erreurs de validation.
3. **Journalisation.** Refus Home Assistant en `WARN` avec la seule catégorie du motif — jamais le jeton ni le corps ; retrait d'un flux SSE et abandon de file en `DEBUG`/`WARN` ; balayage en `DEBUG` ; attribution d'identité en `INFO` avec l'UUID et le mode d'accès, sans adresse. Le point d'entrée Home Assistant, seul chemin hors Cloudflare Access, était totalement silencieux.
4. **Garde-fous du compilateur.** `strict` et `strictTemplates` activés dans `frontend/tsconfig.json`, à coût nul : le code compilait déjà sous ces options. `resolveJsonModule` ajouté pour que le test du manifeste lise la configuration sans dépendance de types Node.
5. **Diffusion SSE.** Pool du planificateur à 4 et exécuteur dédié à un seul thread, file bornée à 64 abandonnant le plus ancien instantané. Une écriture bloquée ne peut plus figer le balayage ni un thread de requête. Résidu documenté dans `ARCHITECTURE.md`.
6. **Couverture.** Nouvelles suites : `portal-identity.store` (le seul appelant du verrou anti-boucle), `radar-api.service` (départ `keepalive` et jeton CSRF manuel), `admin-auth.guard`, `RadarEventBroadcaster`, `ApiExceptionHandler`, et une première couverture HTTP des réglages Radar de l'administration, jusque-là absente.
7. **`treasure_visibility_updated_by`.** La colonne recevait `null` en dur. `PortalIdentityService.findIdentityId` la renseigne, en restant tolérante à un administrateur sans identité portail — cas couvert par un test, `audit_logs` demeurant la trace de référence.
8. **`aria-controls`.** Le panneau de profil reste dans le document, masqué par `hidden`, afin que l'attribut désigne un élément existant. Une règle `.profile-panel[hidden]` est nécessaire : le `display: grid` du panneau l'emporterait sinon sur le `display: none` de `hidden`.
9. **Départ sur refus de géolocalisation.** La permission perdue est définitive : le départ est annoncé immédiatement au lieu d'attendre le TTL de 45 secondes, sans jamais émettre deux départs. Messages d'erreur d'administration traduits en français, désormais visibles côté client.

Validations : 121 tests backend, 95 tests frontend, 3 tests axe, lint, build, `docker compose --profile app config`, `npm audit --omit=dev` à 0, `git diff --check` propre. Manifeste généré vérifié : navigation autorisée hors fichiers, `/radar` et `/admin` exclus, `/index.html` présent dans le cache.

### Régression introduite par le correctif SSE, puis corrigée

L'exécuteur de diffusion avait d'abord été déclaré comme bean de type `Executor`. Or Spring Boot ne crée son `applicationTaskExecutor` que si le contexte n'en déclare aucun : la condition `OnExecutorCondition` combine `@ConditionalOnMissingBean(Executor.class)` et `spring.task.execution.mode=force` — vérifié dans le bytecode de `spring-boot-autoconfigure` 4.1.0. Ce bean supprimait donc silencieusement l'exécuteur de tâches applicatif, et le traitement asynchrone de Spring MVC, dont les flux SSE eux-mêmes, retombait sur un exécuteur créant un thread par requête sans limite.

`RadarEventBroadcaster` possède désormais son exécuteur au lieu de l'injecter, via la fabrique `RadarDeliveryExecutor`, et le libère par `DisposableBean`. Aucun bean `Executor` n'existe plus dans le contexte. `RoutesOublieesApplicationTests` fige le garde-fou en vérifiant la présence d'`applicationTaskExecutor` ; ce test a été constaté en échec sur le commit `bc32474` avant correction.

## Intégration continue

`.github/workflows/ci.yml` rejoue à chaque `push` et `pull request` : lint, tests et build frontend sur Node 24, puis `./mvnw --batch-mode test` sur Temurin 25 avec Testcontainers. Playwright reste hors CI (téléchargement de navigateur) et documenté pour une exécution locale.

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
