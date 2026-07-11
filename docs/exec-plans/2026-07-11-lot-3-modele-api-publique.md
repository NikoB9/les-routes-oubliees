# Lot 3 - Modele de donnees et API publique

## Objectif

Mettre en place le socle backend public permettant aux pages Angular de lire les contenus publies sans exposer les brouillons, archives ou contenus masques.

## Perimetre

- Migrations PostgreSQL pour les contenus publics du MVP.
- Entites JPA, repositories, services applicatifs et DTO publics.
- Endpoints `GET /api/public/**`.
- Donnees de demonstration fictives.
- Tests backend couvrant les regles de filtrage public.

## Hors perimetre

- Interfaces d'administration de contenu.
- Upload et gestion de medias administrables.
- Rendu HTML Markdown et sanitation avancee.
- Ecrans publics finaux Angular.

## Etapes

1. Creer les migrations Flyway des tables publiques.
2. Ajouter les modeles backend par domaine.
3. Exposer les endpoints publics de lecture.
4. Ajouter des donnees de demonstration sans secret ni donnee personnelle reelle.
5. Couvrir les regles de publication par tests.
6. Executer les validations backend et relire le diff.

## Risques

- Les regles de visibilite doivent etre imposees cote backend, pas seulement par Angular.
- Les contraintes SQL doivent empecher les etats actifs incoherents.
- Les donnees de demonstration ne doivent pas ressembler a du contenu de production.

## Validation

- `backend` : tests unitaires et integration applicative.
- Migration Flyway validee sur base PostgreSQL via Testcontainers.
- Relecture du diff avant commit.
