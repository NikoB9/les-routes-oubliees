# Import `.carte` IGN dans le Radar

## Objectif

Importer une carte IGN `.carte` dans le Radar afin d'afficher des points d'attention en plus des aventuriers et du tresor.

## Etapes

1. Fait - Ajouter le modele persistant des points Radar importes, avec migration Flyway.
2. Fait - Porter le decodage GeoJSONX necessaire au format `.carte`.
3. Fait - Ajouter les endpoints admin d'import, activation, association media et suppression.
4. Fait - Etendre le snapshot Radar public avec les points actifs.
5. Fait - Ajouter l'administration Angular et l'affichage public dans le Radar.
6. Partiel - Couvrir les cas critiques par tests backend/frontend et lancer les validations applicables.

## Risques

* Le format `.carte` IGN est compact et non documente dans le depot : le parseur doit refuser explicitement les structures inconnues.
* Les images `img_...` ne sont pas embarquees dans le fichier fourni : elles seront conservees comme cle source et associees manuellement a la mediatheque.
* Les medias references par les points Radar doivent bloquer la suppression pour eviter une image manquante en partie.

## Validation

* `backend`: tests de parsing, endpoints admin Radar, snapshot public, reference media.
* `frontend`: services API, rendu admin, rendu Radar public.
* Commandes cibles : `./mvnw verify`, `npm run lint`, `npm test -- --watch=false`, `npm run build`.
* Etat local : `git diff --check` est passe. Les validations Maven/npm/Docker sont bloquees sur ce poste par l'absence de Docker, de npm et d'un wrapper Maven fonctionnel.
