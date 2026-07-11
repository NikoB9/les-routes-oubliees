# Lot d'initialisation, orchestration et conteneurs

## Objectif

Rendre le depot coherent pour lancer les lots de developpement avec :

* une orchestration d'agents explicite ;
* des responsabilites front, back, tests, accessibilite et securite separees ;
* une strategie de conteneurisation reproductible ;
* une documentation exploitable avant la creation des socles Angular et Spring Boot.

Ce plan ne cree pas encore l'application Angular ni l'application Spring Boot. Il prepare les conventions qui devront etre respectees par les lots suivants.

## Perimetre

Inclus :

* revue des fichiers Markdown existants ;
* ajout des conventions d'orchestration autonome ;
* cadrage de Docker Compose pour le poste de developpement ;
* cadrage du deploiement LXC avec choix explicite entre services natifs et conteneurs imbriques ;
* ajout d'exemples de configuration sans secret.

Exclus :

* generation du projet Angular ;
* generation du projet Spring Boot ;
* implementation des API ;
* implementation de l'authentification Google ;
* CI complete ;
* deploiement reel.

## Orchestration d'agents cible

Le fil principal reste l'orchestrateur autonome. Il est responsable du plan, du decoupage, de l'integration, de la revue finale et du compte rendu.

Agents dedies a utiliser selon le lot :

* **Architecte** : coherence globale, simplicite, dependances entre lots.
* **Backend** : Spring Boot, API, securite serveur, persistence, migrations.
* **Frontend** : Angular, routing, UI, etats, integration API.
* **Qualite et tests** : strategie de tests, cas limites, non-regression.
* **Accessibilite** : RGAA/WCAG, clavier, focus, contrastes, formulaires.
* **Securite** : OIDC, sessions, CSRF, uploads, secrets, exposition API.
* **Documentation** : README, exploitation, ADR, procedures.

Regles :

* privilegier les agents en lecture seule pour les revues transverses ;
* n'autoriser l'ecriture concurrente que sur des fichiers disjoints ;
* confier a chaque agent un objectif, un perimetre, des fichiers autorises et un livrable ;
* l'orchestrateur relit toujours les resultats avant integration.

## Strategie conteneurs

Developpement local :

* Docker Compose ou un equivalent compatible lance PostgreSQL ;
* lorsque les socles existent, Compose lance aussi backend et frontend ;
* les fichiers d'environnement fournis dans le depot ne contiennent que des valeurs factices ;
* les volumes de base et medias ne sont jamais commites.

Production LXC :

* chemin recommande MVP : services natifs dans le LXC, comme documente dans `docs/DEPLOIEMENT.md` ;
* chemin optionnel : Compose complet dans le LXC uniquement si le conteneur Proxmox autorise les conteneurs imbriques et que cette contrainte est acceptee ;
* dans les deux cas, PostgreSQL et les medias utilisent des volumes persistants et des sauvegardes documentees.

## Risques

* Docker dans un LXC Proxmox peut necessiter des options de nesting et un stockage adapte.
* Une conteneurisation complete avant la creation des socles Angular/Spring ne peut etre qu'un contrat cible.
* Les images applicatives devront etre durcies lors des lots de socle : utilisateur non-root, builds multi-stage, fichiers secrets hors image.

## Validations attendues

Pour ce lot documentaire :

* relire tous les fichiers Markdown ;
* verifier l'arborescence ;
* executer `git status` ;
* verifier que les exemples ne contiennent aucun secret reel ;
* verifier que la strategie conteneur ne contredit pas les contraintes LXC.

Pour les lots suivants :

* `docker compose -f infra/compose.yml up db` doit lancer PostgreSQL ;
* le profil applicatif Compose sera valide apres creation des Dockerfiles frontend et backend ;
* les commandes frontend et backend documentees devront etre executables.

## Definition de termine

Le lot est termine lorsque :

* les documents de reference expliquent le fonctionnement des agents ;
* la strategie conteneurs est explicite ;
* les limites du deploiement Compose dans un LXC sont documentees ;
* les fichiers d'infrastructure ne contiennent pas de secret ;
* le diff final est relu.
