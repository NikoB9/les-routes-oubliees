# PostgreSQL

PostgreSQL 18 est la base cible.

## Développement local

Le service `db` de `infra/compose.yml` crée une base locale avec des valeurs factices :

```bash
docker compose -f infra/compose.yml up db
```

Les données sont conservées dans un volume Compose nommé `postgres-data`.

## Production LXC

Créer une base et un utilisateur dédiés. Exemple indicatif à adapter sur le serveur :

```sql
CREATE USER routes_oubliees WITH PASSWORD 'CHANGE_ME';
CREATE DATABASE routes_oubliees OWNER routes_oubliees;
```

Le mot de passe réel doit être stocké dans `/etc/les-routes-oubliees/application.env`, jamais dans Git.

## Sauvegardes

Utiliser un dump au format personnalisé :

```bash
pg_dump -Fc
```

Tester régulièrement la restauration sur une base vide.
