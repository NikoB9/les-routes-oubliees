# AGENTS.md

## 1. Mission

Développer et maintenir l’application **Les Routes Oubliées** conformément aux spécifications présentes dans le dossier `docs/`.

L’application est une plateforme web immersive permettant à une compagnie d’aventuriers de suivre une histoire, de consulter les informations de la quête actuelle, d’explorer une carte révélée progressivement et de lire le carnet des quêtes accomplies.

Le projet doit rester :

* sécurisé ;
* accessible ;
* responsive ;
* simple à administrer ;
* maintenable ;
* documenté ;
* raisonnablement léger pour un hébergement dans un conteneur Proxmox LXC.

## 2. Sources de vérité

Avant toute modification, lire les documents pertinents dans cet ordre :

1. la demande explicite de la tâche en cours ;
2. `docs/PLAN_FINAL.md` pour les besoins fonctionnels ;
3. `docs/ARCHITECTURE.md` pour les décisions techniques ;
4. `docs/ACCESSIBILITE.md` pour les exigences d’accessibilité ;
5. `docs/DEPLOIEMENT.md` pour les contraintes d’exploitation ;
6. `README.md` pour la présentation et les commandes destinées aux contributeurs.

En cas de contradiction :

* la demande explicite de la tâche prévaut ;
* les exigences de sécurité et d’accessibilité ne doivent pas être affaiblies implicitement ;
* ne pas modifier silencieusement une règle métier ;
* consigner toute décision structurante dans la documentation appropriée.

`docs/PLAN_FINAL.md` est la source de vérité fonctionnelle. Ne pas en changer le sens sans demande explicite.

## 3. Stack imposée

### Frontend

* Angular 22.x ;
* TypeScript en mode strict ;
* composants standalone ;
* Angular Router ;
* formulaires réactifs ;
* Angular Signals lorsque cela simplifie réellement l’état local ;
* HTML sémantique ;
* CSS responsive ;
* npm comme gestionnaire de paquets.

### Backend

* Java 25 LTS ;
* Spring Boot 4.1.x ;
* Maven Wrapper ;
* Spring Web ;
* Spring Security ;
* OAuth2 Login / OpenID Connect avec Google ;
* Spring Data JPA ;
* Bean Validation ;
* Flyway ;
* PostgreSQL.

### Base de données

* PostgreSQL 18 sur une version mineure maintenue ;
* migrations exclusivement gérées par Flyway ;
* aucune modification manuelle du schéma de production ;
* aucune dépendance à H2 pour valider un comportement spécifique à PostgreSQL.

### Tests

* tests unitaires et d’intégration Java avec les outils du socle Spring ;
* tests PostgreSQL avec Testcontainers lorsque la couche de persistance est concernée ;
* tests frontend avec les outils officiellement configurés dans le projet ;
* tests end-to-end avec Playwright lorsque les parcours critiques existent ;
* contrôles d’accessibilité automatisés complétés par des vérifications manuelles.

## 4. Mode de travail obligatoire

### 4.1 Avant de coder

Toujours :

1. lire les documents applicables ;
2. examiner l’arborescence du dépôt ;
3. exécuter `git status`;
4. identifier les modifications déjà présentes ;
5. préserver les changements de l’utilisateur ;
6. reformuler en interne l’objectif, le périmètre et les critères d’acceptation ;
7. vérifier si la tâche dépend d’un lot précédent.

Ne jamais supprimer, écraser ou réinitialiser des modifications existantes sans instruction explicite.

### 4.2 Taille des tâches

Pour une petite correction localisée :

* inspecter ;
* modifier ;
* tester ;
* relire ;
* résumer.

Pour une fonctionnalité complexe, un nouveau lot, une migration importante ou une modification touchant plusieurs couches :

* créer ou mettre à jour un plan d’exécution dans `docs/exec-plans/`;
* utiliser un fichier nommé `YYYY-MM-DD-nom-du-lot.md`;
* définir les étapes, risques, tests et critères de validation ;
* maintenir ce plan à jour pendant l’exécution ;
* ne pas élargir silencieusement le périmètre.

Créer le dossier `docs/exec-plans/` lors du premier besoin.

### 4.3 Principe de simplicité

Toujours choisir la solution la plus simple qui satisfait :

* le besoin fonctionnel ;
* la sécurité ;
* l’accessibilité ;
* la maintenabilité ;
* les contraintes de déploiement.

Ne pas introduire :

* de microservices ;
* de bus de messages ;
* de cache distribué ;
* de moteur de règles ;
* de Kubernetes ;
* d’architecture événementielle ;
* de versioning complet des contenus ;
* de dépendance lourde sans besoin démontré.

## 5. Orchestration multi-agent

Le fil principal agit comme **orchestrateur et intégrateur**.

Il conserve la responsabilité de :

* comprendre le besoin global ;
* découper le travail ;
* attribuer des périmètres non conflictuels ;
* consolider les résultats ;
* résoudre les divergences ;
* lancer les validations finales ;
* produire le compte rendu final.

### 5.1 Quand déléguer

Utiliser des sous-agents lorsque le travail peut réellement être parallélisé, par exemple :

* exploration indépendante du frontend et du backend ;
* revue de sécurité ;
* revue d’accessibilité ;
* conception des tests ;
* analyse d’une migration ;
* revue finale d’un lot terminé.

Ne pas créer de sous-agent pour une modification triviale.

### 5.2 Rôles disponibles

Selon la tâche, déléguer à un ou plusieurs rôles :

#### Architecte

Responsabilités :

* vérifier la cohérence avec `docs/ARCHITECTURE.md`;
* identifier les dépendances entre lots ;
* repérer la complexité accidentelle ;
* proposer une solution minimale et durable.

#### Backend

Responsabilités :

* API REST ;
* logique métier ;
* authentification et autorisations ;
* persistance ;
* migrations Flyway ;
* validation serveur ;
* tests backend.

#### Frontend

Responsabilités :

* composants Angular ;
* navigation ;
* formulaires ;
* intégration API ;
* responsive ;
* gestion des états de chargement, vide et erreur ;
* tests frontend.

#### Sécurité

Responsabilités :

* contrôle d’accès ;
* OIDC ;
* sessions ;
* CSRF ;
* uploads ;
* secrets ;
* sanitation des contenus ;
* exposition des endpoints ;
* recherche de régressions de sécurité.

#### Accessibilité

Responsabilités :

* sémantique HTML ;
* navigation clavier ;
* focus ;
* contrastes ;
* formulaires ;
* onglets ;
* compte à rebours ;
* textes alternatifs ;
* compatibilité avec les technologies d’assistance.

#### Qualité et tests

Responsabilités :

* critères d’acceptation ;
* tests unitaires ;
* tests d’intégration ;
* tests end-to-end ;
* cas limites ;
* analyse des échecs ;
* revue des modifications.

#### Documentation

Responsabilités :

* README ;
* documentation d’architecture ;
* documentation d’exploitation ;
* commentaires nécessaires ;
* exemples de configuration ;
* suppression de la documentation obsolète.

### 5.3 Règles de délégation

Chaque sous-agent doit recevoir :

* un objectif précis ;
* un périmètre limité ;
* les fichiers ou dossiers concernés ;
* les contraintes applicables ;
* les éléments à ne pas modifier ;
* le format du livrable ;
* les critères indiquant que le travail est terminé.

Modèle minimal de délégation :

```text
Objectif :
Périmètre :
Fichiers autorisés :
Fichiers interdits :
Contraintes :
Livrable attendu :
Validations à exécuter :
Critères de fin :
```

Un agent de revue en lecture seule doit indiquer explicitement qu’il n’a modifié aucun fichier.

Éviter que plusieurs agents modifient simultanément les mêmes fichiers.

Préférer :

* des sous-agents d’analyse en lecture seule ;
* ou des périmètres d’écriture clairement séparés.

Le fil principal doit attendre les résultats nécessaires, les comparer et produire une intégration cohérente.

Un résultat de sous-agent n’est jamais accepté aveuglément. Il doit être relu et validé.

### 5.4 Revues obligatoires

Pour tout lot significatif, effectuer au minimum :

* une revue de cohérence ;
* une revue des tests ;
* une revue de sécurité si le lot touche l’authentification, les données, les uploads ou l’API ;
* une revue d’accessibilité si le lot modifie l’interface.

### 5.5 Routage des modèles et maîtrise du coût

Pour réduire le coût sans dégrader la qualité, utiliser une répartition explicite des tâches entre un modèle principal et un modèle économique lorsque l’environnement le permet.

Le modèle principal conserve les responsabilités suivantes :

* compréhension du besoin ;
* conception ;
* architecture ;
* arbitrages de sécurité, accessibilité et données ;
* modifications de code non triviales ;
* résolution d’erreurs ambiguës ;
* validation finale avant commit ou déploiement.

Un modèle économique ou mini peut être utilisé pour les tâches mécaniques ou bornées :

* lecture et synthèse de sorties Docker, Maven, npm, Playwright ou systemd ;
* extraction des lignes d’erreur pertinentes ;
* classification d’un échec connu ;
* vérification de statut Git ;
* préparation de comptes rendus factuels ;
* suivi de commandes déterministes déjà définies.

Rebasculer vers le modèle principal dès qu’une tâche exige :

* une modification de code ;
* un choix entre plusieurs causes plausibles ;
* une décision de conception ;
* une analyse de sécurité ou d’accessibilité ;
* une interprétation métier ;
* un échec de migration, d’authentification, d’upload, de publication ou de déploiement.

Les actions critiques restent pilotées par des scripts et vérifiées par le fil principal :

* les tests ne sont jamais déclarés réussis sans sortie de commande réelle ;
* un commit n’est créé qu’après relecture du diff et validations applicables ;
* un déploiement n’est lancé qu’à partir d’un commit cohérent et d’une archive validée ;
* le modèle économique ne décide pas seul de pousser, déployer, ignorer un test ou accepter une régression.

Pour limiter les tokens, les sous-agents et analyses mécaniques doivent recevoir un contexte court :

* objectif précis ;
* fichiers ou commande concernés ;
* extrait de log limité ;
* format de réponse attendu ;
* critère clair de rebascule vers le modèle principal.

## 6. Règles Git

* Ne jamais travailler directement sur `main`.
* Préserver l’historique existant.
* Ne jamais utiliser `git reset --hard`.
* Ne jamais utiliser `git clean -fd` sans instruction explicite.
* Ne jamais forcer un push.
* Ne jamais modifier les remotes Git sans instruction explicite.
* Ne jamais fusionner une branche dans `main` automatiquement.
* Ne jamais pousser vers GitHub sans instruction explicite.

Les commits locaux sont autorisés sur une branche de travail lorsque :

* le lot est dans un état cohérent ;
* les validations applicables ont réussi ;
* le message respecte Conventional Commits.

Exemples :

```text
feat(home): add active parchment message
fix(auth): reject unverified Google accounts
test(quest): cover public visibility rules
docs(deployment): document backup procedure
chore(frontend): configure linting
```

Ne pas mélanger plusieurs sujets sans rapport dans un même commit.

## 7. Règles de dépendances

Avant d’ajouter une dépendance :

1. vérifier qu’elle répond à un besoin réel ;
2. vérifier qu’une fonctionnalité native ne suffit pas ;
3. vérifier qu’elle est maintenue et compatible avec la stack ;
4. vérifier sa licence ;
5. évaluer son impact de sécurité et de poids ;
6. documenter la raison de son ajout.

Ne pas utiliser de composant, d’API ou de méthode dépréciée.

Ne jamais ajouter une dépendance uniquement pour quelques lignes de code simples.

Les fichiers de verrouillage doivent être versionnés.

## 8. Architecture backend

Organiser le code par fonctionnalité avec une séparation légère des responsabilités.

Exemple :

```text
backend/src/main/java/.../
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

Dans chaque fonctionnalité, séparer lorsque nécessaire :

* API et contrôleurs ;
* services applicatifs ;
* domaine ;
* persistance ;
* DTO et mapping.

Règles :

* contrôleurs fins ;
* logique métier dans les services ;
* accès aux données dans les repositories ;
* injection par constructeur uniquement ;
* aucun `@Autowired` sur les champs ;
* transactions définies au niveau des services ;
* validation des entrées côté serveur ;
* DTO distincts des entités JPA ;
* ne jamais exposer directement une entité JPA dans l’API ;
* dates et heures stockées en UTC avec des types adaptés ;
* erreurs API au format `application/problem+json`;
* journaux sans secrets ni données sensibles inutiles.
* les migrations Flyway ne doivent pas réécrire silencieusement les contenus éditoriaux administrables ; toute correction de données doit être explicite, conditionnelle et validée contre les données de production.

## 9. Architecture frontend

Organisation recommandée :

```text
frontend/src/app/
├── core/
├── shared/
├── layout/
├── features/
│   ├── home/
│   ├── map/
│   ├── notebook/
│   └── admin/
└── app.routes.ts
```

Règles :

* composants standalone ;
* chargement différé des routes admin ;
* services API centralisés par domaine ;
* modèles TypeScript explicites ;
* aucun `any` sans justification documentée ;
* logique métier hors des templates ;
* pas de souscriptions non nettoyées ;
* états de chargement, erreur et absence de données systématiquement gérés ;
* aucune chaîne utilisateur importante codée en dur à plusieurs endroits ;
* aucun HTML riche rendu avec une désactivation globale de la sécurité Angular ;
* ne jamais utiliser `bypassSecurityTrustHtml` pour contourner la sanitation ;
* ne pas utiliser de libellés « eyebrow » (kicker / sur-titre en majuscules au-dessus des titres) ; s’appuyer directement sur les titres `<h1>`/`<h2>` ;
* conserver les accents dans tous les textes utilisateur en français ; ne pas transformer les libellés visibles en ASCII sauf contrainte technique explicite ;
* respecter les règles de `docs/ACCESSIBILITE.md`.

## 10. Authentification et autorisation

L’administration utilise Google OpenID Connect.

Règles non négociables :

* l’easter egg révèle uniquement l’accès à la connexion ;
* l’easter egg n’accorde aucun droit ;
* toutes les routes admin sont protégées côté backend ;
* l’adresse email doit être vérifiée par le fournisseur ;
* l’adresse doit figurer dans l’allowlist active ;
* les contrôles ne doivent jamais reposer uniquement sur Angular ;
* aucune authentification locale par mot de passe ;
* aucune clé ou secret dans le frontend ;
* aucun token d’authentification persistant dans `localStorage`;
* utiliser une session serveur et un cookie sécurisé ;
* conserver la protection CSRF pour les opérations d’écriture ;
* éviter une politique CORS ouverte.

## 11. Contenus et publication

Règles métier essentielles :

* un seul message parchemin peut être actif ;
* seul un message publié peut être actif ;
* une seule vision de carte peut être active ;
* seule une carte publiée peut être active ;
* un onglet de quête est visible publiquement uniquement s’il est publié et explicitement rendu visible ;
* les cinq quêtes existent toujours dans l’administration ;
* une quête en cours de rédaction ne doit jamais apparaître publiquement ;
* les contenus archivés ne sont pas modifiables sans restauration explicite.

Le projet ne comporte pas de versioning complet des contenus dans le MVP.

Le journal d’audit doit enregistrer les actions importantes sans stocker systématiquement tout le contenu avant et après modification.

## 12. Médias

Pour le MVP :

* les cartes de l’aventure sont des ressources versionnées dans le dépôt ;
* les autres médias administrables sont stockés dans un volume persistant ;
* la base stocke leurs métadonnées et leur chemin ;
* ne pas stocker de gros fichiers binaires dans PostgreSQL ;
* formats uploadés autorisés : PNG, JPEG et WebP ;
* ne pas accepter SVG dans le MVP ;
* valider extension, type MIME, taille et contenu détectable ;
* générer un nom serveur indépendant du nom original ;
* empêcher toute exécution des fichiers uploadés ;
* empêcher la traversée de répertoires ;
* exiger un texte alternatif pour les images informatives.

## 13. Contenu Markdown

Les contenus des quêtes sont écrits en Markdown.

Règles :

* conserver le Markdown source ;
* désactiver le HTML brut dans le parseur ;
* sanitizer le HTML produit ;
* autoriser uniquement les éléments nécessaires ;
* refuser les URL dangereuses ;
* préserver une structure de titres cohérente ;
* tester les contenus malveillants ;
* ne jamais contourner la sanitation pour résoudre un problème d’affichage.

## 14. Tests et validations

Après chaque modification, lancer uniquement les contrôles pertinents, puis l’ensemble des contrôles du module avant de terminer le lot.

### Frontend

Commandes cibles une fois le socle créé :

```bash
cd frontend
npm ci
npm run lint
npm test -- --watch=false
npm run build
```

### Backend

```bash
cd backend
./mvnw verify
```

### Validation globale

Lorsqu’un lot touche plusieurs modules :

* tests frontend ;
* build frontend ;
* tests backend ;
* migrations Flyway ;
* tests d’intégration ;
* tests end-to-end concernés ;
* vérification du diff Git.

Si une commande n’existe pas encore, la créer dans le lot de socle puis mettre à jour ce fichier.

Ne pas masquer un test défaillant.

Ne pas supprimer un test uniquement pour faire passer la suite.

Ne pas déclarer un lot terminé lorsqu’une validation nécessaire échoue.

## 15. Définition de « terminé »

Une tâche n’est terminée que lorsque :

* le besoin est implémenté ;
* les critères d’acceptation sont satisfaits ;
* les cas d’erreur sont traités ;
* les tests pertinents existent et réussissent ;
* le lint réussit ;
* le build réussit ;
* les migrations sont cohérentes ;
* la sécurité a été vérifiée ;
* l’accessibilité a été vérifiée pour toute modification visuelle ;
* la documentation concernée est à jour ;
* aucun secret n’a été ajouté ;
* le diff final a été relu ;
* les limites éventuelles sont clairement signalées.

## 16. Compte rendu final d’un agent

À la fin de chaque tâche, fournir :

1. un résumé du résultat ;
2. la liste des principaux fichiers modifiés ;
3. les validations exécutées et leur résultat ;
4. les décisions techniques prises ;
5. les limites ou risques restants ;
6. les éventuelles étapes manuelles nécessaires.

Ne pas annoncer qu’un test a réussi s’il n’a pas réellement été exécuté.

## 17. Hors périmètre du MVP

Ne pas développer sans demande explicite :

* le chat Arkhavel ;
* l’intégration Telegram ;
* un moteur de notifications ;
* le temps réel ;
* le versioning complet des contenus ;
* le rollback éditorial ;
* la gestion de multiples organisations ;
* un système complexe de rôles ;
* une application mobile native ;
* un mode hors ligne complet ;
* une place de marché de thèmes.

## 18. Données et secrets

Ne jamais versionner :

* client secret Google ;
* identifiants PostgreSQL ;
* cookies ou sessions ;
* clés Cloudflare ;
* tokens Telegram ;
* adresses administrateur réelles dans les exemples publics ;
* données personnelles réelles ;
* contenu narratif de production exporté depuis la base ;
* médias privés.

Fournir uniquement des exemples factices dans :

* `.env.example`;
* les jeux de données de démonstration ;
* les tests ;
* la documentation.
