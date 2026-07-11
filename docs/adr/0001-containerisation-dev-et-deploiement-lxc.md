# ADR 0001 - Conteneurisation de developpement et deploiement LXC

## Statut

Acceptee.

## Contexte

Le projet doit etre simple a lancer sur un poste de developpement et rester deployable dans un conteneur Proxmox LXC leger. Une conteneurisation complete facilite la reproductibilite, mais executer Docker ou un runtime OCI a l'interieur d'un LXC ajoute des contraintes d'exploitation : nesting, stockage, droits, mises a jour du runtime et diagnostic plus complexe.

## Decision

Le projet adopte une strategie en deux niveaux :

1. **Developpement local** : Docker Compose est le chemin standard pour lancer PostgreSQL et, apres creation des socles, le frontend Angular et le backend Spring Boot.
2. **Production MVP dans LXC** : le chemin recommande reste l'execution native des services dans le LXC avec systemd, PostgreSQL local, reverse proxy local et Cloudflare Tunnel.

Un deploiement Compose complet dans le LXC est autorise comme variante si l'administrateur Proxmox active explicitement le support des conteneurs imbriques et accepte cette contrainte operationnelle.

## Alternatives considerees

* **Tout executer en Compose, y compris en production LXC** : reproductible, mais plus fragile dans certains LXC et plus complexe a diagnostiquer.
* **Aucun conteneur** : plus simple en production, mais moins reproductible pour les developpeurs.
* **Kubernetes ou orchestrateur externe** : hors perimetre MVP et disproportionne.

## Consequences

* Les fichiers Compose doivent rester utilisables localement et preparer les images applicatives.
* La documentation de deploiement doit maintenir une procedure native systemd et une variante Compose.
* Les secrets restent fournis par fichiers d'environnement ou variables d'environnement, jamais dans les images ni dans Git.
* Les lots de socle devront ajouter des Dockerfiles applicatifs durcis lorsque `frontend/` et `backend/` contiendront les projets reels.
