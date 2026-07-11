# Infrastructure

Ce dossier contient les fichiers d'infrastructure partages entre le developpement local et la preparation production.

## Fichiers

* `compose.yml` : contrat Docker Compose pour le developpement local.
* `nginx/` : exemples de configuration de reverse proxy.
* `systemd/` : exemples d'unites de production native dans le LXC.
* `cloudflared/` : exemple de configuration Cloudflare Tunnel.
* `postgresql/` : notes de configuration PostgreSQL.

## Utilisation actuelle

Le socle applicatif Angular/Spring Boot n'est pas encore cree. Le service immediatement lancable est donc PostgreSQL :

```bash
docker compose -f infra/compose.yml up db
```

Lorsque `frontend/Dockerfile` et `backend/Dockerfile` existeront, le profil applicatif permettra de lancer l'ensemble :

```bash
docker compose -f infra/compose.yml --profile app up --build
```

## Secrets

Ne jamais commiter de fichier `.env` reel. Utiliser `.env.example` comme modele et fournir les valeurs sensibles localement.
